-- =====================================================================================
-- WEB3TRIBE UNIVERSITY — SEED DATA
-- =====================================================================================
-- Run this AFTER 0001_schema.sql and 0002_storage.sql. Populates categories, sample
-- reward rules, feature flags, and a handful of sample courses so the platform isn't
-- an empty shell on first run. Safe to run once; re-running will attempt duplicate
-- inserts for uniquely-keyed rows (categories, reward_rules, feature_flags) which
-- will simply no-op due to the ON CONFLICT clauses below, but will create additional
-- duplicate sample courses if re-run, since courses have no natural unique business
-- key beyond their generated slug. Check for existing sample data before re-running
-- in an environment that already has real content.
-- =====================================================================================

-- ---- Categories ----------------------------------------------------------------------
insert into public.categories (name, slug, icon, display_order) values
  ('Artificial Intelligence', 'artificial-intelligence', 'brain', 1),
  ('Cybersecurity', 'cybersecurity', 'shield-check', 2),
  ('Programming', 'programming', 'code', 3),
  ('Data Science', 'data-science', 'database', 4),
  ('Blockchain', 'blockchain', 'link', 5),
  ('Cloud Computing', 'cloud-computing', 'cloud', 6),
  ('Business', 'business', 'briefcase', 7),
  ('Finance', 'finance', 'landmark', 8),
  ('Agriculture', 'agriculture', 'sprout', 9),
  ('Healthcare', 'healthcare', 'heart-pulse', 10),
  ('Education', 'education', 'graduation-cap', 11),
  ('Creative Arts', 'creative-arts', 'palette', 12),
  ('Entrepreneurship', 'entrepreneurship', 'rocket', 13),
  ('Manufacturing', 'manufacturing', 'factory', 14),
  ('Renewable Energy', 'renewable-energy', 'sun', 15),
  ('Government', 'government', 'landmark', 16),
  ('Vocational Skills', 'vocational-skills', 'wrench', 17),
  ('Emerging Technologies', 'emerging-technologies', 'sparkles', 18)
on conflict (slug) do nothing;

-- ---- Reward rules (FIXED platform-wide amounts — see lib/tokenomics.ts and
-- migration 0003_tokenomics_and_resources.sql, which is the authoritative source;
-- these values are kept identical here so the seed produces a consistent result
-- regardless of whether you run seed.sql before or after 0003) --------------------
insert into public.reward_rules (rule_key, label, amount, is_active) values
  ('lesson_complete', 'Lesson completed', 1, true),
  ('quiz_pass', 'Lesson quiz passed', 2, true),
  ('exam_pass', 'Final exam passed', 10, true),
  ('course_complete', 'Course completed', 20, true),
  ('daily_login', 'Daily login', 2, true),
  ('streak_bonus_weekly', 'Weekly streak bonus (7-day)', 20, true),
  ('referral_bonus', 'Successful referral', 30, true),
  ('course_publish_bonus', 'Instructor course approved & published', 100, true),
  ('high_rating_bonus', 'Course reaches 4.5+ average rating', 50, true)
on conflict (rule_key) do nothing;

-- ---- Feature flags (documents the future blockchain-adapter seam explicitly) --------
insert into public.feature_flags (flag_key, label, description, is_enabled, rollout_percent) values
  (
    'blockchain_adapter_enabled',
    'On-chain W3TR Adapter',
    'When enabled (future use, pending licensing), mirrors W3TR ledger transactions to an on-chain representation via a pluggable RewardEngine implementation. Do not enable without legal/compliance sign-off.',
    false,
    0
  ),
  (
    'donations_flutterwave_enabled',
    'Flutterwave Donations',
    'Enables Flutterwave as a donation payment method alongside Paystack.',
    false,
    100
  ),
  (
    'push_notifications_enabled',
    'Push Notifications',
    'Enables web push notifications (requires VAPID keys to be configured).',
    false,
    100
  )
on conflict (flag_key) do nothing;

-- ---- System settings defaults ---------------------------------------------------------
insert into public.system_settings (key, value, description) values
  ('maintenance_mode', '{"enabled": false}', 'When true, non-admin users should see a maintenance page.'),
  ('platform_name', '"Web3tribe University"', 'Displayed platform name.'),
  ('support_email', '"support@theweb3alliance.org"', 'Support contact email shown in footers and error pages.')
on conflict (key) do nothing;

-- ---- Sample donation campaign ---------------------------------------------------------
insert into public.donation_campaigns (title, slug, description, goal_amount, currency, is_active)
values (
  'Scholarships for Underserved Communities',
  'scholarships-underserved-communities',
  'Fund free course access and community digital labs for out-of-school youth and women in underserved communities across Nigeria.',
  5000000,
  'NGN',
  true
)
on conflict (slug) do nothing;

-- =====================================================================================
-- NOTE ON SAMPLE COURSES AND USERS
-- =====================================================================================
-- Sample courses require a valid instructor_id referencing a real row in auth.users
-- (created via Supabase Auth, e.g. through the /register page), because
-- courses.instructor_id has a foreign key to public.profiles(id), which itself is
-- keyed to auth.users(id). You cannot seed a fake auth.users row directly through
-- SQL in a real Supabase project (auth.users is managed by GoTrue).
--
-- To load sample courses:
--   1. Register at least one instructor account through the app (role: instructor).
--   2. Find that user's id: select id, email from public.profiles where role = 'instructor';
--   3. Run the block below, replacing 'PASTE-INSTRUCTOR-PROFILE-ID-HERE'.
--
-- A ready-to-run version of this block, with the placeholder already prepared for
-- substitution, is provided so you only need to change one value.
-- =====================================================================================

do $$
declare
  v_instructor_id uuid;
  v_ai_category uuid;
  v_course_id uuid;
  v_section_id uuid;
begin
  -- Attempt to auto-detect an existing instructor; if none exists yet, this block
  -- exits quietly rather than failing the whole seed script.
  select id into v_instructor_id from public.profiles where role = 'instructor' limit 1;

  if v_instructor_id is null then
    raise notice 'No instructor account found yet — skipping sample course creation. Register an instructor account and re-run this block manually (see comment above).';
    return;
  end if;

  select id into v_ai_category from public.categories where slug = 'artificial-intelligence';

  insert into public.courses (
    instructor_id, category_id, title, slug, subtitle, description, level, status,
    price_w3tr, estimated_hours, requirements, learning_outcomes, published_at
  ) values (
    v_instructor_id,
    v_ai_category,
    'Introduction to Artificial Intelligence',
    'introduction-to-artificial-intelligence',
    'A beginner-friendly guide to AI concepts and applications',
    'This course introduces the fundamentals of artificial intelligence, covering machine learning basics, real-world applications, and hands-on examples relevant to the Nigerian digital economy.',
    'beginner',
    'published',
    0,
    6,
    array['Basic computer literacy', 'No prior programming experience required'],
    array['Understand core AI concepts', 'Identify real-world AI applications', 'Recognize AI ethics considerations'],
    now()
  )
  returning id into v_course_id;

  insert into public.course_sections (course_id, title, display_order) values (v_course_id, 'Getting Started', 1)
  returning id into v_section_id;

  insert into public.lessons (section_id, course_id, title, content_type, display_order, is_preview, w3tr_reward) values
    (v_section_id, v_course_id, 'What is Artificial Intelligence?', 'video', 1, true, 1),
    (v_section_id, v_course_id, 'A Brief History of AI', 'video', 2, false, 1),
    (v_section_id, v_course_id, 'AI in Everyday Life', 'text', 3, false, 1);

  raise notice 'Sample course created with instructor_id = %', v_instructor_id;
end $$;
