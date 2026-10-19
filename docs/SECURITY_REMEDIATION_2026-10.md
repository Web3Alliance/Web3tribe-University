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
4. Run the smoke tests below.
5. Run `supabase/security/post-incident-checks.sql` (read-only) to look for signs that the holes were used before the fix.
6. Re-run the BugBunny audit to get an independent confirmation.

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
