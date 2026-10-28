# Security remediation — BugBunny audit, October 2026

Audit: BugBunny report `8B95F5C6EE32` (11 Oct 2026, black-box, 7 findings: 1 critical, 4 high, 2 low).
All seven were **confirmed in this repository's source**, not just in the report, and a code review
found further holes of the same kind (listed below). Fix = migration `0022_security_hardening.sql`
+ the application changes in this commit.

## What was wrong, and what changed

| # | Finding | Cause in this repo | Fix |
|---|---|---|---|
| 1 | Sign up as `super_admin` | `handle_new_auth_user` cast `raw_user_meta_data->>'role'` straight into `profiles.role` | Allow-list (`student`/`instructor`/`organization`); anything else becomes `student`. An invalid value no longer crashes sign-up. |
| 2 | Self-promotion to super_admin | `profiles_update_own` limited rows, never columns | `protect_profile_columns` trigger: role, email, ban/active flags, verification and 2FA flags are read-only for users; role changes follow a hierarchy (below). |
| 3 | Anonymous reward/progress RPCs | `award_w3tr`, `spend_w3tr`, `complete_lesson`, `record_daily_login`, `increment_campaign_raised` were executable by everyone and trusted caller-supplied ids | `EXECUTE` revoked from `anon`/`authenticated`; only the server (service role) can call them. `RewardEngine` now runs them with the server key. New functions are server-only by default. |
| 4 | Anonymous data exposure | `profiles` `using (true)`; `certificates` policy had `or true`; leaderboard view, admin config tables and storage listing open | Anonymous visitors see only `id, full_name, username, avatar_url` of a profile. Certificates, leaderboard, `system_settings`/`feature_flags`/`reward_rules` and instructor verification documents/notes are closed. Storage listing closed (public file URLs still work). |
| 5 | Forged enrolment / progress | Student write policies on `enrollments`, `lesson_progress`, `quiz_attempts` | Writes are server-only. Enrolment actions verify the course is published; lesson completion goes through `lib/lesson-completion.ts`; quiz attempts require enrolment. |
| 6 | Admin pages sent data to students before redirecting | Role check lived only in layouts; the proxy only checked login | The proxy (`lib/supabase/middleware.ts` + `lib/route-access.ts`) now enforces the role before any page or action runs. |
| 7 | Storage `move` into another user's folder | `UPDATE` policy had no `WITH CHECK` | `WITH CHECK` pins non-admins to their own `<user-id>/` folder. |

### Further holes found in the code review (not in the report)

* **Admin → super_admin:** `updateUserRoleAction` accepted any role from any admin. Now only a super admin may grant/revoke admin-tier roles, nobody can change their own role, and an admin cannot ban an admin. Enforced in `lib/admin-policy.ts` **and** in the database trigger.
* **Certificate forgery chain** (the audit deliberately did not run it): forge an enrolment, forge a passed final-exam `quiz_attempts` row, then mint a certificate for a paid course. Closed by the server-only writes above.
* `completeLessonAction` never checked the enrolment belonged to the caller; `complete_lesson` accepted a lesson from a different course. Both fixed.
* Instructors could publish their own courses (bypassing moderation), self-verify, and edit their own rating/student counters; students could edit their own streak/completion counters and **grade their own assignments**. Column-protection triggers added.
* `donations_insert_any` allowed anyone to insert an already-`confirmed` donation (inflating the admin dashboard). Now only unconfirmed rows attributed to the caller (or a guest) are accepted.

## Deploy runbook

**Order matters: deploy the application first, then run the migration.**
The new application code works before *and* after the migration. The migration revokes the reward
functions from browser roles, so running it first breaks daily-login, lesson-completion and paid
enrolment until the new code is live.

1. Confirm `SUPABASE_SERVICE_ROLE_KEY` is set in Netlify (it already is if certificates/payments work). It is now also required for rewards, enrolment and quizzes.
2. Deploy the application commit.
3. Supabase → SQL editor → paste `supabase/migrations/0022_security_hardening.sql` → Run. (Idempotent: safe to run twice.)
4. Run `supabase/security/verify-0022-applied.sql` in the SQL editor — 38 read-only checks that the migration is fully applied in *this* Supabase project. Every row must say PASS.
5. Run the live retest from your machine (safe: reads and harmless refused-call probes only; uses your own `.env.local`):
   `node --env-file=.env.local supabase/security/live-retest.mjs` — every line must say PASS.
6. Run the smoke tests below.
7. Run `supabase/security/post-incident-checks.sql` (read-only) to look for signs that the holes were used before the fix.
8. Re-run the BugBunny audit to get an independent confirmation.

### Smoke tests (~10 minutes)

| Do this | Expect |
|---|---|
| Register a new student; register once as instructor | Each gets exactly the role chosen. |
| Edit profile name/bio/avatar | Saves. |
| Student completes a lesson; opens the dashboard twice in a day | W3TR increases once per lesson / once per day. |
| Enrol in a **free** course; then a **paid** course with too little W3TR, then enough | Free works; paid shows the buy prompt, then enrols and debits W3TR once. |
| Take a quiz in an enrolled course; call the quiz API for a course you are not enrolled in | Recorded; the second returns 403. |
| Instructor creates a course and submits it; moderator/admin approves it | Becomes published, cover generated, instructor receives the publish bonus. |
| Admin changes a student to instructor; tries to make someone `admin` | First works; second shows "Only a super admin can grant or revoke admin roles." |
| Logged out: home page, `/student/courses`, a course page, `/verify/<code>` | All load; instructor name/avatar show; verification works. |
| Logged in as a student, open `/admin/users` and view source | Redirected; page source contains no user list. |
| Upload an avatar; open its public URL in a private window | Works. |

## What is deliberately NOT fixed yet (phase 2)

1. **Signed-in users can still read other users' e-mail/phone.** Anonymous harvesting is closed, but registering still allows it, because staff pages (instructor student lists, organisation learners, admin users) legitimately read those fields through the user's own session. Proper fix: move e-mail/phone into a private table (or serve them only from server code) and give other users a `public_profiles` view with name/avatar only. Needs a refactor of ~10 pages.
2. **Paid course documents and certificate PDFs are still downloadable by anyone who has the exact file URL** (public buckets). Listing/enumeration is closed. Proper fix: make `course-documents` private and serve signed URLs after an enrolment check.
3. PostgREST error hints that name tables (inherent to Supabase; low).
4. Left unchanged on purpose (behaviour questions, not security): organisation "assign learner to program" enrolments silently fail today (the insert uses the owner's session); guest donations through `/api/donations` fail RLS (no donate page exists in this codebase); a quiz pays out on every pass up to `max_attempts`; instructors/organisations can still self-select their role at sign-up (the form offers it) — publishing is now moderation-gated.

## Verification evidence

* `python3 supabase/tests/security/run_all.py` — on a local replica built from migrations 0001–0021: **47/48 attacks succeed** (the one that doesn't, direct wallet writes, matches the report). After 0022: **0/48 succeed, 63/63 legitimate actions still work**, and 0022 re-runs cleanly.
* `npm test` 116 passing (69 before), `tsc --noEmit` clean, `eslint .` clean, `next build` succeeds.
* Limits: the replica is built from the migration files, so manual dashboard changes in production are not in it; the Storage HTTP service and a real browser session are not simulated (see smoke tests).

## Follow-up (0023): edits to a live course always go back to admin review

**Gap found:** the in-app flow (`lib/actions/course-review-flag.ts`) already sent a published course back to review when the instructor edited it through the normal screens. But the rule lived only in application code: `PATCH /api/courses/[id]` never called it, and the database API accepts direct edits, so an approved course could have its title, price or content changed with no review.

**Fix:** `supabase/migrations/0023_enforce_review_on_edit.sql` enforces the rule in the database, for every path:

| Edit by the course's instructor on a *published* course | Result |
|---|---|
| Course details (title, price, description, thumbnail, tags …) | Course → `pending_review`, approval cleared, instructor + all admins notified once |
| Sections, lessons, lesson/course resources, quizzes, quiz questions, assignments (add / change / delete) | Same |
| Saving with no change; editing a draft or an already-pending course | Nothing happens (no spam) |
| Edits by moderators/admins, the server, or counters changing as students learn (enrolments, ratings, completions) | Not treated as an instructor edit |

Enrolled students keep access while a course is in review (migration 0017); it leaves the public catalogue until approved. Also closed: an instructor can no longer mark their own course `is_featured` (staff decision).

**Deploy:** run the migration in the Supabase SQL editor — **no application deploy is needed** and the order relative to any deploy doesn't matter (the app helper finds the course already in review and does nothing, so nothing is notified twice). Then run `supabase/security/verify-0023-applied.sql` (11 checks, all must PASS).

**Smoke test (2 minutes):** as an instructor, edit the title of one of your *published* courses → its badge changes to "Pending review" and it leaves `/student/courses`; an admin sees a "Course needs re-review" notification; the admin approves it → it is public again.

**Evidence:** `python3 supabase/tests/security/run_all.py` now replays 67 attacks and 78 legitimate-use checks across three states. On the database as it is today (0001–0022) 19 attacks work (18 edit bypasses + self-featuring); after 0023: **0 of 67 work and all 78 legitimate checks pass**, and both 0022 and 0023 re-run cleanly.

**Rolling back (only if something unexpected happens):** the rule can be switched off without touching data —
`drop trigger if exists trg_courses_review_on_edit on public.courses;` and `drop trigger if exists trg_review_on_edit on public.<table>;` for course_sections, lessons, lesson_resources, course_resources, quizzes, quiz_questions, assignments. The in-app helper keeps working on its own.

