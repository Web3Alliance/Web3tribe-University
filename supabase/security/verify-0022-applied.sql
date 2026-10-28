-- =====================================================================================
-- VERIFY THAT MIGRATION 0022 IS FULLY APPLIED  (read-only; paste into the Supabase SQL editor)
-- =====================================================================================
-- Returns one row per check. Every row should say PASS. Any FAIL names the part of 0022
-- that is missing in THIS Supabase project (for example if it was run on a different
-- project, or stopped part-way). It only reads Postgres' permission catalogue; it changes nothing.
-- =====================================================================================
select check_name, expected, actual,
       case when actual = expected then 'PASS' else 'FAIL' end as result
from (values
  -- 1. the five privileged functions are NOT callable from the browser, but the server can still call them
  ('anon cannot execute award_w3tr',                 false, has_function_privilege('anon',          'public.award_w3tr(uuid, public.w3tr_transaction_type, numeric, text, uuid, text, uuid)', 'execute')),
  ('authenticated cannot execute award_w3tr',        false, has_function_privilege('authenticated', 'public.award_w3tr(uuid, public.w3tr_transaction_type, numeric, text, uuid, text, uuid)', 'execute')),
  ('anon cannot execute spend_w3tr',                 false, has_function_privilege('anon',          'public.spend_w3tr(uuid, numeric, text, uuid, text)', 'execute')),
  ('authenticated cannot execute spend_w3tr',        false, has_function_privilege('authenticated', 'public.spend_w3tr(uuid, numeric, text, uuid, text)', 'execute')),
  ('anon cannot execute complete_lesson',            false, has_function_privilege('anon',          'public.complete_lesson(uuid, uuid)', 'execute')),
  ('authenticated cannot execute complete_lesson',   false, has_function_privilege('authenticated', 'public.complete_lesson(uuid, uuid)', 'execute')),
  ('anon cannot execute record_daily_login',         false, has_function_privilege('anon',          'public.record_daily_login(uuid)', 'execute')),
  ('authenticated cannot execute record_daily_login',false, has_function_privilege('authenticated', 'public.record_daily_login(uuid)', 'execute')),
  ('anon cannot execute increment_campaign_raised',  false, has_function_privilege('anon',          'public.increment_campaign_raised(uuid, numeric)', 'execute')),
  ('authenticated cannot execute increment_campaign_raised', false, has_function_privilege('authenticated', 'public.increment_campaign_raised(uuid, numeric)', 'execute')),
  ('server (service_role) CAN execute award_w3tr',   true,  has_function_privilege('service_role',  'public.award_w3tr(uuid, public.w3tr_transaction_type, numeric, text, uuid, text, uuid)', 'execute')),
  ('server (service_role) CAN execute complete_lesson', true, has_function_privilege('service_role', 'public.complete_lesson(uuid, uuid)', 'execute')),

  -- 2. sign-up trigger no longer trusts a client-supplied role
  ('signup trigger allow-lists student/instructor/organization', true,
     position('v_requested_role in (''student'', ''instructor'', ''organization'')' in pg_get_functiondef('public.handle_new_auth_user()'::regprocedure)) > 0),
  ('complete_lesson rejects a lesson from another course', true,
     position('does not belong to this course' in pg_get_functiondef('public.complete_lesson(uuid, uuid)'::regprocedure)) > 0),

  -- 3. column-protection triggers exist
  ('5 column-protection triggers installed', true,
     (select count(*) from pg_trigger where not tgisinternal and tgname in
        ('trg_profiles_protect','trg_instructor_profiles_protect','trg_student_profiles_protect','trg_courses_protect_publish','trg_submissions_protect')) = 5),

  -- 4. academic / ledger records are not writable from the browser
  ('authenticated cannot INSERT enrollments',        false, has_table_privilege('authenticated', 'public.enrollments',       'INSERT')),
  ('authenticated cannot UPDATE enrollments',        false, has_table_privilege('authenticated', 'public.enrollments',       'UPDATE')),
  ('authenticated cannot INSERT lesson_progress',    false, has_table_privilege('authenticated', 'public.lesson_progress',   'INSERT')),
  ('authenticated cannot INSERT quiz_attempts',      false, has_table_privilege('authenticated', 'public.quiz_attempts',     'INSERT')),
  ('authenticated cannot UPDATE w3tr_wallets',       false, has_table_privilege('authenticated', 'public.w3tr_wallets',      'UPDATE')),
  ('authenticated cannot INSERT w3tr_transactions',  false, has_table_privilege('authenticated', 'public.w3tr_transactions', 'INSERT')),
  ('old student write policies are gone', true,
     not exists (select 1 from pg_policies where schemaname = 'public' and policyname in
        ('enrollments_insert_own','enrollments_update_own_or_admin','lesson_progress_manage_own','quiz_attempts_manage_own'))),
  ('server (service_role) CAN still insert enrollments', true, has_table_privilege('service_role', 'public.enrollments', 'INSERT')),

  -- 5. what a logged-out visitor can read
  ('anon cannot read profiles.email',                false, has_column_privilege('anon', 'public.profiles', 'email', 'select')),
  ('anon cannot read profiles.role',                 false, has_column_privilege('anon', 'public.profiles', 'role',  'select')),
  ('anon CAN read profiles.full_name (public pages need it)', true, has_column_privilege('anon', 'public.profiles', 'full_name', 'select')),
  ('anon CAN read profiles.avatar_url (public pages need it)', true, has_column_privilege('anon', 'public.profiles', 'avatar_url', 'select')),
  ('anon cannot read the leaderboard',               false, has_table_privilege('anon', 'public.leaderboard',     'SELECT')),
  ('anon cannot read system_settings',               false, has_table_privilege('anon', 'public.system_settings', 'SELECT')),
  ('anon cannot read feature_flags',                 false, has_table_privilege('anon', 'public.feature_flags',   'SELECT')),
  ('anon cannot read reward_rules',                  false, has_table_privilege('anon', 'public.reward_rules',    'SELECT')),
  ('anon cannot read instructor verification notes', false, has_column_privilege('anon',          'public.instructor_profiles', 'verification_notes',        'select')),
  ('logged-in users cannot read instructor verification documents', false, has_column_privilege('authenticated', 'public.instructor_profiles', 'verification_document_url', 'select')),
  ('certificates policy no longer says "or true"', true,
     coalesce((select qual !~* 'true' from pg_policies where schemaname = 'public' and tablename = 'certificates' and policyname = 'certificates_select'), false)),
  ('donations: only unconfirmed rows can be inserted', true,
     exists (select 1 from pg_policies where schemaname = 'public' and policyname = 'donations_insert_pending_only')
     and not exists (select 1 from pg_policies where schemaname = 'public' and policyname = 'donations_insert_any')),

  -- 6. storage
  ('avatar UPDATE policy validates the destination (WITH CHECK)', true,
     coalesce((select with_check is not null from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'avatars_own_update'), false)),
  ('anonymous storage listing policies removed', true,
     not exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname in
        ('avatars_public_read','certificates_public_read','course_documents_public_read','course_images_public_read','course_videos_public_read'))),

  -- 7. future functions are server-only by default
  ('new functions are NOT executable by everyone by default', true,
     exists (select 1 from pg_default_acl d join pg_roles r on r.oid = d.defaclrole
             where r.rolname = 'postgres' and d.defaclnamespace = 0 and d.defaclobjtype = 'f'
               and not exists (select 1 from aclexplode(d.defaclacl) a where a.grantee = 0)))
) as t(check_name, expected, actual)
order by (actual = expected), check_name;
