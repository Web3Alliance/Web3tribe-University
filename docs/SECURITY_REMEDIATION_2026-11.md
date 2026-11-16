# Security remediation - BugBunny report cc6b1c2 (12 Nov 2026)

| # | Severity | Finding | Status after migration 0024 + this code |
|---|----------|---------|------------------------------------------|
| 1 | High | Students could author courses/lessons/quizzes, set their own W3TR rewards, and farm rewards (same quiz paid on every pass; own/draft course) | **Fixed** - authoring needs instructor/admin role (RLS); reward amounts fixed by the platform (trigger); each reward paid once per learner per item and never on your own or an unpublished course (`award_w3tr` + unique index); quiz route pays platform amounts only |
| 2 | Medium | Any signed-in user can read every profile row (email, phone, ...) | **Open - phase 2** (see below) |
| 3 | Medium | Paid-course PDFs readable by anyone (anonymous table read + public bucket) | **Fixed** - `course_resources` readable only by owner/staff/enrolled; `course-documents` bucket private; files served through `/api/files/document` as 60-second signed links after an enrolment check |
| 4 | Medium | Certificates issued for unverified instructors, draft courses, 1-question exams | **Fixed** - `certificate_block_reason()` (verified instructor, not draft/rejected, holder is not the author, final exam exists with >= 10 questions and was passed); `MIN_FINAL_EXAM_QUESTIONS` in `lib/tokenomics.ts` |

## Deploy order
1. Deploy the application code (Vercel) **first** - it already routes documents through the new download route.
2. Run `0024_authoring_rewards_certificates_documents.sql` in the Supabase SQL editor.
3. Run `supabase/security/verify-0024-applied.sql`: Part A must be all PASS; Part B lists damage from before the fix (ideally empty).
4. Smoke test: instructor can add lesson/quiz/PDF; enrolled student can open the PDF; logged-out visitor cannot; a student cannot reach `/instructor`.

## Behaviour changes to expect
- Existing course PDFs keep their stored links, but the links only work through the site (direct bucket URLs stop working by design).
- Certificates now require a verified instructor and a final exam with at least 10 questions. Courses without one will not issue certificates until fixed.
- Course videos (`course-videos` bucket) are still public - same class of issue, not covered by this report; handle in phase 2.

## Phase 2 - profile privacy (finding 2)
`profiles` holds email/phone and every logged-in user can select all rows because the app reads `select *` in many places. The safe fix is a split: a `public_profiles` view (id, full_name, username, avatar_url, bio) for cross-user reads, and `profiles` readable only by the owner and staff; then update each cross-user query (instructor cards, reviews, discussions, leaderboard, cohort/student lists) to use the view. It touches many pages and needs its own test round, so it is not bundled here. Exposure to date should be assessed under NDPR.
