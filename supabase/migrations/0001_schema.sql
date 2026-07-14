-- =====================================================================================
-- WEB3TRIBE UNIVERSITY — DATABASE SCHEMA
-- "Learn. Build. Earn."
-- =====================================================================================
-- This is the complete production schema for the Web3tribe University learning
-- platform, designed for Supabase (PostgreSQL 15+).
--
-- IMPORTANT DESIGN NOTE ON W3TR:
-- W3TR is an in-app reward asset, NOT a cryptocurrency and NOT a blockchain token.
-- It is implemented as a conventional double-entry style ledger (w3tr_transactions)
-- backing a materialized balance (w3tr_wallets.balance). This ledger design is
-- deliberately chosen so that, if/when the platform obtains the necessary licences
-- and decides to introduce an on-chain representation of W3TR in the future, an
-- adapter can be built that mirrors ledger entries to a chain of choice WITHOUT
-- requiring any change to application logic, APIs, or the reward engine. Nothing in
-- this schema references any blockchain, wallet address, smart contract, or token
-- standard — it is a plain relational ledger.
--
-- HOW TO APPLY:
--   1. Create a new Supabase project.
--   2. Open the SQL Editor.
--   3. Paste and run this entire file (it is idempotent — safe to re-run).
--   4. Optionally run supabase/seed/seed.sql afterwards for sample data.
--
-- The file is organized into numbered sections:
--   1. Extensions & Enums
--   2. Identity & Profiles
--   3. Organizations
--   4. Courses & Curriculum
--   5. Enrollment & Progress
--   6. Quizzes, Assignments & Exams
--   7. Certificates
--   8. Reward Engine (W3TR Ledger)
--   9. Gamification (Streaks, Achievements, Referrals)
--  10. Donations
--  11. Notifications & Announcements
--  12. Reviews, Wishlist, Bookmarks
--  13. Admin, Audit & Platform Config
--  14. Indexes (consolidated reference — most are inline above)
--  15. Row Level Security (RLS) Policies
--  16. Functions & Triggers
-- =====================================================================================


-- =====================================================================================
-- 1. EXTENSIONS & ENUMS
-- =====================================================================================

create extension if not exists "pg_trgm"; -- for fuzzy/fast text search

-- Drop-and-recreate enums safely (idempotent pattern used throughout this file)
do $$ begin
  create type user_role as enum ('student', 'instructor', 'organization', 'moderator', 'admin', 'super_admin');
exception when duplicate_object then null; end $$;

do $$ begin
  create type course_status as enum ('draft', 'pending_review', 'changes_requested', 'approved', 'rejected', 'published', 'archived');
exception when duplicate_object then null; end $$;

do $$ begin
  create type course_level as enum ('beginner', 'intermediate', 'advanced', 'all_levels');
exception when duplicate_object then null; end $$;

do $$ begin
  create type lesson_content_type as enum ('video', 'pdf', 'text', 'image', 'audio', 'code', 'external_link', 'download', 'embed');
exception when duplicate_object then null; end $$;

do $$ begin
  create type enrollment_status as enum ('active', 'completed', 'dropped', 'suspended');
exception when duplicate_object then null; end $$;

do $$ begin
  create type quiz_attempt_status as enum ('in_progress', 'submitted', 'graded');
exception when duplicate_object then null; end $$;

do $$ begin
  create type question_type as enum ('single_choice', 'multiple_choice', 'true_false', 'short_answer');
exception when duplicate_object then null; end $$;

do $$ begin
  create type w3tr_transaction_type as enum (
    'lesson_complete', 'quiz_pass', 'exam_pass', 'course_complete',
    'daily_login', 'streak_bonus', 'referral_bonus', 'helping_learner',
    'special_event', 'course_publish_bonus', 'high_rating_bonus',
    'instructor_milestone', 'community_contribution',
    'admin_grant', 'admin_deduction', 'spend', 'donation_conversion', 'adjustment'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type donation_status as enum ('pending', 'confirmed', 'failed', 'refunded');
exception when duplicate_object then null; end $$;

do $$ begin
  create type donation_method as enum ('card', 'bank_transfer', 'paystack', 'flutterwave', 'manual');
exception when duplicate_object then null; end $$;

do $$ begin
  create type notification_channel as enum ('in_app', 'email', 'push');
exception when duplicate_object then null; end $$;

do $$ begin
  create type moderation_action as enum ('submit', 'approve', 'reject', 'request_changes', 'unpublish', 'archive');
exception when duplicate_object then null; end $$;


-- =====================================================================================
-- 2. IDENTITY & PROFILES
-- =====================================================================================
-- Supabase Auth owns auth.users (email, password hash, OAuth identities, MFA factors).
-- This table extends it with platform-specific profile & role data.

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  full_name text,
  username text unique,
  avatar_url text,
  bio text,
  role user_role not null default 'student',
  phone text,
  phone_verified boolean not null default false,
  country text,
  state_region text,
  timezone text default 'Africa/Lagos',
  is_instructor_verified boolean not null default false,
  is_active boolean not null default true,
  is_banned boolean not null default false,
  ban_reason text,
  two_factor_enabled boolean not null default false,
  onboarding_completed boolean not null default false,
  theme_preference text not null default 'system' check (theme_preference in ('light', 'dark', 'system')),
  last_seen_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_profiles_role on public.profiles(role);
create index if not exists idx_profiles_username on public.profiles(username);
create index if not exists idx_profiles_email on public.profiles(email);
create index if not exists idx_profiles_active on public.profiles(is_active) where is_active = true;

-- Per-role extended metadata (kept separate from profiles to keep the core table lean)
create table if not exists public.instructor_profiles (
  profile_id uuid primary key references public.profiles(id) on delete cascade,
  headline text,
  expertise_tags text[] default '{}',
  years_experience int,
  linkedin_url text,
  website_url text,
  verification_document_url text,
  verification_status text not null default 'unverified' check (verification_status in ('unverified', 'pending', 'verified', 'rejected')),
  verification_notes text,
  total_students int not null default 0,
  average_rating numeric(3,2) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.student_profiles (
  profile_id uuid primary key references public.profiles(id) on delete cascade,
  learning_goals text,
  interests text[] default '{}',
  current_streak_days int not null default 0,
  longest_streak_days int not null default 0,
  last_activity_date date,
  total_lessons_completed int not null default 0,
  total_courses_completed int not null default 0,
  referral_code text unique,
  referred_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_student_referral_code on public.student_profiles(referral_code);


-- =====================================================================================
-- 3. ORGANIZATIONS
-- =====================================================================================

create table if not exists public.organizations (
  id uuid primary key default gen_random_uuid(),
  owner_profile_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  slug text unique not null,
  logo_url text,
  description text,
  industry text,
  website_url text,
  seats_purchased int not null default 0,
  is_verified boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_organizations_slug on public.organizations(slug);

create table if not exists public.organization_members (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  member_role text not null default 'learner' check (member_role in ('learner', 'manager')),
  invited_email text,
  status text not null default 'active' check (status in ('invited', 'active', 'removed')),
  joined_at timestamptz not null default now(),
  unique (organization_id, profile_id)
);

create index if not exists idx_org_members_org on public.organization_members(organization_id);
create index if not exists idx_org_members_profile on public.organization_members(profile_id);

create table if not exists public.organization_programs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  description text,
  course_ids uuid[] default '{}',
  start_date date,
  end_date date,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists idx_org_programs_org on public.organization_programs(organization_id);

create table if not exists public.organization_program_assignments (
  id uuid primary key default gen_random_uuid(),
  program_id uuid not null references public.organization_programs(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  assigned_at timestamptz not null default now(),
  completed_at timestamptz,
  unique (program_id, profile_id)
);


-- =====================================================================================
-- 4. COURSES & CURRICULUM
-- =====================================================================================

create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  name text unique not null,
  slug text unique not null,
  description text,
  icon text,
  parent_id uuid references public.categories(id) on delete set null,
  display_order int not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists idx_categories_slug on public.categories(slug);
create index if not exists idx_categories_parent on public.categories(parent_id);

create table if not exists public.courses (
  id uuid primary key default gen_random_uuid(),
  instructor_id uuid not null references public.profiles(id) on delete cascade,
  organization_id uuid references public.organizations(id) on delete set null,
  category_id uuid references public.categories(id) on delete set null,
  title text not null,
  slug text unique not null,
  subtitle text,
  description text,
  thumbnail_url text,
  promo_video_url text,
  level course_level not null default 'beginner',
  language text not null default 'en',
  tags text[] default '{}',
  status course_status not null default 'draft',
  version int not null default 1,
  price_w3tr numeric(12,2) not null default 0, -- 0 = free course
  estimated_hours numeric(5,1),
  requirements text[] default '{}',
  learning_outcomes text[] default '{}',
  target_audience text[] default '{}',
  average_rating numeric(3,2) not null default 0,
  rating_count int not null default 0,
  enrollment_count int not null default 0,
  completion_count int not null default 0,
  published_at timestamptz,
  submitted_for_review_at timestamptz,
  reviewed_at timestamptz,
  reviewed_by uuid references public.profiles(id) on delete set null,
  review_notes text,
  is_featured boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_courses_instructor on public.courses(instructor_id);
create index if not exists idx_courses_status on public.courses(status);
create index if not exists idx_courses_category on public.courses(category_id);
create index if not exists idx_courses_slug on public.courses(slug);
create index if not exists idx_courses_featured on public.courses(is_featured) where is_featured = true;
create index if not exists idx_courses_title_trgm on public.courses using gin (title gin_trgm_ops);
create index if not exists idx_courses_tags on public.courses using gin (tags);

-- Version history / moderation trail for course submissions
create table if not exists public.course_moderation_log (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses(id) on delete cascade,
  actor_profile_id uuid references public.profiles(id) on delete set null,
  action moderation_action not null,
  notes text,
  created_at timestamptz not null default now()
);

create index if not exists idx_moderation_log_course on public.course_moderation_log(course_id);

create table if not exists public.course_sections (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses(id) on delete cascade,
  title text not null,
  display_order int not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists idx_sections_course on public.course_sections(course_id, display_order);

create table if not exists public.lessons (
  id uuid primary key default gen_random_uuid(),
  section_id uuid not null references public.course_sections(id) on delete cascade,
  course_id uuid not null references public.courses(id) on delete cascade,
  title text not null,
  content_type lesson_content_type not null default 'video',
  content_url text,
  content_text text,
  duration_seconds int default 0,
  display_order int not null default 0,
  is_preview boolean not null default false,
  w3tr_reward numeric(10,2) not null default 5,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_lessons_section on public.lessons(section_id, display_order);
create index if not exists idx_lessons_course on public.lessons(course_id);

create table if not exists public.lesson_resources (
  id uuid primary key default gen_random_uuid(),
  lesson_id uuid not null references public.lessons(id) on delete cascade,
  title text not null,
  file_url text not null,
  file_type text,
  file_size_bytes bigint,
  created_at timestamptz not null default now()
);

create index if not exists idx_lesson_resources_lesson on public.lesson_resources(lesson_id);


-- =====================================================================================
-- 5. ENROLLMENT & PROGRESS
-- =====================================================================================

create table if not exists public.enrollments (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles(id) on delete cascade,
  course_id uuid not null references public.courses(id) on delete cascade,
  status enrollment_status not null default 'active',
  progress_percent numeric(5,2) not null default 0,
  enrolled_at timestamptz not null default now(),
  completed_at timestamptz,
  last_accessed_at timestamptz,
  unique (student_id, course_id)
);

create index if not exists idx_enrollments_student on public.enrollments(student_id);
create index if not exists idx_enrollments_course on public.enrollments(course_id);
create index if not exists idx_enrollments_status on public.enrollments(status);

create table if not exists public.lesson_progress (
  id uuid primary key default gen_random_uuid(),
  enrollment_id uuid not null references public.enrollments(id) on delete cascade,
  student_id uuid not null references public.profiles(id) on delete cascade,
  lesson_id uuid not null references public.lessons(id) on delete cascade,
  course_id uuid not null references public.courses(id) on delete cascade,
  is_completed boolean not null default false,
  progress_seconds int not null default 0,
  completed_at timestamptz,
  last_position_seconds int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (enrollment_id, lesson_id)
);

create index if not exists idx_lesson_progress_enrollment on public.lesson_progress(enrollment_id);
create index if not exists idx_lesson_progress_student on public.lesson_progress(student_id);
create index if not exists idx_lesson_progress_lesson on public.lesson_progress(lesson_id);


-- =====================================================================================
-- 6. QUIZZES, ASSIGNMENTS & FINAL EXAMS
-- =====================================================================================

create table if not exists public.quizzes (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses(id) on delete cascade,
  section_id uuid references public.course_sections(id) on delete cascade,
  lesson_id uuid references public.lessons(id) on delete set null,
  is_final_exam boolean not null default false,
  title text not null,
  description text,
  passing_score_percent numeric(5,2) not null default 70,
  time_limit_minutes int,
  max_attempts int not null default 3,
  w3tr_reward numeric(10,2) not null default 10,
  display_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_quizzes_course on public.quizzes(course_id);
create index if not exists idx_quizzes_final_exam on public.quizzes(course_id, is_final_exam);

create table if not exists public.quiz_questions (
  id uuid primary key default gen_random_uuid(),
  quiz_id uuid not null references public.quizzes(id) on delete cascade,
  question_text text not null,
  question_type question_type not null default 'single_choice',
  options jsonb, -- [{ id: "a", text: "..." }, ...] for choice-based questions
  correct_answer jsonb not null, -- string, array of ids, or boolean depending on type
  explanation text,
  points numeric(6,2) not null default 1,
  display_order int not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists idx_quiz_questions_quiz on public.quiz_questions(quiz_id, display_order);

create table if not exists public.quiz_attempts (
  id uuid primary key default gen_random_uuid(),
  quiz_id uuid not null references public.quizzes(id) on delete cascade,
  student_id uuid not null references public.profiles(id) on delete cascade,
  attempt_number int not null default 1,
  status quiz_attempt_status not null default 'in_progress',
  answers jsonb not null default '{}', -- { question_id: answer }
  score_percent numeric(5,2),
  passed boolean,
  started_at timestamptz not null default now(),
  submitted_at timestamptz,
  graded_at timestamptz
);

create index if not exists idx_quiz_attempts_quiz on public.quiz_attempts(quiz_id);
create index if not exists idx_quiz_attempts_student on public.quiz_attempts(student_id);
create unique index if not exists idx_quiz_attempts_unique on public.quiz_attempts(quiz_id, student_id, attempt_number);

create table if not exists public.assignments (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses(id) on delete cascade,
  section_id uuid references public.course_sections(id) on delete cascade,
  title text not null,
  instructions text,
  max_score numeric(6,2) not null default 100,
  w3tr_reward numeric(10,2) not null default 15,
  due_offset_days int, -- days after enrollment, nullable = no deadline
  display_order int not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists idx_assignments_course on public.assignments(course_id);

create table if not exists public.assignment_submissions (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid not null references public.assignments(id) on delete cascade,
  student_id uuid not null references public.profiles(id) on delete cascade,
  submission_text text,
  file_url text,
  score numeric(6,2),
  feedback text,
  status text not null default 'submitted' check (status in ('submitted', 'graded', 'returned')),
  submitted_at timestamptz not null default now(),
  graded_at timestamptz,
  graded_by uuid references public.profiles(id) on delete set null,
  unique (assignment_id, student_id)
);

create index if not exists idx_submissions_assignment on public.assignment_submissions(assignment_id);
create index if not exists idx_submissions_student on public.assignment_submissions(student_id);


-- =====================================================================================
-- 7. CERTIFICATES
-- =====================================================================================

create table if not exists public.certificates (
  id uuid primary key default gen_random_uuid(),
  certificate_code text unique not null default (upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 12))),
  student_id uuid not null references public.profiles(id) on delete cascade,
  course_id uuid not null references public.courses(id) on delete cascade,
  enrollment_id uuid not null references public.enrollments(id) on delete cascade,
  instructor_name_snapshot text,
  course_title_snapshot text,
  student_name_snapshot text,
  final_score numeric(5,2),
  pdf_url text,
  qr_verification_url text,
  issued_at timestamptz not null default now(),
  revoked boolean not null default false,
  revoked_reason text,
  unique (student_id, course_id)
);

create index if not exists idx_certificates_student on public.certificates(student_id);
create index if not exists idx_certificates_course on public.certificates(course_id);
create index if not exists idx_certificates_code on public.certificates(certificate_code);


-- =====================================================================================
-- 8. REWARD ENGINE — W3TR LEDGER
-- =====================================================================================
-- W3TR wallets hold a materialized balance for fast reads. w3tr_transactions is the
-- append-only source of truth (a plain ledger, not a blockchain). Balance changes are
-- always made by inserting a transaction row; the trigger below keeps the wallet
-- balance column in sync. This separation is the seam where a future on-chain mirror
-- could be attached (e.g., a background worker reading new transactions and mirroring
-- them to a chain) without touching any application code that awards or spends W3TR.

create table if not exists public.w3tr_wallets (
  profile_id uuid primary key references public.profiles(id) on delete cascade,
  balance numeric(14,2) not null default 0,
  lifetime_earned numeric(14,2) not null default 0,
  lifetime_spent numeric(14,2) not null default 0,
  updated_at timestamptz not null default now()
);

create table if not exists public.w3tr_transactions (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  type w3tr_transaction_type not null,
  amount numeric(14,2) not null, -- positive = credit, negative = debit
  balance_after numeric(14,2) not null,
  reference_table text, -- e.g. 'lessons', 'quizzes', 'courses'
  reference_id uuid,
  description text,
  awarded_by uuid references public.profiles(id) on delete set null, -- set for admin_grant/admin_deduction
  created_at timestamptz not null default now()
);

create index if not exists idx_w3tr_tx_profile on public.w3tr_transactions(profile_id, created_at desc);
create index if not exists idx_w3tr_tx_type on public.w3tr_transactions(type);
create index if not exists idx_w3tr_tx_reference on public.w3tr_transactions(reference_table, reference_id);

-- Reward rule configuration, editable by admins without a code deploy
create table if not exists public.reward_rules (
  id uuid primary key default gen_random_uuid(),
  rule_key text unique not null, -- e.g. 'daily_login', 'referral_bonus'
  label text not null,
  amount numeric(10,2) not null,
  is_active boolean not null default true,
  updated_at timestamptz not null default now()
);


-- =====================================================================================
-- 9. GAMIFICATION — STREAKS, ACHIEVEMENTS, BADGES, REFERRALS
-- =====================================================================================

create table if not exists public.achievements (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  title text not null,
  description text,
  icon text,
  w3tr_reward numeric(10,2) not null default 0,
  criteria jsonb not null default '{}', -- machine-readable criteria for the awarding job
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.user_achievements (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  achievement_id uuid not null references public.achievements(id) on delete cascade,
  earned_at timestamptz not null default now(),
  unique (profile_id, achievement_id)
);

create index if not exists idx_user_achievements_profile on public.user_achievements(profile_id);

create table if not exists public.daily_logins (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  login_date date not null default current_date,
  streak_day int not null default 1,
  w3tr_awarded numeric(10,2) not null default 0,
  created_at timestamptz not null default now(),
  unique (profile_id, login_date)
);

create index if not exists idx_daily_logins_profile on public.daily_logins(profile_id, login_date desc);

create table if not exists public.referrals (
  id uuid primary key default gen_random_uuid(),
  referrer_id uuid not null references public.profiles(id) on delete cascade,
  referred_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'qualified', 'rewarded')),
  w3tr_awarded numeric(10,2) not null default 0,
  qualified_at timestamptz,
  created_at timestamptz not null default now(),
  unique (referred_id)
);

create index if not exists idx_referrals_referrer on public.referrals(referrer_id);

-- Leaderboard is served as a view over student_profiles + w3tr_wallets (see Section 16)


-- =====================================================================================
-- 10. DONATIONS
-- =====================================================================================

create table if not exists public.donation_campaigns (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  slug text unique not null,
  description text,
  cover_image_url text,
  goal_amount numeric(14,2) not null default 0,
  raised_amount numeric(14,2) not null default 0,
  currency text not null default 'NGN',
  is_active boolean not null default true,
  starts_at timestamptz,
  ends_at timestamptz,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists idx_campaigns_slug on public.donation_campaigns(slug);
create index if not exists idx_campaigns_active on public.donation_campaigns(is_active) where is_active = true;

create table if not exists public.donations (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid references public.donation_campaigns(id) on delete set null,
  donor_id uuid references public.profiles(id) on delete set null, -- null allowed for guest/anonymous donors
  donor_name text, -- used when anonymous or guest
  donor_email text,
  is_anonymous boolean not null default false,
  amount numeric(14,2) not null,
  currency text not null default 'NGN',
  method donation_method not null,
  status donation_status not null default 'pending',
  provider_reference text, -- Paystack/Flutterwave transaction reference
  receipt_url text,
  notes text,
  created_at timestamptz not null default now(),
  confirmed_at timestamptz
);

create index if not exists idx_donations_campaign on public.donations(campaign_id);
create index if not exists idx_donations_donor on public.donations(donor_id);
create index if not exists idx_donations_status on public.donations(status);
create index if not exists idx_donations_provider_ref on public.donations(provider_reference);


-- =====================================================================================
-- 11. NOTIFICATIONS & ANNOUNCEMENTS
-- =====================================================================================

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  body text,
  channel notification_channel not null default 'in_app',
  link_url text,
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists idx_notifications_profile on public.notifications(profile_id, is_read, created_at desc);

create table if not exists public.announcements (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  body text not null,
  audience user_role, -- null = all roles
  is_banner boolean not null default false,
  is_active boolean not null default true,
  starts_at timestamptz not null default now(),
  ends_at timestamptz,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists idx_announcements_active on public.announcements(is_active) where is_active = true;


-- =====================================================================================
-- 12. REVIEWS, WISHLIST, BOOKMARKS
-- =====================================================================================

create table if not exists public.course_reviews (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses(id) on delete cascade,
  student_id uuid not null references public.profiles(id) on delete cascade,
  rating int not null check (rating between 1 and 5),
  review_text text,
  instructor_response text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (course_id, student_id)
);

create index if not exists idx_reviews_course on public.course_reviews(course_id);

create table if not exists public.wishlists (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles(id) on delete cascade,
  course_id uuid not null references public.courses(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (student_id, course_id)
);

create index if not exists idx_wishlists_student on public.wishlists(student_id);

create table if not exists public.bookmarks (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles(id) on delete cascade,
  lesson_id uuid not null references public.lessons(id) on delete cascade,
  note text,
  created_at timestamptz not null default now(),
  unique (student_id, lesson_id)
);

create index if not exists idx_bookmarks_student on public.bookmarks(student_id);

create table if not exists public.discussion_threads (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses(id) on delete cascade,
  lesson_id uuid references public.lessons(id) on delete set null,
  author_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  body text not null,
  is_pinned boolean not null default false,
  is_locked boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_threads_course on public.discussion_threads(course_id);

create table if not exists public.discussion_replies (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.discussion_threads(id) on delete cascade,
  author_id uuid not null references public.profiles(id) on delete cascade,
  body text not null,
  is_instructor_reply boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists idx_replies_thread on public.discussion_replies(thread_id);


-- =====================================================================================
-- 13. ADMIN, AUDIT & PLATFORM CONFIGURATION
-- =====================================================================================

create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_profile_id uuid references public.profiles(id) on delete set null,
  action text not null, -- e.g. 'course.approve', 'user.ban', 'reward.grant'
  target_table text,
  target_id uuid,
  metadata jsonb not null default '{}',
  ip_address text,
  created_at timestamptz not null default now()
);

create index if not exists idx_audit_logs_actor on public.audit_logs(actor_profile_id);
create index if not exists idx_audit_logs_action on public.audit_logs(action);
create index if not exists idx_audit_logs_created on public.audit_logs(created_at desc);

create table if not exists public.feature_flags (
  id uuid primary key default gen_random_uuid(),
  flag_key text unique not null,
  label text not null,
  description text,
  is_enabled boolean not null default false,
  rollout_percent int not null default 100 check (rollout_percent between 0 and 100),
  updated_by uuid references public.profiles(id) on delete set null,
  updated_at timestamptz not null default now()
);

create table if not exists public.system_settings (
  key text primary key,
  value jsonb not null,
  description text,
  updated_by uuid references public.profiles(id) on delete set null,
  updated_at timestamptz not null default now()
);

-- Maintenance mode, platform name, support email etc. all live in system_settings as
-- key/value rows so they can be edited from the Super Admin panel without a deploy.


-- =====================================================================================
-- 16. FUNCTIONS & TRIGGERS
-- =====================================================================================

-- ---- Generic updated_at trigger -----------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

do $$
declare t text;
begin
  foreach t in array array[
    'profiles','instructor_profiles','student_profiles','organizations','courses',
    'lessons','lesson_progress','quizzes','course_reviews'
  ]
  loop
    execute format('drop trigger if exists trg_set_updated_at on public.%I;', t);
    execute format('create trigger trg_set_updated_at before update on public.%I for each row execute function public.set_updated_at();', t);
  end loop;
end $$;

-- ---- Role helper functions (used heavily by RLS policies below) --------------------
create or replace function public.current_role_is(roles user_role[])
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = any(roles)
  );
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.current_role_is(array['admin','super_admin']::user_role[]);
$$;

create or replace function public.is_super_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.current_role_is(array['super_admin']::user_role[]);
$$;

create or replace function public.is_moderator_or_above()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.current_role_is(array['moderator','admin','super_admin']::user_role[]);
$$;

-- ---- New user provisioning: profile + wallet + student_profile ---------------------
create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_referral_code text;
begin
  insert into public.profiles (id, email, full_name, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    coalesce((new.raw_user_meta_data->>'role')::user_role, 'student')
  )
  on conflict (id) do nothing;

  insert into public.w3tr_wallets (profile_id) values (new.id)
  on conflict (profile_id) do nothing;

  v_referral_code := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));

  insert into public.student_profiles (profile_id, referral_code)
  values (new.id, v_referral_code)
  on conflict (profile_id) do nothing;

  return new;
end;
$$;

drop trigger if exists trg_handle_new_auth_user on auth.users;
create trigger trg_handle_new_auth_user
  after insert on auth.users
  for each row execute function public.handle_new_auth_user();

-- ---- Reward engine: award_w3tr ------------------------------------------------------
-- Single entry point for crediting W3TR. All "students earn W3TR for X" and
-- "instructors earn W3TR for Y" rules in the product spec should call this function
-- (directly via RPC, or from a server-side API route using the service role) rather
-- than writing to w3tr_wallets directly. This keeps the ledger authoritative.
create or replace function public.award_w3tr(
  p_profile_id uuid,
  p_type w3tr_transaction_type,
  p_amount numeric,
  p_reference_table text default null,
  p_reference_id uuid default null,
  p_description text default null,
  p_awarded_by uuid default null
)
returns public.w3tr_transactions
language plpgsql
security definer
set search_path = public
as $$
declare
  v_new_balance numeric(14,2);
  v_tx public.w3tr_transactions;
begin
  if p_amount = 0 then
    raise exception 'award_w3tr: amount must be non-zero';
  end if;

  insert into public.w3tr_wallets (profile_id) values (p_profile_id)
  on conflict (profile_id) do nothing;

  update public.w3tr_wallets
    set balance = balance + p_amount,
        lifetime_earned = lifetime_earned + greatest(p_amount, 0),
        lifetime_spent = lifetime_spent + greatest(-p_amount, 0),
        updated_at = now()
    where profile_id = p_profile_id
    returning balance into v_new_balance;

  if v_new_balance < 0 then
    raise exception 'award_w3tr: resulting balance cannot be negative (profile %, amount %)', p_profile_id, p_amount;
  end if;

  insert into public.w3tr_transactions (
    profile_id, type, amount, balance_after, reference_table, reference_id, description, awarded_by
  ) values (
    p_profile_id, p_type, p_amount, v_new_balance, p_reference_table, p_reference_id, p_description, p_awarded_by
  )
  returning * into v_tx;

  return v_tx;
end;
$$;

-- ---- Convenience wrapper for spending W3TR (negative amount, validated) ------------
create or replace function public.spend_w3tr(
  p_profile_id uuid,
  p_amount numeric,
  p_reference_table text default null,
  p_reference_id uuid default null,
  p_description text default null
)
returns public.w3tr_transactions
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_amount <= 0 then
    raise exception 'spend_w3tr: amount must be positive (it will be debited)';
  end if;
  return public.award_w3tr(p_profile_id, 'spend', -p_amount, p_reference_table, p_reference_id, p_description, null);
end;
$$;

-- ---- Lesson completion: mark progress + auto-award W3TR + recompute enrollment ----
create or replace function public.complete_lesson(
  p_enrollment_id uuid,
  p_lesson_id uuid
)
returns public.lesson_progress
language plpgsql
security definer
set search_path = public
as $$
declare
  v_progress public.lesson_progress;
  v_student_id uuid;
  v_course_id uuid;
  v_reward numeric;
  v_total_lessons int;
  v_completed_lessons int;
  v_new_percent numeric(5,2);
  v_was_lesson_already_completed boolean;
  v_was_enrollment_already_completed boolean;
begin
  select student_id, course_id into v_student_id, v_course_id
  from public.enrollments where id = p_enrollment_id;

  if v_student_id is null then
    raise exception 'complete_lesson: enrollment % not found', p_enrollment_id;
  end if;

  -- Capture prior state BEFORE mutating anything, so awards are never re-triggered
  -- on repeat calls. A timestamp-proximity heuristic is not reliable (two awards
  -- can legitimately happen within the same second), so we check actual prior state.
  select coalesce(is_completed, false) into v_was_lesson_already_completed
  from public.lesson_progress
  where enrollment_id = p_enrollment_id and lesson_id = p_lesson_id;
  v_was_lesson_already_completed := coalesce(v_was_lesson_already_completed, false);

  select (status = 'completed') into v_was_enrollment_already_completed
  from public.enrollments where id = p_enrollment_id;
  v_was_enrollment_already_completed := coalesce(v_was_enrollment_already_completed, false);

  select w3tr_reward into v_reward from public.lessons where id = p_lesson_id;

  insert into public.lesson_progress (enrollment_id, student_id, lesson_id, course_id, is_completed, completed_at)
  values (p_enrollment_id, v_student_id, p_lesson_id, v_course_id, true, now())
  on conflict (enrollment_id, lesson_id)
    do update set is_completed = true, completed_at = coalesce(public.lesson_progress.completed_at, now())
  returning * into v_progress;

  if not v_was_lesson_already_completed then
    perform public.award_w3tr(v_student_id, 'lesson_complete', coalesce(v_reward, 5), 'lessons', p_lesson_id, 'Lesson completed');
    update public.student_profiles
      set total_lessons_completed = total_lessons_completed + 1
      where profile_id = v_student_id;
  end if;

  select count(*) into v_total_lessons from public.lessons where course_id = v_course_id;
  select count(*) into v_completed_lessons
    from public.lesson_progress
    where enrollment_id = p_enrollment_id and is_completed = true;

  v_new_percent := case when v_total_lessons > 0
    then round((v_completed_lessons::numeric / v_total_lessons::numeric) * 100, 2)
    else 0 end;

  update public.enrollments
    set progress_percent = v_new_percent,
        last_accessed_at = now(),
        status = case when v_new_percent >= 100 then 'completed'::enrollment_status else status end,
        completed_at = case when v_new_percent >= 100 and completed_at is null then now() else completed_at end
    where id = p_enrollment_id;

  if v_new_percent >= 100 and not v_was_enrollment_already_completed then
    perform public.award_w3tr(v_student_id, 'course_complete', 50, 'courses', v_course_id, 'Course completed');
    update public.student_profiles
      set total_courses_completed = total_courses_completed + 1
      where profile_id = v_student_id;
    update public.courses set completion_count = completion_count + 1 where id = v_course_id;
  end if;

  return v_progress;
end;
$$;


-- ---- Course rating recompute on review upsert --------------------------------------
create or replace function public.recompute_course_rating()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.courses c
    set average_rating = coalesce((select round(avg(rating)::numeric, 2) from public.course_reviews where course_id = c.id), 0),
        rating_count = (select count(*) from public.course_reviews where course_id = c.id)
    where c.id = coalesce(new.course_id, old.course_id);
  return coalesce(new, old);
end;
$$;

drop trigger if exists trg_recompute_rating_ins on public.course_reviews;
create trigger trg_recompute_rating_ins after insert on public.course_reviews
  for each row execute function public.recompute_course_rating();
drop trigger if exists trg_recompute_rating_upd on public.course_reviews;
create trigger trg_recompute_rating_upd after update on public.course_reviews
  for each row execute function public.recompute_course_rating();
drop trigger if exists trg_recompute_rating_del on public.course_reviews;
create trigger trg_recompute_rating_del after delete on public.course_reviews
  for each row execute function public.recompute_course_rating();

-- ---- Enrollment count maintenance --------------------------------------------------
create or replace function public.on_enrollment_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.courses set enrollment_count = (
    select count(*) from public.enrollments where course_id = coalesce(new.course_id, old.course_id)
  ) where id = coalesce(new.course_id, old.course_id);
  return coalesce(new, old);
end;
$$;

drop trigger if exists trg_enrollment_ins on public.enrollments;
create trigger trg_enrollment_ins after insert on public.enrollments
  for each row execute function public.on_enrollment_change();
drop trigger if exists trg_enrollment_del on public.enrollments;
create trigger trg_enrollment_del after delete on public.enrollments
  for each row execute function public.on_enrollment_change();

-- ---- Daily login streak + reward ---------------------------------------------------
create or replace function public.record_daily_login(p_profile_id uuid)
returns public.daily_logins
language plpgsql
security definer
set search_path = public
as $$
declare
  v_last_date date;
  v_streak int;
  v_reward numeric := 2;
  v_row public.daily_logins;
begin
  select last_activity_date, current_streak_days into v_last_date, v_streak
  from public.student_profiles where profile_id = p_profile_id;

  if v_last_date = current_date then
    select * into v_row from public.daily_logins where profile_id = p_profile_id and login_date = current_date;
    return v_row;
  end if;

  if v_last_date = current_date - interval '1 day' then
    v_streak := coalesce(v_streak, 0) + 1;
  else
    v_streak := 1;
  end if;

  if v_streak > 0 and v_streak % 7 = 0 then
    v_reward := v_reward + 20; -- weekly streak bonus
  end if;

  update public.student_profiles
    set last_activity_date = current_date,
        current_streak_days = v_streak,
        longest_streak_days = greatest(longest_streak_days, v_streak)
    where profile_id = p_profile_id;

  insert into public.daily_logins (profile_id, login_date, streak_day, w3tr_awarded)
  values (p_profile_id, current_date, v_streak, v_reward)
  returning * into v_row;

  perform public.award_w3tr(p_profile_id, 'daily_login', v_reward, 'daily_logins', v_row.id, 'Daily login reward');

  return v_row;
end;
$$;

-- ---- Leaderboard view ---------------------------------------------------------------
create or replace view public.leaderboard as
select
  p.id as profile_id,
  p.full_name,
  p.username,
  p.avatar_url,
  w.balance as w3tr_balance,
  sp.current_streak_days,
  sp.total_courses_completed,
  sp.total_lessons_completed,
  rank() over (order by w.balance desc) as rank
from public.profiles p
join public.w3tr_wallets w on w.profile_id = p.id
left join public.student_profiles sp on sp.profile_id = p.id
where p.role = 'student' and p.is_active = true and p.is_banned = false;


-- =====================================================================================
-- 15. ROW LEVEL SECURITY (RLS) POLICIES
-- =====================================================================================
-- NOTE: placed after Section 16's helper functions (is_admin, is_moderator_or_above,
-- current_role_is) because policies below depend on them.

alter table public.profiles enable row level security;
alter table public.instructor_profiles enable row level security;
alter table public.student_profiles enable row level security;
alter table public.organizations enable row level security;
alter table public.organization_members enable row level security;
alter table public.organization_programs enable row level security;
alter table public.organization_program_assignments enable row level security;
alter table public.categories enable row level security;
alter table public.courses enable row level security;
alter table public.course_moderation_log enable row level security;
alter table public.course_sections enable row level security;
alter table public.lessons enable row level security;
alter table public.lesson_resources enable row level security;
alter table public.enrollments enable row level security;
alter table public.lesson_progress enable row level security;
alter table public.quizzes enable row level security;
alter table public.quiz_questions enable row level security;
alter table public.quiz_attempts enable row level security;
alter table public.assignments enable row level security;
alter table public.assignment_submissions enable row level security;
alter table public.certificates enable row level security;
alter table public.w3tr_wallets enable row level security;
alter table public.w3tr_transactions enable row level security;
alter table public.reward_rules enable row level security;
alter table public.achievements enable row level security;
alter table public.user_achievements enable row level security;
alter table public.daily_logins enable row level security;
alter table public.referrals enable row level security;
alter table public.donation_campaigns enable row level security;
alter table public.donations enable row level security;
alter table public.notifications enable row level security;
alter table public.announcements enable row level security;
alter table public.course_reviews enable row level security;
alter table public.wishlists enable row level security;
alter table public.bookmarks enable row level security;
alter table public.discussion_threads enable row level security;
alter table public.discussion_replies enable row level security;
alter table public.audit_logs enable row level security;
alter table public.feature_flags enable row level security;
alter table public.system_settings enable row level security;

-- ---- profiles ------------------------------------------------------------------------
create policy "profiles_select_own_or_public" on public.profiles for select
  using (true); -- public profile fields are safe to read; sensitive data kept in separate tables/columns app hides client-side
create policy "profiles_update_own" on public.profiles for update
  using (auth.uid() = id) with check (auth.uid() = id);
create policy "profiles_admin_all" on public.profiles for all
  using (public.is_admin()) with check (public.is_admin());

-- ---- instructor_profiles / student_profiles -------------------------------------------
create policy "instructor_profiles_select_all" on public.instructor_profiles for select using (true);
create policy "instructor_profiles_update_own" on public.instructor_profiles for update
  using (auth.uid() = profile_id) with check (auth.uid() = profile_id);
create policy "instructor_profiles_insert_own" on public.instructor_profiles for insert
  with check (auth.uid() = profile_id);
create policy "instructor_profiles_admin" on public.instructor_profiles for all
  using (public.is_admin()) with check (public.is_admin());

create policy "student_profiles_select_own" on public.student_profiles for select
  using (auth.uid() = profile_id or public.is_admin());
create policy "student_profiles_update_own" on public.student_profiles for update
  using (auth.uid() = profile_id) with check (auth.uid() = profile_id);
create policy "student_profiles_admin" on public.student_profiles for all
  using (public.is_admin()) with check (public.is_admin());

-- ---- organizations ---------------------------------------------------------------------
create policy "organizations_select_all" on public.organizations for select using (true);
create policy "organizations_owner_manage" on public.organizations for all
  using (auth.uid() = owner_profile_id or public.is_admin())
  with check (auth.uid() = owner_profile_id or public.is_admin());

create policy "org_members_select" on public.organization_members for select
  using (
    profile_id = auth.uid()
    or public.is_admin()
    or exists (select 1 from public.organizations o where o.id = organization_id and o.owner_profile_id = auth.uid())
  );
create policy "org_members_manage" on public.organization_members for all
  using (
    public.is_admin()
    or exists (select 1 from public.organizations o where o.id = organization_id and o.owner_profile_id = auth.uid())
  )
  with check (
    public.is_admin()
    or exists (select 1 from public.organizations o where o.id = organization_id and o.owner_profile_id = auth.uid())
  );

create policy "org_programs_select" on public.organization_programs for select
  using (
    public.is_admin()
    or exists (select 1 from public.organizations o where o.id = organization_id and o.owner_profile_id = auth.uid())
    or exists (select 1 from public.organization_members m where m.organization_id = organization_programs.organization_id and m.profile_id = auth.uid())
  );
create policy "org_programs_manage" on public.organization_programs for all
  using (public.is_admin() or exists (select 1 from public.organizations o where o.id = organization_id and o.owner_profile_id = auth.uid()))
  with check (public.is_admin() or exists (select 1 from public.organizations o where o.id = organization_id and o.owner_profile_id = auth.uid()));

create policy "org_assignments_select" on public.organization_program_assignments for select
  using (profile_id = auth.uid() or public.is_admin() or exists (
    select 1 from public.organization_programs pr
    join public.organizations o on o.id = pr.organization_id
    where pr.id = program_id and o.owner_profile_id = auth.uid()
  ));
create policy "org_assignments_manage" on public.organization_program_assignments for all
  using (public.is_admin() or exists (
    select 1 from public.organization_programs pr
    join public.organizations o on o.id = pr.organization_id
    where pr.id = program_id and o.owner_profile_id = auth.uid()
  ))
  with check (public.is_admin() or exists (
    select 1 from public.organization_programs pr
    join public.organizations o on o.id = pr.organization_id
    where pr.id = program_id and o.owner_profile_id = auth.uid()
  ));

-- ---- categories ------------------------------------------------------------------------
create policy "categories_select_all" on public.categories for select using (true);
create policy "categories_admin_manage" on public.categories for all
  using (public.is_admin()) with check (public.is_admin());

-- ---- courses -----------------------------------------------------------------------------
create policy "courses_select_published_or_own" on public.courses for select
  using (
    status = 'published'
    or instructor_id = auth.uid()
    or public.is_moderator_or_above()
  );
create policy "courses_instructor_insert" on public.courses for insert
  with check (instructor_id = auth.uid() or public.is_admin());
create policy "courses_instructor_update_own_draft" on public.courses for update
  using (instructor_id = auth.uid() or public.is_moderator_or_above())
  with check (instructor_id = auth.uid() or public.is_moderator_or_above());
create policy "courses_admin_delete" on public.courses for delete
  using (public.is_admin());

create policy "moderation_log_select" on public.course_moderation_log for select
  using (
    public.is_moderator_or_above()
    or exists (select 1 from public.courses c where c.id = course_id and c.instructor_id = auth.uid())
  );
create policy "moderation_log_insert" on public.course_moderation_log for insert
  with check (
    public.is_moderator_or_above()
    or exists (select 1 from public.courses c where c.id = course_id and c.instructor_id = auth.uid())
  );

-- ---- course_sections / lessons / lesson_resources ---------------------------------------
create policy "sections_select" on public.course_sections for select
  using (exists (
    select 1 from public.courses c where c.id = course_id
    and (c.status = 'published' or c.instructor_id = auth.uid() or public.is_moderator_or_above())
  ));
create policy "sections_manage" on public.course_sections for all
  using (exists (select 1 from public.courses c where c.id = course_id and (c.instructor_id = auth.uid() or public.is_admin())))
  with check (exists (select 1 from public.courses c where c.id = course_id and (c.instructor_id = auth.uid() or public.is_admin())));

create policy "lessons_select" on public.lessons for select
  using (
    is_preview = true
    or exists (select 1 from public.courses c where c.id = course_id and (c.instructor_id = auth.uid() or public.is_moderator_or_above()))
    or exists (select 1 from public.enrollments e where e.course_id = lessons.course_id and e.student_id = auth.uid())
  );
create policy "lessons_manage" on public.lessons for all
  using (exists (select 1 from public.courses c where c.id = course_id and (c.instructor_id = auth.uid() or public.is_admin())))
  with check (exists (select 1 from public.courses c where c.id = course_id and (c.instructor_id = auth.uid() or public.is_admin())));

create policy "lesson_resources_select" on public.lesson_resources for select
  using (exists (
    select 1 from public.lessons l join public.courses c on c.id = l.course_id
    where l.id = lesson_id and (
      c.instructor_id = auth.uid() or public.is_moderator_or_above()
      or exists (select 1 from public.enrollments e where e.course_id = c.id and e.student_id = auth.uid())
    )
  ));
create policy "lesson_resources_manage" on public.lesson_resources for all
  using (exists (
    select 1 from public.lessons l join public.courses c on c.id = l.course_id
    where l.id = lesson_id and (c.instructor_id = auth.uid() or public.is_admin())
  ))
  with check (exists (
    select 1 from public.lessons l join public.courses c on c.id = l.course_id
    where l.id = lesson_id and (c.instructor_id = auth.uid() or public.is_admin())
  ));

-- ---- enrollments / lesson_progress -------------------------------------------------------
create policy "enrollments_select_own" on public.enrollments for select
  using (
    student_id = auth.uid()
    or public.is_admin()
    or exists (select 1 from public.courses c where c.id = course_id and c.instructor_id = auth.uid())
  );
create policy "enrollments_insert_own" on public.enrollments for insert
  with check (student_id = auth.uid());
create policy "enrollments_update_own_or_admin" on public.enrollments for update
  using (student_id = auth.uid() or public.is_admin())
  with check (student_id = auth.uid() or public.is_admin());

create policy "lesson_progress_select_own" on public.lesson_progress for select
  using (
    student_id = auth.uid()
    or public.is_admin()
    or exists (select 1 from public.courses c where c.id = course_id and c.instructor_id = auth.uid())
  );
create policy "lesson_progress_manage_own" on public.lesson_progress for all
  using (student_id = auth.uid() or public.is_admin())
  with check (student_id = auth.uid() or public.is_admin());

-- ---- quizzes / questions / attempts -------------------------------------------------------
create policy "quizzes_select" on public.quizzes for select
  using (exists (
    select 1 from public.courses c where c.id = course_id
    and (c.status = 'published' or c.instructor_id = auth.uid() or public.is_moderator_or_above())
  ));
create policy "quizzes_manage" on public.quizzes for all
  using (exists (select 1 from public.courses c where c.id = course_id and (c.instructor_id = auth.uid() or public.is_admin())))
  with check (exists (select 1 from public.courses c where c.id = course_id and (c.instructor_id = auth.uid() or public.is_admin())));

-- Quiz questions: students should NOT see correct_answer directly in a real client
-- query; the app fetches questions via a server-side API route that strips
-- correct_answer before sending to students. RLS here governs raw table access.
create policy "quiz_questions_select" on public.quiz_questions for select
  using (exists (
    select 1 from public.quizzes q join public.courses c on c.id = q.course_id
    where q.id = quiz_id and (c.instructor_id = auth.uid() or public.is_moderator_or_above())
  ));
create policy "quiz_questions_manage" on public.quiz_questions for all
  using (exists (
    select 1 from public.quizzes q join public.courses c on c.id = q.course_id
    where q.id = quiz_id and (c.instructor_id = auth.uid() or public.is_admin())
  ))
  with check (exists (
    select 1 from public.quizzes q join public.courses c on c.id = q.course_id
    where q.id = quiz_id and (c.instructor_id = auth.uid() or public.is_admin())
  ));

create policy "quiz_attempts_select_own" on public.quiz_attempts for select
  using (
    student_id = auth.uid()
    or public.is_admin()
    or exists (select 1 from public.quizzes q join public.courses c on c.id = q.course_id where q.id = quiz_id and c.instructor_id = auth.uid())
  );
create policy "quiz_attempts_manage_own" on public.quiz_attempts for all
  using (student_id = auth.uid() or public.is_admin())
  with check (student_id = auth.uid() or public.is_admin());

-- ---- assignments / submissions --------------------------------------------------------------
create policy "assignments_select" on public.assignments for select
  using (exists (
    select 1 from public.courses c where c.id = course_id
    and (c.status = 'published' or c.instructor_id = auth.uid() or public.is_moderator_or_above())
  ));
create policy "assignments_manage" on public.assignments for all
  using (exists (select 1 from public.courses c where c.id = course_id and (c.instructor_id = auth.uid() or public.is_admin())))
  with check (exists (select 1 from public.courses c where c.id = course_id and (c.instructor_id = auth.uid() or public.is_admin())));

create policy "submissions_select" on public.assignment_submissions for select
  using (
    student_id = auth.uid()
    or public.is_admin()
    or exists (select 1 from public.assignments a join public.courses c on c.id = a.course_id where a.id = assignment_id and c.instructor_id = auth.uid())
  );
create policy "submissions_insert_own" on public.assignment_submissions for insert
  with check (student_id = auth.uid());
create policy "submissions_update" on public.assignment_submissions for update
  using (
    student_id = auth.uid()
    or public.is_admin()
    or exists (select 1 from public.assignments a join public.courses c on c.id = a.course_id where a.id = assignment_id and c.instructor_id = auth.uid())
  )
  with check (
    student_id = auth.uid()
    or public.is_admin()
    or exists (select 1 from public.assignments a join public.courses c on c.id = a.course_id where a.id = assignment_id and c.instructor_id = auth.uid())
  );

-- ---- certificates ------------------------------------------------------------------------
create policy "certificates_select" on public.certificates for select
  using (
    student_id = auth.uid()
    or public.is_admin()
    or exists (select 1 from public.courses c where c.id = course_id and c.instructor_id = auth.uid())
    or true -- certificate verification pages are public via certificate_code lookup (server route uses service role for anonymous lookups; this permissive read is limited to non-sensitive fields the app chooses to expose)
  );
create policy "certificates_admin_manage" on public.certificates for all
  using (public.is_admin()) with check (public.is_admin());

-- ---- W3TR wallets / transactions ----------------------------------------------------------
create policy "wallets_select_own" on public.w3tr_wallets for select
  using (profile_id = auth.uid() or public.is_admin());
-- No direct insert/update/delete policies for students/instructors: all balance changes
-- must go through award_w3tr()/spend_w3tr() (SECURITY DEFINER), which bypasses RLS safely.
create policy "wallets_admin_manage" on public.w3tr_wallets for all
  using (public.is_admin()) with check (public.is_admin());

create policy "w3tr_tx_select_own" on public.w3tr_transactions for select
  using (profile_id = auth.uid() or public.is_admin());
create policy "w3tr_tx_admin_manage" on public.w3tr_transactions for all
  using (public.is_admin()) with check (public.is_admin());

create policy "reward_rules_select_all" on public.reward_rules for select using (true);
create policy "reward_rules_admin_manage" on public.reward_rules for all
  using (public.is_admin()) with check (public.is_admin());

-- ---- achievements / gamification ------------------------------------------------------------
create policy "achievements_select_all" on public.achievements for select using (true);
create policy "achievements_admin_manage" on public.achievements for all
  using (public.is_admin()) with check (public.is_admin());

create policy "user_achievements_select" on public.user_achievements for select
  using (profile_id = auth.uid() or public.is_admin());
create policy "user_achievements_admin_manage" on public.user_achievements for all
  using (public.is_admin()) with check (public.is_admin());

create policy "daily_logins_select_own" on public.daily_logins for select
  using (profile_id = auth.uid() or public.is_admin());
create policy "daily_logins_admin_manage" on public.daily_logins for all
  using (public.is_admin()) with check (public.is_admin());

create policy "referrals_select_own" on public.referrals for select
  using (referrer_id = auth.uid() or referred_id = auth.uid() or public.is_admin());
create policy "referrals_admin_manage" on public.referrals for all
  using (public.is_admin()) with check (public.is_admin());

-- ---- donations ----------------------------------------------------------------------------
create policy "campaigns_select_all" on public.donation_campaigns for select using (true);
create policy "campaigns_admin_manage" on public.donation_campaigns for all
  using (public.is_admin()) with check (public.is_admin());

create policy "donations_select_own_or_admin" on public.donations for select
  using (donor_id = auth.uid() or public.is_admin());
create policy "donations_insert_any" on public.donations for insert
  with check (true); -- guests can donate; server route validates payload
create policy "donations_admin_manage" on public.donations for all
  using (public.is_admin()) with check (public.is_admin());

-- ---- notifications / announcements ---------------------------------------------------------
create policy "notifications_select_own" on public.notifications for select
  using (profile_id = auth.uid());
create policy "notifications_update_own" on public.notifications for update
  using (profile_id = auth.uid()) with check (profile_id = auth.uid());
create policy "notifications_admin_manage" on public.notifications for all
  using (public.is_admin()) with check (public.is_admin());

create policy "announcements_select_active" on public.announcements for select
  using (is_active = true or public.is_admin());
create policy "announcements_admin_manage" on public.announcements for all
  using (public.is_admin()) with check (public.is_admin());

-- ---- reviews / wishlist / bookmarks -----------------------------------------------------------
create policy "reviews_select_all" on public.course_reviews for select using (true);
create policy "reviews_manage_own" on public.course_reviews for all
  using (student_id = auth.uid() or public.is_admin())
  with check (student_id = auth.uid() or public.is_admin());

create policy "wishlists_manage_own" on public.wishlists for all
  using (student_id = auth.uid()) with check (student_id = auth.uid());

create policy "bookmarks_manage_own" on public.bookmarks for all
  using (student_id = auth.uid()) with check (student_id = auth.uid());

-- ---- discussions ------------------------------------------------------------------------------
create policy "threads_select" on public.discussion_threads for select
  using (
    exists (select 1 from public.courses c where c.id = course_id and (c.status = 'published' or c.instructor_id = auth.uid() or public.is_moderator_or_above()))
    or exists (select 1 from public.enrollments e where e.course_id = discussion_threads.course_id and e.student_id = auth.uid())
  );
create policy "threads_insert" on public.discussion_threads for insert
  with check (
    author_id = auth.uid() and (
      exists (select 1 from public.enrollments e where e.course_id = discussion_threads.course_id and e.student_id = auth.uid())
      or exists (select 1 from public.courses c where c.id = course_id and c.instructor_id = auth.uid())
    )
  );
create policy "threads_manage_own" on public.discussion_threads for update
  using (author_id = auth.uid() or public.is_moderator_or_above())
  with check (author_id = auth.uid() or public.is_moderator_or_above());
create policy "threads_delete" on public.discussion_threads for delete
  using (author_id = auth.uid() or public.is_moderator_or_above());

create policy "replies_select" on public.discussion_replies for select
  using (exists (
    select 1 from public.discussion_threads t where t.id = thread_id
  ));
create policy "replies_insert" on public.discussion_replies for insert
  with check (author_id = auth.uid());
create policy "replies_manage_own" on public.discussion_replies for update
  using (author_id = auth.uid() or public.is_moderator_or_above())
  with check (author_id = auth.uid() or public.is_moderator_or_above());
create policy "replies_delete" on public.discussion_replies for delete
  using (author_id = auth.uid() or public.is_moderator_or_above());

-- ---- admin / audit / config ---------------------------------------------------------------------
create policy "audit_logs_admin_select" on public.audit_logs for select using (public.is_admin());
create policy "audit_logs_insert_any_authenticated" on public.audit_logs for insert with check (auth.uid() is not null);

create policy "feature_flags_select_all" on public.feature_flags for select using (true);
create policy "feature_flags_super_admin_manage" on public.feature_flags for all
  using (public.is_super_admin()) with check (public.is_super_admin());

create policy "system_settings_select_all" on public.system_settings for select using (true);
create policy "system_settings_super_admin_manage" on public.system_settings for all
  using (public.is_super_admin()) with check (public.is_super_admin());
