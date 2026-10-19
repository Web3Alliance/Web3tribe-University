-- =====================================================================================
-- POST-INCIDENT CHECKS — "did anyone use the holes before they were closed?"
-- =====================================================================================
-- Context: the BugBunny audit (11 Oct 2026) showed that, until migration 0022 is applied,
-- anyone could create super_admins, mint W3TR, forge enrolments, etc. This script is
-- READ-ONLY. Paste it into the Supabase SQL editor (runs as `postgres`) and run each
-- numbered block separately. Every block returns rows ONLY when something looks wrong;
-- an empty result is the good outcome.
--
-- Expect noise from the audit itself: BugBunny's test accounts (…@maxxspace.com) and the
-- append-only ledger rows its report says it left behind. Those are listed in block 0 so
-- you can tell them apart from anything else.
--
-- IMPORTANT: these find *evidence in your data*. They cannot see reads (e.g. someone
-- listing the user table). For that, use Supabase → Logs → API Edge / Postgres logs and
-- look at anonymous requests to /rest/v1/profiles, /rest/v1/certificates, /rpc/* and
-- /storage/v1/object/list/* around and before 11 Oct 2026.
-- =====================================================================================


-- 0. The audit's own footprint (so you can recognise and discount it) -----------------------
select 'audit test accounts' as check_name, id, email, role, created_at
from public.profiles
where email ilike '%@maxxspace.com'
order by created_at;


-- 1. Privileged accounts: every moderator / admin / super_admin that exists ------------------
--    Action: every row should be someone you know. Anything else -> demote + investigate.
select 'privileged account' as check_name, id, email, full_name, role, created_at, is_active
from public.profiles
where role in ('moderator', 'admin', 'super_admin')
order by created_at;


-- 2. Sign-ups that ASKED for a privileged role in their metadata (finding 1) -----------------
--    Action: a hit means someone used the signup hole. Check whether that account is still
--    privileged (block 1) and what it did (blocks 4-9, and public.audit_logs).
select 'signup requested privileged role' as check_name,
       u.id, u.email, u.created_at, u.raw_user_meta_data ->> 'role' as requested_role, p.role as current_role
from auth.users u
left join public.profiles p on p.id = u.id
where u.raw_user_meta_data ? 'role'
  and u.raw_user_meta_data ->> 'role' not in ('student', 'instructor', 'organization')
order by u.created_at;


-- 3. Accounts whose role no longer matches what they signed up as (finding 2: self-promotion) --
--    Normal for staff you promoted yourself; a stranger here is not.
select 'role differs from signup' as check_name,
       p.id, p.email, p.role as current_role,
       coalesce(u.raw_user_meta_data ->> 'role', 'student') as signup_role, p.created_at
from public.profiles p
join auth.users u on u.id = p.id
where p.role::text <> coalesce(nullif(u.raw_user_meta_data ->> 'role', ''), 'student')
order by p.created_at;


-- 4. W3TR created or removed with nobody accountable (finding 3) -----------------------------
--    Legit admin grants record the admin in `awarded_by`; anonymous RPC calls leave it empty.
select 'ledger entry with no awarded_by' as check_name, t.id, t.profile_id, p.email, t.type, t.amount, t.description, t.created_at
from public.w3tr_transactions t
left join public.profiles p on p.id = t.profile_id
where t.type in ('admin_grant', 'admin_deduction') and t.awarded_by is null
order by t.created_at;


-- 5. Wallet balance that does not equal the sum of its own ledger ------------------------------
--    Every change goes through the ledger, so any difference means a balance was tampered with.
select 'wallet != ledger' as check_name, w.profile_id, p.email, w.balance as wallet_balance,
       coalesce(sum(t.amount), 0) as ledger_total
from public.w3tr_wallets w
left join public.w3tr_transactions t on t.profile_id = w.profile_id
left join public.profiles p on p.id = w.profile_id
group by w.profile_id, p.email, w.balance
having w.balance <> coalesce(sum(t.amount), 0);


-- 6. Biggest single credits (eyeball for anything absurd) -------------------------------------
select 'largest credits' as check_name, t.id, p.email, t.type, t.amount, t.awarded_by, t.created_at
from public.w3tr_transactions t
left join public.profiles p on p.id = t.profile_id
where t.amount > 0
order by t.amount desc
limit 15;


-- 7. Paid courses entered without paying (finding 5) --------------------------------------------
--    A paid enrolment normally has a matching 'spend' ledger entry. Enrolments added by an
--    organisation/admin on purpose will also show up here — judge each one.
select 'paid enrolment with no payment' as check_name, e.id as enrollment_id, p.email, c.title, c.price_w3tr, e.status, e.enrolled_at
from public.enrollments e
join public.courses c on c.id = e.course_id
join public.profiles p on p.id = e.student_id
where c.price_w3tr > 0
  and not exists (
    select 1 from public.w3tr_transactions t
    where t.profile_id = e.student_id and t.type = 'spend'
      and ((t.reference_table = 'courses' and t.reference_id = c.id)
        or (t.reference_table = 'cohorts' and t.reference_id = e.cohort_id))
  )
order by e.enrolled_at;


-- 8. "Completed" enrolments that did not actually complete the lessons (finding 5) --------------
select 'completed without the lessons' as check_name, e.id as enrollment_id, p.email, c.title,
       e.progress_percent,
       (select count(*) from public.lesson_progress lp where lp.enrollment_id = e.id and lp.is_completed) as lessons_done,
       (select count(*) from public.lessons l where l.course_id = e.course_id) as lessons_in_course
from public.enrollments e
join public.courses c on c.id = e.course_id
join public.profiles p on p.id = e.student_id
where (e.status = 'completed' or e.progress_percent >= 100)
  and (select count(*) from public.lesson_progress lp where lp.enrollment_id = e.id and lp.is_completed)
      < (select count(*) from public.lessons l where l.course_id = e.course_id);


-- 9. Passed quiz / final-exam attempts that carry no answers (a forged row has none) -------------
select 'passed attempt with no answers' as check_name, a.id, p.email, a.quiz_id, a.score_percent, a.submitted_at
from public.quiz_attempts a
join public.profiles p on p.id = a.student_id
where a.passed
  and (a.answers is null or a.answers::text in ('{}', '[]', 'null'));


-- 10. Certificates that may be unearned ----------------------------------------------------------
--     Issued for an enrolment with no completed lessons at all. Review, and revoke if unearned:
--       update public.certificates set revoked = true, revoked_reason = 'issued without completion' where id = '<id>';
select 'certificate for enrolment with no lessons done' as check_name, c.certificate_code, c.student_name_snapshot,
       c.course_title_snapshot, c.issued_at, c.revoked
from public.certificates c
where not exists (
  select 1 from public.lesson_progress lp where lp.enrollment_id = c.enrollment_id and lp.is_completed
)
order by c.issued_at;


-- 11. Courses that went live with no moderation record (instructor self-publish) ------------------
select 'published without any moderation record' as check_name, c.id, c.title, c.instructor_id, pr.email as instructor_email, c.published_at
from public.courses c
left join public.profiles pr on pr.id = c.instructor_id
where c.status = 'published'
  and not exists (select 1 from public.course_moderation_log m where m.course_id = c.id)
order by c.published_at;


-- 12. Everyone currently marked as a verified instructor (confirm each was really verified) ---------
select 'verified instructor' as check_name, ip.profile_id, p.email, ip.verification_status, ip.average_rating, ip.total_students, ip.updated_at
from public.instructor_profiles ip
join public.profiles p on p.id = ip.profile_id
where ip.verification_status = 'verified' or p.is_instructor_verified
order by ip.updated_at desc;


-- 13. Confirmed donations with no payment reference (forged "confirmed" rows inflate admin totals) ---
select 'confirmed donation, no provider reference' as check_name, id, donor_email, amount, currency, method, created_at, confirmed_at
from public.donations
where status = 'confirmed' and provider_reference is null and method <> 'manual'
order by created_at;


-- 14. Avatar files placed in someone else's folder (finding 7) -----------------------------------------
select 'avatar outside owner folder' as check_name, name, owner, created_at
from storage.objects
where bucket_id = 'avatars'
  and owner is not null
  and (storage.foldername(name))[1] is distinct from owner::text;


-- 15. Admin actions on record (use to reconstruct what a rogue admin did) -------------------------------
select 'recent audit log' as check_name, l.created_at, p.email as actor, l.action, l.target_table, l.target_id, l.metadata
from public.audit_logs l
left join public.profiles p on p.id = l.actor_profile_id
order by l.created_at desc
limit 50;
