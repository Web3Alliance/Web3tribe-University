/**
 * TOKENOMICS — FIXED, PLATFORM-WIDE W3TR REWARD AMOUNTS
 * =====================================================================================
 * These amounts are NOT instructor-configurable. They mirror the defaults enforced
 * at the database level in supabase/migrations/0003_tokenomics_and_resources.sql.
 * This file exists so the UI can *display* the correct fixed amount to instructors
 * and students without needing to fetch it from the database every time, and so
 * there is exactly one place in the application code that documents what these
 * numbers are and why.
 *
 * If you ever change a reward amount, change it in BOTH places:
 *   1. The default/update statements in 0003_tokenomics_and_resources.sql (source of truth)
 *   2. The constants below (display-only mirror)
 */

export const TOKENOMICS = {
  /** Awarded once per lesson, the first time a student marks it complete. */
  LESSON_COMPLETE_REWARD: 1,

  /** Awarded once per lesson-quiz, the first time a student passes it. */
  LESSON_QUIZ_PASS_REWARD: 2,

  /** Awarded once for passing a course's final exam. */
  FINAL_EXAM_PASS_REWARD: 10,

  /** Awarded once when a student reaches 100% course progress. */
  COURSE_COMPLETE_REWARD: 20,

  /** Awarded once per calendar day a student logs in. */
  DAILY_LOGIN_REWARD: 2,

  /** Additional bonus awarded on every 7th consecutive daily-login streak day. */
  WEEKLY_STREAK_BONUS: 20,

  /** Awarded to the referrer once a referred user qualifies (admin/automation-driven). */
  REFERRAL_BONUS: 30,

  /** Awarded to an instructor when a submitted course is approved and published. */
  COURSE_PUBLISH_BONUS: 100,

  /** Awarded to an instructor when a course reaches a 4.5+ average rating (admin/automation-driven). */
  HIGH_RATING_BONUS: 50,

  /** Default passing score for every lesson quiz and final exam. */
  DEFAULT_PASSING_SCORE_PERCENT: 70,

  /** Quiz retakes are effectively unlimited so students can always try again after a fail. */
  MAX_QUIZ_ATTEMPTS: 999,
} as const;
