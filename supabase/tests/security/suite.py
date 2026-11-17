import os, sys, uuid, json
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import pgh

def build_fixtures(db):
    s = pgh.Session(db)
    F = {}
    F["A"] = pgh.signup(db, "a@t.test", {"full_name": "Student A"})
    F["B"] = pgh.signup(db, "b@t.test", {"full_name": "Student B"})
    F["I"] = pgh.signup(db, "i@t.test", {"full_name": "Instructor I", "role": "instructor"})
    F["J"] = pgh.signup(db, "j@t.test", {"full_name": "Instructor J", "role": "instructor"})
    F["M"] = pgh.signup(db, "m@t.test", {"full_name": "Admin M"})
    F["SA"] = pgh.signup(db, "sa@t.test", {"full_name": "Super Admin"})
    F["MOD"] = pgh.signup(db, "mod@t.test", {"full_name": "Moderator"})
    # staff accounts are provisioned out-of-band (SQL editor / service role), exactly like the real project
    s.run("update public.profiles set role='admin' where id=%s", (F["M"],), role="postgres", fetch=False)
    s.run("update public.profiles set role='super_admin' where id=%s", (F["SA"],), role="postgres", fetch=False)
    s.run("update public.profiles set role='moderator' where id=%s", (F["MOD"],), role="postgres", fetch=False)

    def one(sql, params):
        st, rows = s.run(sql, params, role="postgres")
        assert st == "OK", rows
        return rows[0][0]

    F["C1"] = one("insert into public.courses (instructor_id,title,slug,status,price_w3tr) values (%s,'Free course','free-course','published',0) returning id", (F["I"],))
    F["S1"] = one("insert into public.course_sections (course_id,title) values (%s,'Sec') returning id", (F["C1"],))
    F["L1"] = one("insert into public.lessons (section_id,course_id,title,w3tr_reward) values (%s,%s,'L1',1) returning id", (F["S1"], F["C1"]))
    F["L2"] = one("insert into public.lessons (section_id,course_id,title,w3tr_reward) values (%s,%s,'L2',1) returning id", (F["S1"], F["C1"]))
    F["C2"] = one("insert into public.courses (instructor_id,title,slug,status,price_w3tr) values (%s,'Paid course','paid-course','published',50) returning id", (F["J"],))
    F["S2"] = one("insert into public.course_sections (course_id,title) values (%s,'Sec') returning id", (F["C2"],))
    F["L3"] = one("insert into public.lessons (section_id,course_id,title,w3tr_reward) values (%s,%s,'Paid L',9) returning id", (F["S2"], F["C2"]))
    F["EA"] = one("insert into public.enrollments (student_id,course_id) values (%s,%s) returning id", (F["A"], F["C1"]))
    F["CAMP"] = one("insert into public.donation_campaigns (title,slug) values ('Fund','fund') returning id", ())
    F["CERT"] = one("insert into public.certificates (student_id,course_id,enrollment_id,certificate_code) values (%s,%s,%s,'ABC123DEF456') returning id", (F["A"], F["C1"], F["EA"]))
    # production has rows in these admin-config tables; seed them so a leak is actually measurable
    s.run("insert into public.system_settings (key, value) values ('support_email', '\"help@example.org\"'::jsonb)", role="postgres", fetch=False)
    s.run("insert into public.feature_flags (flag_key, label) values ('beta_flag', 'Beta flag')", role="postgres", fetch=False)
    # a wallet balance for A so "spend from someone else's wallet" is testable
    s.run("select public.award_w3tr(%s,'admin_grant',100,null,null,'seed',null)", (F["A"],), role="postgres", fetch=False)
    return F

def run_suite(db):
    s = pgh.Session(db)
    F = build_fixtures(db)
    R = []  # (id, kind, title, status, detail)

    def add(i, kind, title, status, detail=""):
        R.append((i, kind, title, status, str(detail)[:95]))

    def attack(i, title, st, res, ok_if=lambda r: True):
        """attack succeeded => EXPLOITABLE"""
        if st == "OK" and ok_if(res):
            add(i, "attack", title, "EXPLOITABLE", res if st == "OK" else "")
        else:
            add(i, "attack", title, "BLOCKED", res)

    def legit(i, title, st, res, ok_if=lambda r: True):
        if st == "OK" and ok_if(r := res):
            add(i, "legit", title, "WORKS", "")
        else:
            add(i, "legit", title, "BROKEN", res)

    # ------------------------------------------------------------------ F1 signup role injection
    for label, role in [("super_admin", "super_admin"), ("admin", "admin")]:
        try:
            u = pgh.signup(db, f"inj-{label}@t.test", {"role": role})
            st, rows = s.run("select role::text from public.profiles where id=%s", (u,), role="postgres")
            attack(f"F1-{label}", f"Sign up with metadata role='{label}'", st, rows, lambda r: r[0][0] == role)
        except Exception as e:
            add(f"F1-{label}", "attack", f"Sign up with metadata role='{label}'", "BLOCKED", str(e).splitlines()[0])
    for role in ["student", "instructor", "organization"]:
        u = pgh.signup(db, f"ok-{role}@t.test", {"role": role, "full_name": role})
        st, rows = s.run("select role::text from public.profiles where id=%s", (u,), role="postgres")
        legit(f"F1-legit-{role}", f"Legit sign-up as '{role}' still gets that role", st, rows, lambda r, role=role: r[0][0] == role)
    try:
        u = pgh.signup(db, "weird@t.test", {"role": "banana"})
        st, rows = s.run("select role::text from public.profiles where id=%s", (u,), role="postgres")
        legit("F1-legit-bad", "Garbage role value signs up as 'student' (no 500)", st, rows, lambda r: r[0][0] == "student")
    except Exception as e:
        add("F1-legit-bad", "legit", "Garbage role value signs up as 'student' (no 500)", "BROKEN", str(e).splitlines()[0])
    u = pgh.signup(db, "norole@t.test", {})
    st, rows = s.run("select role::text from public.profiles where id=%s", (u,), role="postgres")
    legit("F1-legit-none", "Sign-up with no role gets 'student'", st, rows, lambda r: r[0][0] == "student")

    # ------------------------------------------------------------------ F2 self-escalation on profiles
    B = F["B"]
    # B starts as a BANNED, DEACTIVATED user, so "unban myself" / "reactivate myself" are real attacks, not no-ops
    s.run("update public.profiles set is_banned=true, ban_reason='spam', is_active=false where id=%s", (B,), role="postgres", fetch=False)
    for col, val in [("role", "'super_admin'::user_role"), ("is_instructor_verified", "true"),
                     ("is_banned", "false"), ("is_active", "true"), ("phone_verified", "true"),
                     ("two_factor_enabled", "true"), ("email", "'hijack@evil.test'")]:
        st, rows = s.run(f"update public.profiles set {col}={val} where id=%s returning id", (B,), uid=B)
        attack(f"F2-{col}", f"Student edits own profile column '{col}'", st, rows, lambda r: len(r) == 1)
    # make sure the failed/leaked state doesn't pollute later tests
    s.run("update public.profiles set role='student', is_instructor_verified=false, email='b@t.test', phone_verified=false, two_factor_enabled=false, is_banned=false, ban_reason=null, is_active=true where id=%s", (B,), role="postgres", fetch=False)
    st, rows = s.run("update public.profiles set role='student' where id=%s returning id", (B,), role="postgres")
    for col, val in [("full_name", "'New Name'"), ("bio", "'hi'"), ("username", "'bstudent'"), ("avatar_url", "'https://x/y.png'"),
                     ("theme_preference", "'dark'"), ("country", "'Nigeria'"), ("state_region", "'Plateau'"),
                     ("lga", "'Jos South'"), ("visible_for_opportunities", "true")]:
        st, rows = s.run(f"update public.profiles set {col}={val} where id=%s returning id", (B,), uid=B)
        legit(f"F2-legit-{col}", f"Student can still edit own '{col}'", st, rows, lambda r: len(r) == 1)

    # ------------------------------------------------------------------ F3 reward / wallet RPCs
    st, rows = s.run("select (public.award_w3tr(%s,'admin_grant',100000,null,null,'mint',null)).amount", (B,), role="anon")
    attack("F3-award-anon", "ANONYMOUS caller mints 100,000 W3TR (award_w3tr)", st, rows)
    st, rows = s.run("select (public.award_w3tr(%s,'admin_grant',100000,null,null,'mint',null)).amount", (B,), uid=B)
    attack("F3-award-auth", "Logged-in student mints 100,000 W3TR for self", st, rows)
    st, rows = s.run("select (public.spend_w3tr(%s,40,null,null,'drain')).amount", (F["A"],), uid=B)
    attack("F3-spend", "Student B drains student A's wallet (spend_w3tr)", st, rows)
    st, rows = s.run("select (public.record_daily_login(%s)).w3tr_awarded", (F["SA"],), role="anon")
    attack("F3-login-anon", "ANONYMOUS caller triggers daily-login reward for another user", st, rows)
    st, rows = s.run("select (public.complete_lesson(%s,%s)).is_completed", (F["EA"], F["L1"]), uid=B)
    attack("F3-complete", "Student B completes lessons on student A's enrolment", st, rows)
    st, rows = s.run("select public.increment_campaign_raised(%s, 1000000)", (F["CAMP"],), role="anon")
    attack("F3-campaign", "ANONYMOUS caller inflates a public donation campaign total", st, rows)
    st, rows = s.run("update public.w3tr_wallets set balance=999999 where profile_id=%s returning balance", (B,), uid=B)
    attack("F3-wallet-direct", "Student writes own wallet balance directly", st, rows, lambda r: len(r) == 1)
    # legitimate server-side path: the app calls these with the service-role key
    st, rows = s.run("select (public.award_w3tr(%s,'admin_grant',5,null,null,'legit',%s)).amount", (F["B"], F["M"]), role="service_role")
    legit("F3-legit-award", "Server (service role) can still award W3TR", st, rows)
    st, rows = s.run("select (public.record_daily_login(%s)).w3tr_awarded", (F["B"],), role="service_role")
    legit("F3-legit-login", "Server (service role) can still record daily login", st, rows)
    st, rows = s.run("select public.increment_campaign_raised(%s, 10)", (F["CAMP"],), role="service_role")
    legit("F3-legit-campaign", "Server (service role) can still add donations to a campaign", st, rows)

    # ------------------------------------------------------------------ F4 anonymous data exposure
    st, rows = s.run("select email, role::text, is_banned from public.profiles", role="anon")
    attack("F4-profiles-pii", "ANONYMOUS caller reads every user's email/role/ban flag", st, rows, lambda r: len(r) > 0)
    st, rows = s.run("select id, full_name, avatar_url, username from public.profiles", role="anon")
    legit("F4-legit-public-profile", "Public pages can still read instructor name/avatar", st, rows, lambda r: len(r) > 0)
    st, rows = s.run("select * from public.leaderboard", role="anon")
    attack("F4-leaderboard-anon", "ANONYMOUS caller reads the leaderboard (names + balances)", st, rows, lambda r: len(r) > 0)
    st, rows = s.run("select * from public.leaderboard", uid=F["A"])
    legit("F4-legit-leaderboard", "Logged-in student can still see the leaderboard", st, rows, lambda r: len(r) > 0)
    st, rows = s.run("select certificate_code, student_id from public.certificates", role="anon")
    attack("F4-certs-anon", "ANONYMOUS caller lists every certificate", st, rows, lambda r: len(r) > 0)
    st, rows = s.run("select certificate_code from public.certificates", uid=B)
    attack("F4-certs-other", "Student B lists student A's certificates", st, rows, lambda r: len(r) > 0)
    st, rows = s.run("select certificate_code from public.certificates", uid=F["A"])
    legit("F4-legit-own-cert", "Student A can still see own certificate", st, rows, lambda r: len(r) == 1)
    st, rows = s.run("select certificate_code from public.certificates where certificate_code='ABC123DEF456'", role="service_role")
    legit("F4-legit-verify", "Public verify page (service role) can still look up a certificate", st, rows, lambda r: len(r) == 1)
    for tbl in ["system_settings", "feature_flags", "reward_rules"]:
        s.run(f"select 1", role="postgres")
        st, rows = s.run(f"select count(*) from public.{tbl}", role="anon")
        attack(f"F4-{tbl}", f"ANONYMOUS caller reads {tbl}", st, rows, lambda r: r[0][0] > 0)
        st, rows = s.run(f"select count(*) from public.{tbl}", uid=F["M"])
        legit(f"F4-legit-{tbl}", f"Admin can still read {tbl}", st, rows)
        if tbl in ("system_settings", "reward_rules"):
            st, rows = s.run(f"select count(*) from public.{tbl}", uid=F["MOD"])
            legit(f"F4-legit-mod-{tbl}", f"Moderator (admitted to /admin) can still read {tbl}", st, rows)
        st, rows = s.run(f"select count(*) from public.{tbl}", uid=F["B"])
        attack(f"F4-student-{tbl}", f"A logged-in STUDENT reads {tbl} (rows returned)", st, rows, lambda r: r[0][0] > 0)

    # ------------------------------------------------------------------ F5 forging academic records
    st, rows = s.run("insert into public.enrollments (student_id,course_id) values (%s,%s) returning id", (B, F["C2"]), uid=B)
    attack("F5-enroll", "Student self-enrols in a PAID course without paying", st, rows, lambda r: len(r) == 1)
    st, rows = s.run("update public.enrollments set progress_percent=100, status='completed' where id=%s returning id", (F["EA"],), uid=F["A"])
    attack("F5-complete", "Student marks own enrolment 100% / completed (certificate eligibility)", st, rows, lambda r: len(r) == 1)
    st, rows = s.run("insert into public.lesson_progress (enrollment_id,student_id,lesson_id,course_id,is_completed) values (%s,%s,%s,%s,true) returning id", (F["EA"], F["A"], F["L2"], F["C1"]), uid=F["A"])
    attack("F5-progress", "Student writes own lesson-progress rows directly", st, rows, lambda r: len(r) == 1)
    qz = pgh.Session(db).run("insert into public.quizzes (course_id,title,is_final_exam) values (%s,'Final',true) returning id", (F["C1"],), role="postgres")[1][0][0]
    st, rows = s.run("insert into public.quiz_attempts (quiz_id,student_id,status,score_percent,passed) values (%s,%s,'graded',100,true) returning id", (qz, F["A"]), uid=F["A"])
    attack("F5-quiz", "Student forges a passed final-exam attempt", st, rows, lambda r: len(r) == 1)
    st, rows = s.run("select id from public.enrollments", uid=F["A"])
    legit("F5-legit-read", "Student can still read own enrolment", st, rows, lambda r: len(r) >= 1)
    st, rows = s.run("select id from public.quiz_attempts", uid=F["A"])
    legit("F5-legit-read-quiz", "Student can still read own quiz attempts", st, rows)
    st, rows = s.run("insert into public.enrollments (student_id,course_id) values (%s,%s) returning id", (F["B"], F["C1"]), role="service_role")
    legit("F5-legit-server-enrol", "Server (service role) can still create an enrolment", st, rows, lambda r: len(r) == 1)
    st, rows = s.run("insert into public.quiz_attempts (quiz_id,student_id,status,score_percent,passed) values (%s,%s,'graded',80,true) returning id", (qz, F["B"]), role="service_role")
    legit("F5-legit-server-quiz", "Server (service role) can still record a quiz attempt", st, rows, lambda r: len(r) == 1)

    # ------------------------------------------------------------------ F7 storage path move
    s.run("delete from storage.objects", role="postgres", fetch=False)
    s.run("insert into storage.objects (bucket_id,name,owner) values ('avatars',%s,%s)", (f"{F['B']}/mine.png", F["B"]), uid=F["B"], fetch=False)
    s.run("insert into storage.objects (bucket_id,name,owner) values ('avatars',%s,%s)", (f"{F['A']}/avatar.png", F["A"]), uid=F["A"], fetch=False)
    st, rows = s.run("update storage.objects set name=%s where bucket_id='avatars' and name=%s returning name",
                     (f"{F['A']}/planted.png", f"{F['B']}/mine.png"), uid=F["B"])
    attack("F7-move", "Student B moves their file INTO student A's avatar folder", st, rows, lambda r: len(r) == 1)
    s.run("update storage.objects set name=%s where bucket_id='avatars' and name=%s", (f"{F['B']}/mine.png", f"{F['A']}/planted.png"), role="postgres", fetch=False)
    st, rows = s.run("update storage.objects set name=%s where bucket_id='avatars' and name=%s returning name",
                     (f"{F['B']}/renamed.png", f"{F['B']}/mine.png"), uid=F["B"])
    legit("F7-legit-rename", "Student can still rename/replace a file in their own avatar folder", st, rows, lambda r: len(r) == 1)
    st, rows = s.run("insert into storage.objects (bucket_id,name,owner) values ('avatars',%s,%s) returning name", (f"{F['B']}/new.png", F["B"]), uid=F["B"])
    legit("F7-legit-upload", "Student can still upload an avatar to their own folder", st, rows)

    # ------------------------------------------------------------------ extra holes found while reading the code
    st, rows = s.run("update public.courses set status='published' where id=%s returning id", (F["C1"],), uid=F["I"])
    s.run("update public.courses set status='published' where id=%s", (F["C1"],), role="postgres", fetch=False)
    draft = s.run("insert into public.courses (instructor_id,title,slug,status) values (%s,'Draft','draft-c','draft') returning id", (F["I"],), role="postgres")[1][0][0]
    st, rows = s.run("update public.courses set status='published' where id=%s returning id", (draft,), uid=F["I"])
    attack("X1-selfpublish", "Instructor publishes own course, bypassing moderation", st, rows, lambda r: len(r) == 1)
    s.run("update public.courses set status='draft' where id=%s", (draft,), role="postgres", fetch=False)
    st, rows = s.run("insert into public.courses (instructor_id,title,slug,status) values (%s,'Sneaky','sneaky','published') returning id", (F["I"],), uid=F["I"])
    attack("X1-insert-published", "Instructor creates a course already 'published'", st, rows, lambda r: len(r) == 1)
    st, rows = s.run("update public.courses set status='pending_review' where id=%s returning id", (draft,), uid=F["I"])
    legit("X1-legit-submit", "Instructor can still submit a course for review", st, rows, lambda r: len(r) == 1)
    st, rows = s.run("update public.courses set title='Renamed draft' where id=%s returning id", (draft,), uid=F["I"])
    legit("X1-legit-edit", "Instructor can still edit own course details", st, rows, lambda r: len(r) == 1)
    st, rows = s.run("update public.courses set status='published' where id=%s returning id", (draft,), uid=F["MOD"])
    legit("X1-legit-moderate", "Moderator can still publish (approve) a course", st, rows, lambda r: len(r) == 1)

    st, rows = s.run("update public.profiles set role='super_admin' where id=%s returning id", (F["B"],), uid=F["M"])
    attack("X2-admin-promote", "Ordinary ADMIN promotes someone to super_admin", st, rows, lambda r: len(r) == 1)
    s.run("update public.profiles set role='student' where id=%s", (F["B"],), role="postgres", fetch=False)
    st, rows = s.run("update public.profiles set role='super_admin' where id=%s returning id", (F["M"],), uid=F["M"])
    attack("X2-admin-self", "Ordinary admin promotes THEMSELVES to super_admin", st, rows, lambda r: len(r) == 1)
    s.run("update public.profiles set role='admin' where id=%s", (F["M"],), role="postgres", fetch=False)
    st, rows = s.run("update public.profiles set is_banned=true, ban_reason='x' where id=%s returning id", (F["SA"],), uid=F["M"])
    attack("X2-ban-superadmin", "Ordinary admin bans the super admin", st, rows, lambda r: len(r) == 1)
    s.run("update public.profiles set is_banned=false, ban_reason=null where id=%s", (F["SA"],), role="postgres", fetch=False)
    st, rows = s.run("update public.profiles set role='instructor' where id=%s returning id", (F["B"],), uid=F["M"])
    legit("X2-legit-admin-role", "Admin can still change a student to instructor", st, rows, lambda r: len(r) == 1)
    s.run("update public.profiles set role='student' where id=%s", (F["B"],), role="postgres", fetch=False)
    st, rows = s.run("update public.profiles set is_banned=true, ban_reason='spam' where id=%s returning id", (F["B"],), uid=F["M"])
    legit("X2-legit-ban", "Admin can still ban an ordinary user", st, rows, lambda r: len(r) == 1)
    s.run("update public.profiles set is_banned=false, ban_reason=null where id=%s", (F["B"],), role="postgres", fetch=False)
    st, rows = s.run("update public.profiles set role='admin' where id=%s returning id", (F["B"],), uid=F["SA"])
    legit("X2-legit-superadmin", "Super admin can still appoint an admin", st, rows, lambda r: len(r) == 1)
    s.run("update public.profiles set role='student' where id=%s", (F["B"],), role="postgres", fetch=False)

    st, rows = s.run("select (public.complete_lesson(%s,%s)).is_completed", (F["EA"], F["L3"]), role="service_role")
    attack("X3-wrong-course", "Complete a lesson from a DIFFERENT (paid) course on a free enrolment", st, rows)
    # regression: the normal happy path through the server still pays out correctly
    ea2 = s.run("insert into public.enrollments (student_id,course_id) values (%s,%s) returning id", (F["SA"], F["C1"]), role="postgres")[1][0][0]
    s.run("update public.w3tr_wallets set balance=0 where profile_id=%s", (F["SA"],), role="postgres", fetch=False)
    st1, _ = s.run("select (public.complete_lesson(%s,%s)).is_completed", (ea2, F["L1"]), role="service_role")
    st2, _ = s.run("select (public.complete_lesson(%s,%s)).is_completed", (ea2, F["L2"]), role="service_role")
    st, rows = s.run("select progress_percent, status::text from public.enrollments where id=%s", (ea2,), role="postgres")
    bal = s.run("select balance from public.w3tr_wallets where profile_id=%s", (F["SA"],), role="postgres")[1][0][0]
    legit("X4-legit-complete", "Server completes both lessons → course 100% completed", st1, rows, lambda r: st2 == "OK" and float(r[0][0]) == 100.0 and r[0][1] == "completed")
    legit("X4-legit-payout", "…and the W3TR payout is unchanged (1+1 lessons +20 course bonus = 22)", "OK", bal, lambda b: float(b) == 22.0)
    st, rows = s.run("select (public.complete_lesson(%s,%s)).is_completed", (ea2, F["L1"]), role="service_role")
    legit("X4-legit-idempotent", "Completing the same lesson twice doesn't pay twice", st, rows,
          lambda r: float(s.run("select balance from public.w3tr_wallets where profile_id=%s", (F["SA"],), role="postgres")[1][0][0]) == 22.0)

    asg = s.run("insert into public.assignments (course_id,title) values (%s,'HW') returning id", (F["C1"],), role="postgres")
    if asg[0] == "OK":
        aid = asg[1][0][0]
        s.run("insert into public.assignment_submissions (assignment_id,student_id,submission_text) values (%s,%s,'my work')", (aid, F["A"]), role="postgres", fetch=False)
        st, rows = s.run("update public.assignment_submissions set score=100, status='graded' where assignment_id=%s and student_id=%s returning id", (aid, F["A"]), uid=F["A"])
        attack("X5-self-grade", "Student grades their own assignment (score=100, graded)", st, rows, lambda r: len(r) == 1)
        st, rows = s.run("update public.assignment_submissions set submission_text='edited' where assignment_id=%s and student_id=%s returning id", (aid, F["A"]), uid=F["A"])
        legit("X5-legit-resubmit", "Student can still edit their own submission text", st, rows, lambda r: len(r) == 1)
        st, rows = s.run("update public.assignment_submissions set score=88, status='graded', feedback='ok' where assignment_id=%s and student_id=%s returning id", (aid, F["A"]), uid=F["I"])
        legit("X5-legit-instructor-grade", "Course instructor can still grade a submission", st, rows, lambda r: len(r) == 1)
    else:
        add("X5-setup", "legit", "assignments fixture", "BROKEN", asg[1])

    st, rows = s.run("insert into public.instructor_profiles (profile_id, verification_status) values (%s,'verified') returning profile_id", (F["B"],), uid=F["B"])
    attack("X6-self-verify", "User creates own instructor profile already 'verified'", st, rows, lambda r: len(r) == 1)
    s.run("delete from public.instructor_profiles where profile_id=%s", (F["B"],), role="postgres", fetch=False)
    st, rows = s.run("insert into public.instructor_profiles (profile_id, headline) values (%s,'Hello') returning profile_id", (F["B"],), uid=F["B"])
    legit("X6-legit-profile", "User can still create own (unverified) instructor profile", st, rows, lambda r: len(r) == 1)
    st, rows = s.run("update public.instructor_profiles set verification_status='verified', average_rating=5 where profile_id=%s returning profile_id", (F["B"],), uid=F["B"])
    attack("X6-self-verify-update", "Instructor flips own verification_status to 'verified'", st, rows, lambda r: len(r) == 1)
    st, rows = s.run("update public.instructor_profiles set headline='Updated' where profile_id=%s returning profile_id", (F["B"],), uid=F["B"])
    legit("X6-legit-edit", "Instructor can still edit own headline", st, rows, lambda r: len(r) == 1)
    st, rows = s.run("update public.student_profiles set total_courses_completed=99, referral_code='HACKED' where profile_id=%s returning profile_id", (F["B"],), uid=F["B"])
    attack("X7-student-counters", "Student rewrites own completion counters / referral code", st, rows, lambda r: len(r) == 1)
    st, rows = s.run("update public.student_profiles set learning_goals='learn ai' where profile_id=%s returning profile_id", (F["B"],), uid=F["B"])
    legit("X7-legit-goals", "Student can still edit own learning goals", st, rows, lambda r: len(r) == 1)

    # ------------------------------------------------------------------ donations / storage listing / defaults / regressions
    meth = s.run("select enumlabel from pg_enum e join pg_type t on t.oid=e.enumtypid where t.typname='donation_method' order by enumsortorder limit 1", role="postgres")[1][0][0]
    labels = [r[0] for r in s.run("select enumlabel from pg_enum e join pg_type t on t.oid=e.enumtypid where t.typname='donation_status'", role="postgres")[1]]
    confirmed = "confirmed" if "confirmed" in labels else labels[-1]
    def don(extra_cols, extra_vals, role, uid=None):
        cols = "amount, method, donor_email" + extra_cols
        return s.run(f"insert into public.donations ({cols}) values (%s, %s, 'd@t.test'{extra_vals})", (5000, meth), role=role, uid=uid, fetch=False)
    st, rows = don(", status", f", '{confirmed}'", "anon")
    attack("X8-forged-donation", "ANONYMOUS caller inserts an already-'confirmed' donation", st, rows)
    st, rows = don("", "", "anon")
    legit("X8-legit-guest-donation", "Guest can still submit a pending donation", st, rows)
    st, rows = s.run(f"insert into public.donations (amount, method, donor_email, donor_id) values (%s,%s,'d@t.test',%s)", (5000, meth, F["B"]), role="authenticated", uid=F["B"], fetch=False)
    legit("X8-legit-member-donation", "Logged-in donor can still donate as themselves", st, rows)
    st, rows = s.run(f"insert into public.donations (amount, method, donor_email, donor_id) values (%s,%s,'d@t.test',%s)", (5000, meth, F["A"]), role="authenticated", uid=F["B"], fetch=False)
    attack("X8-impersonate-donor", "Logged-in user files a donation attributed to ANOTHER user", st, rows)

    s.run("insert into storage.objects (bucket_id,name,owner) values ('course-documents',%s,%s)", (f"{F['I']}/paid-notes.pdf", F["I"]), role="postgres", fetch=False)
    st, rows = s.run("select name from storage.objects where bucket_id='course-documents'", role="anon")
    attack("F8-storage-list", "ANONYMOUS caller lists files in the paid course-documents bucket", st, rows, lambda r: len(r) > 0)
    st, rows = s.run("select name from storage.objects where bucket_id='course-documents'", uid=F["I"])
    legit("F8-legit-owner-list", "File owner (instructor) can still see their own files", st, rows, lambda r: len(r) == 1)
    st, rows = s.run("select name from storage.objects where bucket_id='course-documents'", uid=F["B"])
    attack("F8-storage-list-other", "A different logged-in student lists the instructor's course documents", st, rows, lambda r: len(r) > 0)

    s.run("create or replace function public.zz_future_fn() returns int language sql as $$ select 1 $$", role="postgres", fetch=False)
    st, rows = s.run("select public.zz_future_fn()", role="anon")
    attack("F9-default-grants", "A brand-new function is callable by anonymous visitors by default", st, rows)
    st, rows = s.run("select public.zz_future_fn()", role="service_role")
    legit("F9-legit-service-fn", "…but the server (service role) can still call new functions", st, rows)

    # regression: things the revokes must NOT break
    st, rows = s.run("select id, title, slug from public.courses where status='published'", role="anon")
    legit("R1-anon-catalogue", "Logged-out visitor can still browse the published course catalogue", st, rows, lambda r: len(r) >= 1)
    st, rows = s.run("select c.title, p.full_name, p.avatar_url from public.courses c join public.profiles p on p.id=c.instructor_id where c.status='published'", role="anon")
    legit("R2-anon-instructor-join", "…and see each course's instructor name/avatar (join on profiles)", st, rows, lambda r: len(r) >= 1)
    st, rows = s.run("select id from public.lessons where is_preview = true", role="anon")
    legit("R3-anon-preview-lessons", "…and free preview lessons", st, rows)
    st, rows = s.run("select id, rating from public.course_reviews", role="anon")
    legit("R4-anon-reviews", "…and course reviews", st, rows)
    st, rows = s.run("select * from public.my_profile()", uid=F["A"])   # 0025: own profile now comes via my_profile()
    legit("R5-own-profile-select-star", "Logged-in user can still load their full own profile", st, rows, lambda r: len(r) == 1)
    st, rows = s.run("select email, state_region, lga from public.profile_contacts(array[%s::uuid])", (F["A"],), uid=F["I"])   # 0025: via the permission-checked function
    legit("R6-staff-read-profiles", "Instructor pages can still read their own learners' contact fields", st, rows, lambda r: len(r) > 0)
    st, rows = s.run("select id, role::text from public.profiles", uid=F["M"])
    legit("R7-admin-users-page", "Admin users page can still list users", st, rows, lambda r: len(r) > 0)
    st, rows = s.run("select title from public.lessons", uid=F["A"])
    legit("R8-enrolled-lessons", "Enrolled student can still read their course's lessons", st, rows, lambda r: len(r) >= 2)
    st, rows = s.run("select id, progress_percent from public.enrollments", uid=F["A"])
    legit("R9-own-enrolments", "Student dashboard can still read own enrolments", st, rows, lambda r: len(r) >= 1)
    st, rows = s.run("select balance from public.w3tr_wallets where profile_id=%s", (F["A"],), uid=F["A"])
    legit("R10-own-wallet", "Student can still read own wallet balance", st, rows, lambda r: len(r) == 1)
    st, rows = s.run("select amount, type::text from public.w3tr_transactions where profile_id=%s", (F["A"],), uid=F["A"])
    legit("R11-own-ledger", "Student can still read own transaction history", st, rows)
    st, rows = s.run("select id, name from public.categories", role="anon")
    legit("R12-anon-categories", "Homepage categories still readable by visitors", st, rows)
    st, rows = s.run("select headline, verification_status::text from public.instructor_profiles", role="anon")
    legit("R13-anon-instructor-profile", "Public instructor headline still readable", st, rows)
    st, rows = s.run("select verification_document_url, verification_notes from public.instructor_profiles", role="anon")
    attack("F4-instructor-docs", "ANONYMOUS caller reads instructor verification documents / admin notes", st, rows)
    st, rows = s.run("select verification_notes from public.instructor_profiles", uid=F["B"])
    attack("F4-instructor-docs-auth", "Any logged-in user reads instructor verification documents / admin notes", st, rows)


    # ------------------------------------------------------------------ 0023: edits to a LIVE course go back to admin review
    def live_course(tag, instructor=None):
        """A fresh PUBLISHED, previously-approved course (+ section, lesson, resources, quiz, question, assignment) owned by instructor I."""
        inst = instructor or F["I"]
        def mk(sql, params):
            st, rows = s.run(sql, params, role="postgres")
            assert st == "OK", rows
            return rows[0][0]
        c = mk("insert into public.courses (instructor_id,title,slug,status,price_w3tr,reviewed_at,review_notes) values (%s,%s,%s,'published',10,now(),'approved') returning id", (inst, f"Live {tag}", f"live-{tag}"))
        sec = mk("insert into public.course_sections (course_id,title) values (%s,'S') returning id", (c,))
        les = mk("insert into public.lessons (section_id,course_id,title) values (%s,%s,'L') returning id", (sec, c))
        qz = mk("insert into public.quizzes (course_id,title) values (%s,'Q') returning id", (c,))
        qq = mk("insert into public.quiz_questions (quiz_id,question_text,correct_answer) values (%s,'?','\"a\"'::jsonb) returning id", (qz,))
        lr = mk("insert into public.lesson_resources (lesson_id,title,file_url) values (%s,'R','u') returning id", (les,))
        cr = mk("insert into public.course_resources (course_id,title,file_url) values (%s,'R','u') returning id", (c,))
        asg = mk("insert into public.assignments (course_id,title) values (%s,'A') returning id", (c,))
        return dict(c=c, sec=sec, les=les, qz=qz, qq=qq, lr=lr, cr=cr, asg=asg)

    def status_of(c):
        return s.run("select status::text from public.courses where id=%s", (c,), role="postgres")[1][0][0]

    def edit_attack(i, title, tag, sql, params_fn, who="I"):
        """The edit is the 'attack': it is EXPLOITABLE if it goes through while the course stays published (no review)."""
        L = live_course(tag)
        st, res = s.run(sql, params_fn(L), uid=F[who])
        if st == "OK" and status_of(L["c"]) == "published":
            add(i, "attack", title, "EXPLOITABLE", "edit accepted, course still published")
        else:
            add(i, "attack", title, "BLOCKED", "course sent back to review" if st == "OK" else res)

    edit_attack("E-title", "Instructor changes the TITLE of a live course", "title", "update public.courses set title='Changed after approval' where id=%s", lambda L: (L["c"],))
    edit_attack("E-price", "Instructor changes the PRICE of a live course", "price", "update public.courses set price_w3tr=0 where id=%s", lambda L: (L["c"],))
    edit_attack("E-description", "Instructor changes the DESCRIPTION of a live course", "desc", "update public.courses set description='new text' where id=%s", lambda L: (L["c"],))
    edit_attack("E-thumbnail", "Instructor changes the THUMBNAIL of a live course", "thumb", "update public.courses set thumbnail_url='https://x/y.png' where id=%s", lambda L: (L["c"],))
    edit_attack("E-section-add", "Instructor ADDS a section to a live course", "secadd", "insert into public.course_sections (course_id,title) values (%s,'New') returning id", lambda L: (L["c"],))
    edit_attack("E-section-edit", "Instructor RENAMES a section of a live course", "secedit", "update public.course_sections set title='Renamed' where id=%s", lambda L: (L["sec"],))
    edit_attack("E-lesson-add", "Instructor ADDS a lesson to a live course", "lesadd", "insert into public.lessons (section_id,course_id,title) values (%s,%s,'New lesson') returning id", lambda L: (L["sec"], L["c"]))
    edit_attack("E-lesson-edit", "Instructor EDITS a lesson of a live course", "lesedit", "update public.lessons set title='Edited lesson', content_url='https://x/v.mp4' where id=%s", lambda L: (L["les"],))
    edit_attack("E-lesson-delete", "Instructor DELETES a lesson of a live course", "lesdel", "delete from public.lessons where id=%s", lambda L: (L["les"],))
    edit_attack("E-lesson-resource", "Instructor adds a lesson RESOURCE to a live course", "lres", "insert into public.lesson_resources (lesson_id,title,file_url) values (%s,'New','u') returning id", lambda L: (L["les"],))
    edit_attack("E-lesson-resource-del", "Instructor deletes a lesson resource of a live course", "lresdel", "delete from public.lesson_resources where id=%s", lambda L: (L["lr"],))
    edit_attack("E-course-resource", "Instructor adds a course RESOURCE to a live course", "cres", "insert into public.course_resources (course_id,title,file_url) values (%s,'New','u') returning id", lambda L: (L["c"],))
    edit_attack("E-quiz-add", "Instructor ADDS a quiz to a live course", "quizadd", "insert into public.quizzes (course_id,title) values (%s,'New quiz') returning id", lambda L: (L["c"],))
    edit_attack("E-question-add", "Instructor ADDS a quiz question to a live course", "qadd", "insert into public.quiz_questions (quiz_id,question_text,correct_answer) values (%s,'New?','\"b\"'::jsonb) returning id", lambda L: (L["qz"],))
    edit_attack("E-question-edit", "Instructor CHANGES a quiz question's answer on a live course", "qedit", "update public.quiz_questions set correct_answer='\"c\"'::jsonb where id=%s", lambda L: (L["qq"],))
    edit_attack("E-question-delete", "Instructor DELETES a quiz question of a live course", "qdel", "delete from public.quiz_questions where id=%s", lambda L: (L["qq"],))
    edit_attack("E-assignment", "Instructor adds an ASSIGNMENT to a live course", "asg", "insert into public.assignments (course_id,title) values (%s,'New HW') returning id", lambda L: (L["c"],))

    L = live_course("feature")
    st, rows = s.run("update public.courses set is_featured=true where id=%s returning id", (L["c"],), uid=F["I"])
    attack("E-feature", "Instructor features their OWN course (a staff-only decision)", st, rows, lambda r: len(r) == 1)
    st, rows = s.run("update public.courses set is_featured=true where id=%s returning id", (L["c"],), uid=F["M"])
    legit("E-legit-feature-staff", "An admin can still feature a course", st, rows, lambda r: len(r) == 1)

    # ---- what the flip must DO ----
    L = live_course("flipfx")
    s.run("update public.courses set title='Live flipfx (edited)' where id=%s", (L["c"],), uid=F["I"], fetch=False)
    st, rows = s.run("select status::text, reviewed_at is null, review_notes is null from public.courses where id=%s", (L["c"],), role="postgres")
    legit("E-legit-flip-state", "After an edit: status is pending_review and the old approval is cleared", st, rows,
          lambda r: r[0][0] == "pending_review" and r[0][1] is True and r[0][2] is True)
    def n(profile, ttl):
        return s.run("select count(*) from public.notifications where profile_id=%s and title=%s and body like %s", (profile, ttl, "%Live flipfx%"), role="postgres")[1][0][0]
    got = (n(F["I"], "Course resubmitted for review"), n(F["M"], "Course needs re-review"), n(F["SA"], "Course needs re-review"), n(F["MOD"], "Course needs re-review"), n(F["A"], "Course needs re-review"))
    legit("E-legit-notify", "…the instructor and every admin/super admin are notified once (not moderators or students)", "OK", got, lambda g: g == (1, 1, 1, 0, 0))
    s.run("update public.courses set title='Live flipfx (edited again)' where id=%s", (L["c"],), uid=F["I"], fetch=False)
    s.run("insert into public.lessons (section_id,course_id,title) values (%s,%s,'one more')", (L["sec"], L["c"]), uid=F["I"], fetch=False)
    got2 = (n(F["I"], "Course resubmitted for review"), n(F["M"], "Course needs re-review"), n(F["SA"], "Course needs re-review"))
    legit("E-legit-no-spam", "…and further edits while it is already pending do not send more notifications", "OK", got2, lambda g: g == (1, 1, 1))
    st, rows = s.run("update public.courses set status='published' where id=%s returning status::text", (L["c"],), uid=F["MOD"])
    legit("E-legit-reapprove", "A moderator can approve the edited course again", st, rows, lambda r: r[0][0] == "published")
    s.run("update public.courses set price_w3tr=77 where id=%s", (L["c"],), uid=F["I"], fetch=False)
    legit("E-legit-cycle", "…and a later edit by the instructor sends it back to review again", "OK", status_of(L["c"]), lambda v: v == "pending_review")

    # ---- what the rule must NOT touch ----
    L = live_course("draft")
    s.run("update public.courses set status='draft' where id=%s", (L["c"],), role="postgres", fetch=False)
    s.run("update public.courses set title='Still a draft' where id=%s", (L["c"],), uid=F["I"], fetch=False)
    legit("E-legit-draft", "Editing a DRAFT course leaves it a draft (no review, no notifications)", "OK", status_of(L["c"]), lambda v: v == "draft")

    L = live_course("noop")
    st, rows = s.run("update public.courses set title=title where id=%s returning id", (L["c"],), uid=F["I"])
    legit("E-legit-noop", "Saving a live course without changing anything does not trigger review", st, rows, lambda r: status_of(L["c"]) == "published")

    for who, label in (("MOD", "A moderator"), ("M", "An admin")):
        L = live_course("staff" + who)
        st, rows = s.run("update public.courses set title='Staff edit' where id=%s returning id", (L["c"],), uid=F[who])
        legit(f"E-legit-staff-{who}", f"{label} editing a live course does NOT send it to review (they are the review)", st, rows, lambda r: len(r) == 1 and status_of(L["c"]) == "published")
        if who == "M":   # (only admins and the course's instructor may write lessons — moderators cannot, by existing policy)
            st, rows = s.run("insert into public.lessons (section_id,course_id,title) values (%s,%s,'staff lesson') returning id", (L["sec"], L["c"]), uid=F[who])
            legit(f"E-legit-staff-lesson-{who}", f"{label} adding a lesson does NOT send it to review", st, rows, lambda r: status_of(L["c"]) == "published")

    L = live_course("counters")
    s.run("insert into public.enrollments (student_id,course_id) values (%s,%s)", (F["A"], L["c"]), role="service_role", fetch=False)
    legit("E-legit-counter-enrol", "A student enrolling (enrolment counter changes) does NOT send the course to review", "OK", status_of(L["c"]), lambda v: v == "published")
    s.run("insert into public.course_reviews (course_id, student_id, rating) values (%s,%s,5)", (L["c"], F["A"]), uid=F["A"], fetch=False)
    s.run("insert into public.course_reviews (course_id, student_id, rating) values (%s,%s,5)", (L["c"], F["A"]), role="service_role", fetch=False)
    legit("E-legit-counter-rating", "A student leaving a rating (rating counters change) does NOT send it to review", "OK", status_of(L["c"]), lambda v: v == "published")
    ea = s.run("select id from public.enrollments where student_id=%s and course_id=%s", (F["A"], L["c"]), role="postgres")[1][0][0]
    s.run("select (public.complete_lesson(%s,%s)).is_completed", (ea, L["les"]), role="service_role", fetch=False)
    legit("E-legit-counter-complete", "A student completing the course (completion counter) does NOT send it to review", "OK", status_of(L["c"]), lambda v: v == "published")

    L = live_course("access")
    s.run("insert into public.enrollments (student_id,course_id) values (%s,%s)", (F["A"], L["c"]), role="service_role", fetch=False)
    s.run("update public.courses set title='Edited while students are enrolled' where id=%s", (L["c"],), uid=F["I"], fetch=False)
    st, rows = s.run("select id from public.lessons where course_id=%s", (L["c"],), uid=F["A"])
    legit("E-legit-enrolled-access", "Already-enrolled students keep access to the lessons while the course is back in review", st, rows,
          lambda r: len(r) >= 1 and status_of(L["c"]) == "pending_review")
    st, rows = s.run("select id from public.courses where id=%s and status='published'", (L["c"],), role="anon")
    attack("E-hidden-from-catalogue", "The course is STILL visible in the public catalogue while it is in review", st, rows, lambda r: len(r) > 0)


    # ================================================================== 0024: BugBunny report cc6b1c2
    pg = lambda sql, p=(): s.run(sql, p, role="postgres")
    def one0(sql, p=()):
        st, rows = pg(sql, p)
        assert st == "OK", rows
        return rows[0][0]

    # ---- #1 students must not be able to author courses ----
    st, rows = s.run("insert into public.courses (instructor_id,title,slug,status) values (%s,'Farm','farm-1','draft') returning id", (F["B"],), uid=F["B"])
    attack("G1-student-creates-course", "A STUDENT creates their own course", st, rows)
    mine = one0("insert into public.courses (instructor_id,title,slug,status) values (%s,'B-owned','b-owned','draft') returning id", (F["B"],))
    msec = one0("insert into public.course_sections (course_id,title) values (%s,'s') returning id", (mine,))
    st, rows = s.run("insert into public.course_sections (course_id,title) values (%s,'s2') returning id", (mine,), uid=F["B"])
    attack("G1-student-section", "A student adds a section to a course row they own", st, rows)
    st, rows = s.run("insert into public.lessons (section_id,course_id,title) values (%s,%s,'x') returning id", (msec, mine), uid=F["B"])
    attack("G1-student-lesson", "A student adds a lesson to a course row they own", st, rows)
    st, rows = s.run("insert into public.quizzes (course_id,title) values (%s,'q') returning id", (mine,), uid=F["B"])
    attack("G1-student-quiz", "A student adds a quiz to a course row they own", st, rows)
    st, rows = s.run("insert into public.course_resources (course_id,title,file_url) values (%s,'r','https://x/y.pdf') returning id", (mine,), uid=F["B"])
    attack("G1-student-resource", "A student attaches a resource to a course row they own", st, rows)
    st, rows = s.run("insert into public.courses (instructor_id,title,slug,status) values (%s,'Mine','inst-new','draft') returning id", (F["I"],), uid=F["I"])
    legit("G1-legit-instructor-course", "An instructor can still create a course", st, rows, lambda r: len(r) == 1)
    new_c = rows[0][0] if st == "OK" else None
    st, rows = s.run("insert into public.course_sections (course_id,title) values (%s,'s') returning id", (new_c,), uid=F["I"])
    legit("G1-legit-instructor-section", "…and add sections", st, rows, lambda r: len(r) == 1)
    nsec = rows[0][0] if st == "OK" else None
    st, rows = s.run("insert into public.lessons (section_id,course_id,title) values (%s,%s,'Lesson') returning id", (nsec, new_c), uid=F["I"])
    legit("G1-legit-instructor-lesson", "…and lessons", st, rows, lambda r: len(r) == 1)
    st, rows = s.run("insert into public.quizzes (course_id,title) values (%s,'Quiz') returning id", (new_c,), uid=F["I"])
    legit("G1-legit-instructor-quiz", "…and quizzes", st, rows, lambda r: len(r) == 1)

    # ---- #1 reward amounts are not author-controlled ----
    st, rows = s.run("insert into public.lessons (section_id,course_id,title,w3tr_reward) values (%s,%s,'Rich',9999) returning w3tr_reward", (nsec, new_c), uid=F["I"])
    attack("G2-lesson-reward-insert", "Instructor creates a lesson paying 9,999 W3TR", st, rows, lambda r: float(r[0][0]) > 1)
    st, rows = s.run("insert into public.quizzes (course_id,title,w3tr_reward) values (%s,'RichQ',9999) returning w3tr_reward", (new_c,), uid=F["I"])
    attack("G2-quiz-reward-insert", "Instructor creates a quiz paying 9,999 W3TR", st, rows, lambda r: float(r[0][0]) > 2)
    st, rows = s.run("update public.lessons set w3tr_reward=5000 where id=%s returning w3tr_reward", (F["L1"],), uid=F["I"])
    attack("G2-lesson-reward-update", "Instructor raises an existing lesson's reward to 5,000", st, rows, lambda r: len(r) == 1 and float(r[0][0]) > 1)
    st, rows = s.run("update public.lessons set w3tr_reward=7 where id=%s returning w3tr_reward", (F["L3"],), uid=F["M"])
    legit("G2-legit-admin-reward", "An admin can still change a lesson's reward", st, rows, lambda r: float(r[0][0]) == 7)

    # ---- #1 rewards: once per item, never on own / unpublished course ----
    qid = one0("insert into public.quizzes (course_id,title,is_final_exam) values (%s,'Farm quiz',false) returning id", (F["C1"],))
    bal = lambda u: float(one0("select coalesce((select balance from public.w3tr_wallets where profile_id=%s),0)", (u,)))
    b0 = bal(F["B"])
    s.run("select public.award_w3tr(%s,'quiz_pass',2,'quizzes',%s,'p1',null)", (F["B"], qid), role="service_role", fetch=False)
    legit("G3-legit-first-reward", "A learner's first pass of a quiz is rewarded", "OK", bal(F["B"]) - b0, lambda d: d == 2)
    for _ in range(3):
        s.run("select public.award_w3tr(%s,'quiz_pass',2,'quizzes',%s,'again',null)", (F["B"], qid), role="service_role", fetch=False)
    attack("G3-repeat-reward", "Passing the SAME quiz again keeps paying out", "OK", bal(F["B"]) - b0, lambda d: d > 2)
    s.run("select public.award_w3tr(%s,'lesson_complete',1,'lessons',%s,'l',null)", (F["B"], F["L1"]), role="service_role", fetch=False)
    b1 = bal(F["B"])
    s.run("select public.award_w3tr(%s,'lesson_complete',1,'lessons',%s,'l again',null)", (F["B"], F["L1"]), role="service_role", fetch=False)
    attack("G3-repeat-lesson", "Completing the same lesson again keeps paying out", "OK", bal(F["B"]) - b1, lambda d: d > 0)
    ownq = one0("insert into public.quizzes (course_id,title) values (%s,'own quiz') returning id", (F["C1"],))
    i0 = bal(F["I"])
    s.run("select public.award_w3tr(%s,'quiz_pass',2,'quizzes',%s,'own',null)", (F["I"], ownq), role="service_role", fetch=False)
    attack("G3-own-course", "An instructor earns rewards by passing their OWN course's quiz", "OK", bal(F["I"]) - i0, lambda d: d > 0)
    dq = one0("insert into public.quizzes (course_id,title) values (%s,'draft quiz') returning id", (mine,))
    b2 = bal(F["B"])
    s.run("select public.award_w3tr(%s,'quiz_pass',2,'quizzes',%s,'draft',null)", (F["A"], dq), role="service_role", fetch=False)
    a2 = bal(F["A"])
    s.run("select public.award_w3tr(%s,'quiz_pass',2,'quizzes',%s,'draft',null)", (F["B"], dq), role="service_role", fetch=False)
    attack("G3-draft-course", "Rewards are paid on a DRAFT (never published) course", "OK", bal(F["B"]) - b2, lambda d: d > 0)
    st, rows = s.run("select (public.award_w3tr(%s,'quiz_pass',2,'quizzes',%s,'x',null)).amount", (F["B"], qid), uid=F["B"])
    attack("G3-rpc-direct", "Logged-in student calls award_w3tr directly", st, rows)

    # ---- #4 certificates ----
    def cert_course(tag, verified, status="published", questions=10, passed=True, own=False, exam=True):
        inst = one0("select id from auth.users where email=%s", (f"{tag}-inst@t.test",)) if False else pgh.signup(db, f"{tag}-inst@t.test", {"role": "instructor", "full_name": tag})
        if verified:
            pg("update public.profiles set is_instructor_verified=true where id=%s", (inst,))
        c = one0("insert into public.courses (instructor_id,title,slug,status) values (%s,%s,%s,%s) returning id", (inst, tag, f"cert-{tag}", status))
        stu = inst if own else F["A"]
        pg("insert into public.enrollments (student_id,course_id,status) values (%s,%s,'completed') on conflict do nothing", (stu, c))
        if exam:
            q = one0("insert into public.quizzes (course_id,title,is_final_exam) values (%s,'Final',true) returning id", (c,))
            for n in range(questions):
                pg("insert into public.quiz_questions (quiz_id,question_text,correct_answer) values (%s,%s,'\"a\"'::jsonb)", (q, f"Q{n}"))
            if passed:
                pg("insert into public.quiz_attempts (quiz_id,student_id,status,passed,score_percent) values (%s,%s,'graded',true,100)", (q, stu))
        return c, stu
    def reason(c, stu):
        st, rows = s.run("select public.certificate_block_reason(%s,%s,10)", (stu, c), role="service_role")
        return rows[0][0] if st == "OK" else "ERROR " + str(rows)
    for tag, kw, title in [
        ("unver", dict(verified=False), "Certificate for a course whose instructor is NOT verified"),
        ("draftc", dict(verified=True, status="draft"), "Certificate for a DRAFT course"),
        ("noexam", dict(verified=True, exam=False), "Certificate for a course with NO final exam"),
        ("oneq", dict(verified=True, questions=1), "Certificate after a 1-question 'final exam'"),
        ("nopass", dict(verified=True, passed=False), "Certificate without passing the final exam"),
        ("selfc", dict(verified=True, own=True), "Instructor earns a certificate for their own course"),
    ]:
        c, stu = cert_course(tag, **kw)
        attack(f"G4-{tag}", title, "OK", reason(c, stu), lambda r: r is None)
    c, stu = cert_course("goodc", verified=True)
    legit("G4-legit-eligible", "A completed, verified, published course with a real passed final exam IS eligible", "OK", reason(c, stu), lambda r: r is None)

    # ---- #3 paid documents ----
    rc = one0("insert into public.course_resources (course_id,title,file_url) values (%s,'Paid notes',%s) returning id", (F["C2"], "https://x.supabase.co/storage/v1/object/public/course-documents/paid-notes.pdf"))
    st, rows = s.run("select file_url from public.course_resources", role="anon")
    attack("G5-anon-resources", "ANONYMOUS caller reads paid-course resource file links", st, rows, lambda r: len(r) > 0)
    st, rows = s.run("select file_url from public.course_resources", uid=F["B"])
    attack("G5-other-student-resources", "A non-enrolled student reads paid-course resource file links", st, rows, lambda r: len(r) > 0)
    pg("insert into public.enrollments (student_id,course_id) values (%s,%s) on conflict do nothing", (F["A"], F["C2"]))
    st, rows = s.run("select file_url from public.course_resources where course_id=%s", (F["C2"],), uid=F["A"])
    legit("G5-legit-enrolled", "An ENROLLED student still sees the course's resources", st, rows, lambda r: len(r) == 1)
    st, rows = s.run("select file_url from public.course_resources where course_id=%s", (F["C2"],), uid=F["J"])
    legit("G5-legit-owner", "The course's instructor still sees their resources", st, rows, lambda r: len(r) == 1)
    st, rows = s.run("select file_url from public.course_resources where course_id=%s", (F["C2"],), uid=F["MOD"])
    legit("G5-legit-moderator", "A moderator still sees resources (review)", st, rows, lambda r: len(r) == 1)
    st, rows = s.run("select public from storage.buckets where id='course-documents'", role="postgres")
    attack("G5-bucket-public", "The course-documents bucket is still PUBLIC (direct URLs work for anyone)", st, rows, lambda r: r and r[0][0] is True)
    st, rows = s.run("select count(*) from pg_policies where schemaname='storage' and policyname='course_documents_public_read'", role="postgres")
    attack("G5-public-read-policy", "The public-read storage policy for course documents still exists", st, rows, lambda r: r[0][0] > 0)

    # ================================================================== 0025: profile privacy (BugBunny finding #2)
    K = pgh.signup(db, "instr-k@t.test", {"full_name": "Instructor K", "role": "instructor"})
    O = pgh.signup(db, "org-owner@t.test", {"full_name": "Org Owner", "role": "organization"})
    X = pgh.signup(db, "member-x@t.test", {"full_name": "Member X"})
    Y = pgh.signup(db, "stranger-y@t.test", {"full_name": "Stranger Y"})
    pg("update public.profiles set phone='+2348000000001', country='Nigeria', state_region='Plateau', lga='Jos North' where id=%s", (F["A"],))
    org = one0("insert into public.organizations (owner_profile_id,name,slug) values (%s,'Org','org-slug') returning id", (O,))
    pg("insert into public.organization_members (organization_id,profile_id) values (%s,%s)", (org, X))
    opp = one0("insert into public.opportunities (organization_id,title) values (%s,'Job') returning id", (org,))
    pg("insert into public.opportunity_applications (opportunity_id,student_id) values (%s,%s)", (opp, F["B"]))

    st, rows = s.run("select email from public.profiles where id=%s", (F["A"],), uid=F["B"])
    attack("H1-read-email", "A student reads another student's EMAIL straight from profiles", st, rows, lambda r: len(r) > 0)
    st, rows = s.run("select phone from public.profiles where id=%s", (F["A"],), uid=F["B"])
    attack("H1-read-phone", "A student reads another student's PHONE", st, rows, lambda r: len(r) > 0)
    st, rows = s.run("select * from public.profiles", uid=F["B"])
    attack("H1-select-star", "A student dumps every profile row with select *", st, rows, lambda r: len(r) > 1)
    st, rows = s.run("select id from public.profiles where email like 'a@%%'", uid=F["B"])
    attack("H1-email-enumeration", "A student probes who has which email by FILTERING on the email column", st, rows, lambda r: len(r) > 0)
    st, rows = s.run("select is_banned from public.profiles where id=%s", (F["A"],), uid=F["B"])
    attack("H1-read-status", "A student reads another user's ban/active status", st, rows, lambda r: len(r) > 0)
    st, rows = s.run("select email from public.profiles", role="anon")
    attack("H1-anon-email", "An ANONYMOUS caller reads emails", st, rows, lambda r: len(r) > 0)
    st, rows = s.run("select * from public.profile_contacts(array[%s::uuid])", (F["A"],), uid=F["B"])
    attack("H2-contacts-stranger", "A student asks the contacts function for another student's details", st, rows, lambda r: len(r) > 0)
    st, rows = s.run("select * from public.profile_contacts(array[%s::uuid])", (F["A"],), uid=K)
    attack("H2-contacts-other-instructor", "An instructor who does NOT teach the student reads their contact details", st, rows, lambda r: len(r) > 0)
    st, rows = s.run("select * from public.profile_contacts(array[%s::uuid])", (F["A"],), uid=O)
    attack("H2-contacts-other-org", "An organization owner reads a learner who is NOT theirs", st, rows, lambda r: len(r) > 0)
    st, rows = s.run("select * from public.profile_contacts(array[%s::uuid])", (Y,), uid=F["I"])
    attack("H2-contacts-unrelated", "An instructor reads a user who never enrolled with them", st, rows, lambda r: len(r) > 0)
    st, rows = s.run("select * from public.profile_contacts(array[%s::uuid])", (F["A"],), role="anon")
    attack("H2-contacts-anon", "ANONYMOUS caller uses the contacts function", st, rows, lambda r: len(r) > 0)
    st, rows = s.run("select * from public.staff_profiles(null, 100)", uid=F["B"])
    attack("H3-staff-student", "A student lists every user through the staff function", st, rows, lambda r: len(r) > 0)
    st, rows = s.run("select * from public.staff_profiles(null, 100)", uid=F["I"])
    attack("H3-staff-instructor", "An instructor lists every user through the staff function", st, rows, lambda r: len(r) > 0)
    st, rows = s.run("select * from public.staff_profiles(null, 100)", role="anon")
    attack("H3-staff-anon", "ANONYMOUS caller lists every user through the staff function", st, rows, lambda r: len(r) > 0)
    st, rows = s.run("select * from public.my_profile()", role="anon")
    attack("H4-myprofile-anon", "ANONYMOUS caller reads a profile through my_profile()", st, rows, lambda r: len(r) > 0)
    st, rows = s.run("select public.can_view_private_profile(%s)", (F["A"],), uid=F["B"])
    attack("H4-internal-fn", "A signed-in user calls the internal permission helper directly", st, rows, lambda r: True)

    st, rows = s.run("select full_name, username, avatar_url, bio, role::text, is_instructor_verified, created_at from public.profiles where id=%s", (F["A"],), uid=F["B"])
    legit("H5-public-columns", "Other people's NAME / username / avatar / bio / role badge remain visible", st, rows, lambda r: len(r) == 1)
    st, rows = s.run("select p.full_name from public.courses c join public.profiles p on p.id=c.instructor_id where c.id=%s", (F["C1"],), uid=F["B"])
    legit("H5-course-instructor-name", "A course page can still show its instructor's name", st, rows, lambda r: len(r) == 1)
    st, rows = s.run("select email, phone, country, state_region, lga, is_banned, theme_preference from public.my_profile()", uid=F["A"])
    legit("H5-my-profile", "You still read your OWN full profile (email, phone, location, settings)", st, rows, lambda r: len(r) == 1 and r[0][0] == "a@t.test" and r[0][1] == "+2348000000001")
    st, rows = s.run("select role::text from public.profiles where id=%s", (F["A"],), uid=F["A"])
    legit("H5-own-role", "The role used for page access is still readable", st, rows, lambda r: r[0][0] == "student")
    st, rows = s.run("select * from public.profile_contacts(array[%s::uuid])", (F["A"],), uid=F["A"])
    legit("H5-contacts-self", "You can fetch your own contact details", st, rows, lambda r: len(r) == 1)
    st, rows = s.run("select email, state_region, lga from public.profile_contacts(array[%s::uuid])", (F["A"],), uid=F["I"])
    legit("H5-instructor-own-student", "An instructor sees the contacts of a learner ENROLLED in their course", st, rows, lambda r: len(r) == 1 and r[0][0] == "a@t.test" and r[0][2] == "Jos North")
    st, rows = s.run("select email from public.profile_contacts(array[%s::uuid])", (X,), uid=O)
    legit("H5-org-member", "An organization owner sees the contacts of their own member", st, rows, lambda r: len(r) == 1)
    st, rows = s.run("select email from public.profile_contacts(array[%s::uuid])", (F["B"],), uid=O)
    legit("H5-org-applicant", "An organization owner sees the contacts of someone who applied to their opportunity", st, rows, lambda r: len(r) == 1)
    st, rows = s.run("select email from public.profile_contacts(array[%s::uuid, %s::uuid])", (F["A"], Y), uid=F["MOD"])
    legit("H5-moderator", "A moderator can see contact details of any user", st, rows, lambda r: len(r) == 2)
    st, rows = s.run("select email, role::text, is_banned from public.staff_profiles(null, 100)", uid=F["M"])
    legit("H5-admin-list", "An admin still lists every user with email and status", st, rows, lambda r: len(r) >= 8)
    st, rows = s.run("select email from public.staff_profiles('student a', 10)", uid=F["M"])
    legit("H5-admin-search", "An admin can search users by name", st, rows, lambda r: len(r) == 1 and r[0][0] == "a@t.test")
    st, n = s.run("update public.profiles set full_name='Student A2', bio='hello', state_region='Lagos' where id=%s", (F["A"],), uid=F["A"], fetch=False)
    legit("H5-update-own", "You can still edit your own name, bio and location", st, n, lambda r: r == 1)
    st, n = s.run("update public.profiles set is_banned=true, ban_reason='test' where id=%s", (F["B"],), uid=F["M"], fetch=False)
    legit("H5-admin-ban", "An admin can still ban a user", st, n, lambda r: r == 1)
    st, rows = s.run("select id from public.profiles where role in ('admin','super_admin')", uid=F["B"])
    legit("H5-notify-admins", "Looking up which users are admins (for notifications) still works", st, rows, lambda r: len(r) >= 2)

    return R

def report(R, phase):
    attacks = [r for r in R if r[1] == "attack"]
    legits = [r for r in R if r[1] == "legit"]
    exploitable = [r for r in attacks if r[3] == "EXPLOITABLE"]
    broken = [r for r in legits if r[3] == "BROKEN"]
    print(f"\n==================== {phase.upper()} ====================")
    print(f"ATTACKS replayed: {len(attacks)}   exploitable: {len(exploitable)}   blocked: {len(attacks)-len(exploitable)}")
    print(f"LEGIT-USE checks: {len(legits)}   working: {len(legits)-len(broken)}   broken: {len(broken)}")
    return exploitable, broken
