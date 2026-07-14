# Database Schema Reference

Full source: `supabase/migrations/0001_schema.sql` (schema + RLS) and `supabase/migrations/0002_storage.sql` (storage buckets/policies).

## Table map by domain

| Domain | Tables |
|---|---|
| Identity | `profiles`, `student_profiles`, `instructor_profiles` |
| Organizations | `organizations`, `organization_members`, `organization_programs`, `organization_program_assignments` |
| Curriculum | `categories`, `courses`, `course_moderation_log`, `course_sections`, `lessons`, `lesson_resources` |
| Progress | `enrollments`, `lesson_progress` |
| Assessment | `quizzes`, `quiz_questions`, `quiz_attempts`, `assignments`, `assignment_submissions` |
| Credentials | `certificates` |
| Rewards | `w3tr_wallets`, `w3tr_transactions`, `reward_rules` |
| Gamification | `achievements`, `user_achievements`, `daily_logins`, `referrals` |
| Donations | `donation_campaigns`, `donations` |
| Communication | `notifications`, `announcements`, `discussion_threads`, `discussion_replies` |
| Engagement | `course_reviews`, `wishlists`, `bookmarks` |
| Platform ops | `audit_logs`, `feature_flags`, `system_settings` |

## Key functions (all `SECURITY DEFINER`, callable via `supabase.rpc(...)`)

| Function | Purpose |
|---|---|
| `award_w3tr(profile_id, type, amount, ...)` | The single entry point for crediting/debiting W3TR. Updates `w3tr_wallets.balance` and inserts an immutable `w3tr_transactions` row. Rejects any operation that would drive a balance negative. |
| `spend_w3tr(profile_id, amount, ...)` | Convenience wrapper around `award_w3tr` for debits (validates the amount is positive, then negates it). |
| `complete_lesson(enrollment_id, lesson_id)` | Marks a lesson complete (idempotently — re-calling it does not re-award W3TR), recomputes the enrollment's `progress_percent`, and awards a course-completion bonus exactly once when progress reaches 100%. |
| `record_daily_login(profile_id)` | Computes the caller's current login streak, awards a small daily reward plus a weekly bonus every 7th consecutive day. |
| `recompute_course_rating()` (trigger) | Keeps `courses.average_rating` / `rating_count` in sync whenever `course_reviews` changes. |
| `on_enrollment_change()` (trigger) | Keeps `courses.enrollment_count` in sync. |
| `handle_new_auth_user()` (trigger on `auth.users`) | Provisions a `profiles` row, a `w3tr_wallets` row, and a `student_profiles` row (with a generated referral code) for every new Supabase Auth user. |
| `is_admin()`, `is_super_admin()`, `is_moderator_or_above()`, `current_role_is(roles[])` | Role-check helpers used throughout the RLS policies. |

## Row Level Security summary

Every table has RLS enabled. The general pattern:
- **Public/published content** (published courses, active categories, public profile fields) is readable by anyone.
- **Ownership-scoped writes**: a row can be written by its owner (`student_id`, `instructor_id`, `profile_id`, etc. matching `auth.uid()`) or by an admin/moderator, depending on the table.
- **W3TR wallets and transactions have no direct student/instructor write policies at all** — the only way to change a balance is through `award_w3tr` / `spend_w3tr`, which run as `SECURITY DEFINER` and therefore bypass RLS safely from within a controlled, validated code path. This was verified directly in `scripts/test-rls.js`, which confirms a student cannot `UPDATE w3tr_wallets` directly even with RLS technically evaluating the request.
- **Certificates** are readable broadly (including a permissive clause for the public verification page use case), but only mutable by admins — the actual issuance path goes through `app/api/certificates/generate/route.ts`, which uses the caller's normal (RLS-respecting) session client and enforces its own business rule (course must be completed) before inserting.

## Extending the schema

New migrations should be added as `0003_*.sql`, `0004_*.sql`, etc., following the same idempotent style (`create table if not exists`, `do $$ begin ... exception when duplicate_object then null; end $$;` for enums). Before applying a new migration to a real project, you can validate it locally:

```bash
node scripts/test-schema.js supabase/migrations/0001_schema.sql supabase/migrations/000N_your_new_migration.sql
```

(Adjust `scripts/test-schema.js` to accept multiple file arguments if you want to chain-validate more than one migration at a time — currently it takes a single file path.)
