-- =====================================================================================
-- 0009: INSTRUCTOR EARNINGS ON PREMIUM COURSES
-- =====================================================================================
-- Previously, when a student spent W3TR to enroll in a premium course, none of it
-- reached the instructor(s) involved — the student's wallet was simply debited with
-- no corresponding credit anywhere. This migration adds the transaction type needed
-- to fix that; the actual split logic lives in application code
-- (lib/actions/enrollment.ts and lib/actions/cohorts.ts), since it depends on
-- whether the enrolling cohort (if any) is led by the course's original author or
-- by a different instructor.
--
-- Split (of the price paid): 70% to instructor(s), 30% retained by the platform.
--   - Direct enrollment, or a cohort led by the course's own author: 70% to that
--     one person.
--   - A cohort led by someone OTHER than the course's author: 40% to the course
--     author (content royalty) and 30% to the cohort's instructor (delivery fee).
-- =====================================================================================

do $$ begin
  alter type w3tr_transaction_type add value if not exists 'instructor_earning';
exception when duplicate_object then null; end $$;

commit;