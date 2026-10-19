-- =====================================================================================
-- 0022: SECURITY HARDENING  (response to the BugBunny audit + a follow-up code review)
-- =====================================================================================
-- ROOT CAUSES this migration removes:
--
--   (a) The browser-facing "anon" and "authenticated" roles could execute privileged
--       SECURITY DEFINER functions (award_w3tr, spend_w3tr, complete_lesson,
--       record_daily_login, increment_campaign_raised). Postgres/Supabase grant EXECUTE
--       on new functions to everyone by default, and no migration ever revoked it.
--       => anyone could mint W3TR, drain wallets and forge progress.
--   (b) Row Level Security was used to decide *which rows* a user may touch, but never
--       *which columns*. A user could therefore rewrite their own `role`, `is_banned`,
--       `verification_status`, enrolment `status/progress`, quiz `passed`, etc.
--   (c) The signup trigger trusted a client-supplied `role` value (so anyone could
--       register as super_admin).
--   (d) Several tables were readable by anonymous visitors in full (profiles incl.
--       e-mail addresses, leaderboard, certificates, admin config, instructor
--       verification documents).
--   (e) Storage UPDATE policies had no WITH CHECK, so an object could be MOVED into
--       another user's folder.
--
-- DEPLOY ORDER MATTERS:  deploy the application code that ships with this change FIRST
-- (it performs the privileged writes with the server-only service-role key), THEN run
-- this migration.  The new code works both before and after this migration.
--
-- Everything below is idempotent (safe to run twice).
-- =====================================================================================


-- =====================================================================================
-- 1. SIGN-UP: NEVER TRUST A CLIENT-SUPPLIED ROLE
-- =====================================================================================
-- The registration form legitimately offers student / instructor / organization, and the
-- server action already allow-lists those three. The database trigger must enforce the
-- same list, because anyone can call the Auth API directly with arbitrary metadata.
-- Anything else (admin, super_admin, moderator, or garbage) becomes 'student'.
create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_referral_code text;
  v_requested_role text := new.raw_user_meta_data->>'role';
  v_role user_role := case
    when v_requested_role in ('student', 'instructor', 'organization') then v_requested_role::user_role
    else 'student'::user_role
  end;
begin
  insert into public.profiles (id, email, full_name, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    v_role
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


-- =====================================================================================
-- 2. COLUMN PROTECTION (RLS decides rows; these triggers decide columns)
-- =====================================================================================
-- Convention used by every trigger below:
--   * `current_user not in ('anon','authenticated')`  => the statement is coming from the
--     server (service_role), the Supabase SQL editor (postgres) or from inside one of our
--     SECURITY DEFINER functions. That is trusted code and is never restricted here.
--   * Otherwise it is an end user talking to PostgREST with their own JWT: restricted.

-- ---- 2a. profiles ---------------------------------------------------------------------
create or replace function public.protect_profile_columns()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if current_user not in ('anon', 'authenticated') then
    return new;
  end if;

  if public.is_admin() then
    -- Staff may moderate users, but the role hierarchy is enforced here as well as in the app.
    if new.role is distinct from old.role then
      if new.id = auth.uid() then
        raise exception 'You cannot change your own role.' using errcode = '42501';
      end if;
      if not public.is_super_admin()
         and (new.role in ('admin', 'super_admin') or old.role in ('admin', 'super_admin')) then
        raise exception 'Only a super admin can grant or revoke admin roles.' using errcode = '42501';
      end if;
    end if;
    if (new.is_banned is distinct from old.is_banned or new.ban_reason is distinct from old.ban_reason)
       and old.role in ('admin', 'super_admin')
       and not public.is_super_admin() then
      raise exception 'Only a super admin can ban or unban an admin.' using errcode = '42501';
    end if;
    return new;
  end if;

  -- Ordinary user editing their own profile: identity / privilege / trust columns are read-only.
  if new.role is distinct from old.role
     or new.email is distinct from old.email
     or new.is_banned is distinct from old.is_banned
     or new.ban_reason is distinct from old.ban_reason
     or new.is_active is distinct from old.is_active
     or new.is_instructor_verified is distinct from old.is_instructor_verified
     or new.phone_verified is distinct from old.phone_verified
     or new.two_factor_enabled is distinct from old.two_factor_enabled then
    raise exception 'Not allowed to change protected profile fields.' using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_profiles_protect on public.profiles;
create trigger trg_profiles_protect
  before update on public.profiles
  for each row execute function public.protect_profile_columns();

-- ---- 2b. instructor_profiles (self-verification / fake ratings) ----------------------------
create or replace function public.protect_instructor_profile_columns()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if current_user not in ('anon', 'authenticated') or public.is_admin() then
    return new;
  end if;

  if tg_op = 'INSERT' then
    if new.verification_status not in ('unverified', 'pending')
       or new.verification_notes is not null
       or new.total_students <> 0
       or new.average_rating <> 0 then
      raise exception 'Not allowed to set verification or rating fields.' using errcode = '42501';
    end if;
    return new;
  end if;

  if new.verification_notes is distinct from old.verification_notes
     or new.total_students is distinct from old.total_students
     or new.average_rating is distinct from old.average_rating then
    raise exception 'Not allowed to change verification or rating fields.' using errcode = '42501';
  end if;
  if new.verification_status is distinct from old.verification_status
     and not (new.verification_status = 'pending' and old.verification_status in ('unverified', 'rejected')) then
    raise exception 'Only an admin can change verification status.' using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_instructor_profiles_protect on public.instructor_profiles;
create trigger trg_instructor_profiles_protect
  before insert or update on public.instructor_profiles
  for each row execute function public.protect_instructor_profile_columns();

-- ---- 2c. student_profiles (counters that feed the leaderboard / referrals) -----------------
create or replace function public.protect_student_profile_columns()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if current_user not in ('anon', 'authenticated') or public.is_admin() then
    return new;
  end if;
  if new.current_streak_days is distinct from old.current_streak_days
     or new.longest_streak_days is distinct from old.longest_streak_days
     or new.last_activity_date is distinct from old.last_activity_date
     or new.total_lessons_completed is distinct from old.total_lessons_completed
     or new.total_courses_completed is distinct from old.total_courses_completed
     or new.referral_code is distinct from old.referral_code
     or new.referred_by is distinct from old.referred_by then
    raise exception 'Not allowed to change progress or referral fields.' using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_student_profiles_protect on public.student_profiles;
create trigger trg_student_profiles_protect
  before update on public.student_profiles
  for each row execute function public.protect_student_profile_columns();

-- ---- 2d. courses: only moderators may publish (bypassing moderation) -----------------------
create or replace function public.protect_course_publish()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if current_user not in ('anon', 'authenticated') or public.is_moderator_or_above() then
    return new;
  end if;
  if new.status in ('published', 'approved', 'rejected', 'changes_requested')
     and (tg_op = 'INSERT' or new.status is distinct from old.status) then
    raise exception 'Only a moderator or admin can publish or review a course.' using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_courses_protect_publish on public.courses;
create trigger trg_courses_protect_publish
  before insert or update on public.courses
  for each row execute function public.protect_course_publish();

-- ---- 2e. assignment_submissions: students may not grade themselves -------------------------
create or replace function public.is_assignment_grader(p_assignment_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_admin() or exists (
    select 1 from public.assignments a
    join public.courses c on c.id = a.course_id
    where a.id = p_assignment_id and c.instructor_id = auth.uid()
  );
$$;

create or replace function public.protect_submission_grading()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if current_user not in ('anon', 'authenticated') or public.is_assignment_grader(new.assignment_id) then
    return new;
  end if;
  if tg_op = 'INSERT' then
    if new.score is not null or new.feedback is not null or new.graded_at is not null
       or new.graded_by is not null or new.status <> 'submitted' then
      raise exception 'Not allowed to set grading fields.' using errcode = '42501';
    end if;
    return new;
  end if;
  if new.score is distinct from old.score or new.feedback is distinct from old.feedback
     or new.status is distinct from old.status or new.graded_at is distinct from old.graded_at
     or new.graded_by is distinct from old.graded_by then
    raise exception 'Only the course instructor can grade a submission.' using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_submissions_protect on public.assignment_submissions;
create trigger trg_submissions_protect
  before insert or update on public.assignment_submissions
  for each row execute function public.protect_submission_grading();


-- =====================================================================================
-- 3. PRIVILEGED FUNCTIONS: SERVER ONLY
-- =====================================================================================
-- complete_lesson now also (1) refuses to act on someone else's enrolment if it is ever
-- reached with a user JWT, and (2) refuses a lesson that belongs to a different course
-- (previously a student could complete lessons from a paid course on a free enrolment).
-- Body is otherwise identical to 0003.
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
  v_lesson_course_id uuid;
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

  if current_user in ('anon', 'authenticated') and auth.uid() is distinct from v_student_id then
    raise exception 'complete_lesson: not your enrollment' using errcode = '42501';
  end if;

  select course_id into v_lesson_course_id from public.lessons where id = p_lesson_id;
  if v_lesson_course_id is distinct from v_course_id then
    raise exception 'complete_lesson: lesson % does not belong to this course', p_lesson_id using errcode = '22023';
  end if;

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
    perform public.award_w3tr(v_student_id, 'lesson_complete', coalesce(v_reward, 1), 'lessons', p_lesson_id, 'Lesson completed');
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
    perform public.award_w3tr(v_student_id, 'course_complete', 20, 'courses', v_course_id, 'Course completed');
    update public.student_profiles
      set total_courses_completed = total_courses_completed + 1
      where profile_id = v_student_id;
    update public.courses set completion_count = completion_count + 1 where id = v_course_id;
  end if;

  return v_progress;
end;
$$;

-- Revoke the default "everyone can execute" from every privileged function; only the
-- server (service_role) may call them. The application calls them through the
-- RewardEngine / server routes after authenticating and authorising the caller.
revoke execute on function public.award_w3tr(uuid, public.w3tr_transaction_type, numeric, text, uuid, text, uuid) from public, anon, authenticated;
revoke execute on function public.spend_w3tr(uuid, numeric, text, uuid, text) from public, anon, authenticated;
revoke execute on function public.complete_lesson(uuid, uuid) from public, anon, authenticated;
revoke execute on function public.record_daily_login(uuid) from public, anon, authenticated;
revoke execute on function public.increment_campaign_raised(uuid, numeric) from public, anon, authenticated;
grant execute on function public.award_w3tr(uuid, public.w3tr_transaction_type, numeric, text, uuid, text, uuid) to service_role;
grant execute on function public.spend_w3tr(uuid, numeric, text, uuid, text) to service_role;
grant execute on function public.complete_lesson(uuid, uuid) to service_role;
grant execute on function public.record_daily_login(uuid) to service_role;
grant execute on function public.increment_campaign_raised(uuid, numeric) to service_role;

-- Trigger functions are never meant to be called directly. (Postgres only checks EXECUTE
-- when a trigger is CREATED, not when it fires, so this does not affect the triggers.)
revoke execute on function public.handle_new_auth_user() from public, anon, authenticated;
revoke execute on function public.set_updated_at() from public, anon, authenticated;
revoke execute on function public.recompute_course_rating() from public, anon, authenticated;
revoke execute on function public.on_enrollment_change() from public, anon, authenticated;
revoke execute on function public.handle_discussion_reaction_change() from public, anon, authenticated;
revoke execute on function public.enforce_cohort_location_matches_course() from public, anon, authenticated;
revoke execute on function public.protect_profile_columns() from public, anon, authenticated;
revoke execute on function public.protect_instructor_profile_columns() from public, anon, authenticated;
revoke execute on function public.protect_student_profile_columns() from public, anon, authenticated;
revoke execute on function public.protect_course_publish() from public, anon, authenticated;
revoke execute on function public.protect_submission_grading() from public, anon, authenticated;
revoke execute on function public.is_assignment_grader(uuid) from public, anon;

-- SECURE BY DEFAULT: functions created from now on are NOT callable from the browser
-- unless a migration explicitly GRANTs EXECUTE. (If you add a helper that an RLS policy
-- calls, grant it to anon/authenticated explicitly, exactly like is_admin() already is.)
-- (Two statements are needed: PUBLIC's built-in default EXECUTE is a *global* default, while the
--  grants to anon/authenticated that Supabase adds are *schema-level* defaults.)
alter default privileges for role postgres revoke execute on functions from public;
alter default privileges for role postgres in schema public revoke execute on functions from anon, authenticated;


-- =====================================================================================
-- 4. ACADEMIC & LEDGER RECORDS: WRITTEN BY THE SERVER ONLY
-- =====================================================================================
-- Students keep READ access to their own rows (the existing select policies are kept).
-- All writes now come from server code (service role) after it has validated the request.
drop policy if exists "enrollments_insert_own" on public.enrollments;
drop policy if exists "enrollments_update_own_or_admin" on public.enrollments;
drop policy if exists "lesson_progress_manage_own" on public.lesson_progress;
drop policy if exists "quiz_attempts_manage_own" on public.quiz_attempts;

revoke insert, update, delete on public.enrollments from anon, authenticated;
revoke insert, update, delete on public.lesson_progress from anon, authenticated;
revoke insert, update, delete on public.quiz_attempts from anon, authenticated;
revoke insert, update, delete on public.w3tr_wallets from anon, authenticated;
revoke insert, update, delete on public.w3tr_transactions from anon, authenticated;

-- Donations: guests may still donate, but only as an unconfirmed ('pending') record that is
-- not attributed to someone else. Confirmation happens via the Paystack webhook / admin.
-- (Previously `with check (true)` let anyone insert an already-'confirmed' donation, which
-- would inflate the admin dashboard totals.)
drop policy if exists "donations_insert_any" on public.donations;
drop policy if exists "donations_insert_pending_only" on public.donations;
create policy "donations_insert_pending_only" on public.donations for insert
  with check (
    status = 'pending'
    and confirmed_at is null
    and provider_reference is null
    and receipt_url is null
    and amount > 0
    and (donor_id is null or donor_id = auth.uid())
  );


-- =====================================================================================
-- 5. READ EXPOSURE
-- =====================================================================================
-- ---- 5a. profiles: anonymous visitors only need a public name + avatar ---------------------
-- (Course catalogue, course page instructor card, reviews.) E-mail, phone, role, ban flags,
-- location etc. are no longer readable without logging in.
revoke all on table public.profiles from anon;
grant select (id, full_name, username, avatar_url) on table public.profiles to anon;

-- ---- 5b. instructor verification documents / admin notes are never client-readable ------------
revoke select on table public.instructor_profiles from anon, authenticated;
grant select (profile_id, headline, expertise_tags, years_experience, linkedin_url, website_url,
              verification_status, total_students, average_rating, created_at, updated_at)
  on table public.instructor_profiles to anon, authenticated;

-- ---- 5c. certificates: the `or true` made every certificate readable by everyone ----------------
-- (Public verification pages already use the server-side admin client, by design.)
drop policy if exists "certificates_select" on public.certificates;
create policy "certificates_select" on public.certificates for select
  using (
    student_id = auth.uid()
    or public.is_admin()
    or exists (select 1 from public.courses c where c.id = course_id and c.instructor_id = auth.uid())
  );

-- ---- 5d. leaderboard: signed-in students only ----------------------------------------------------
revoke all on table public.leaderboard from anon;

-- ---- 5e. admin configuration is staff-only (your /admin area admits moderators, so they keep read access) --
drop policy if exists "system_settings_select_all" on public.system_settings;
drop policy if exists "feature_flags_select_all" on public.feature_flags;
drop policy if exists "reward_rules_select_all" on public.reward_rules;
drop policy if exists "system_settings_select_admin" on public.system_settings;
create policy "system_settings_select_admin" on public.system_settings for select using (public.is_moderator_or_above());
drop policy if exists "feature_flags_select_admin" on public.feature_flags;
create policy "feature_flags_select_admin" on public.feature_flags for select using (public.is_admin());
drop policy if exists "reward_rules_select_admin" on public.reward_rules;
create policy "reward_rules_select_admin" on public.reward_rules for select using (public.is_moderator_or_above());
revoke all on table public.system_settings from anon;
revoke all on table public.feature_flags from anon;
revoke all on table public.reward_rules from anon;


-- =====================================================================================
-- 6. STORAGE
-- =====================================================================================
-- (a) UPDATE (which is what "move/rename" is) must validate the NEW row too, otherwise a
--     user can move their file into someone else's folder. Every upload path in the app
--     is `<user-id>/<file>`, so non-admins are pinned to their own folder.
--     Admins keep the ability to upsert `official-covers/<course>.svg` (course approval).
-- (b) Public buckets serve files by URL without any policy, so the broad "public read"
--     SELECT policies only served to let anonymous clients LIST every object. Reads are
--     now limited to the owner/admin; public URLs keep working.
drop policy if exists "avatars_own_update" on storage.objects;
create policy "avatars_own_update" on storage.objects for update
  using (bucket_id = 'avatars' and owner = auth.uid())
  with check (bucket_id = 'avatars' and owner = auth.uid() and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "course_videos_instructor_update" on storage.objects;
create policy "course_videos_instructor_update" on storage.objects for update
  using (bucket_id = 'course-videos' and owner = auth.uid())
  with check (
    bucket_id = 'course-videos' and owner = auth.uid()
    and exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('instructor', 'admin', 'super_admin'))
    and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin())
  );

drop policy if exists "course_documents_instructor_update" on storage.objects;
create policy "course_documents_instructor_update" on storage.objects for update
  using (bucket_id = 'course-documents' and owner = auth.uid())
  with check (
    bucket_id = 'course-documents' and owner = auth.uid()
    and exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('instructor', 'admin', 'super_admin'))
    and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin())
  );

drop policy if exists "course_images_instructor_update" on storage.objects;
create policy "course_images_instructor_update" on storage.objects for update
  using (bucket_id = 'course-images' and owner = auth.uid())
  with check (
    bucket_id = 'course-images' and owner = auth.uid()
    and exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('instructor', 'admin', 'super_admin'))
    and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin())
  );

drop policy if exists "course_videos_public_read" on storage.objects;
drop policy if exists "course_documents_public_read" on storage.objects;
drop policy if exists "course_images_public_read" on storage.objects;
drop policy if exists "avatars_public_read" on storage.objects;
drop policy if exists "certificates_public_read" on storage.objects;

drop policy if exists "course_videos_owner_read" on storage.objects;
create policy "course_videos_owner_read" on storage.objects for select
  using (bucket_id = 'course-videos' and (owner = auth.uid() or public.is_admin()));
drop policy if exists "course_documents_owner_read" on storage.objects;
create policy "course_documents_owner_read" on storage.objects for select
  using (bucket_id = 'course-documents' and (owner = auth.uid() or public.is_admin()));
drop policy if exists "course_images_owner_read" on storage.objects;
create policy "course_images_owner_read" on storage.objects for select
  using (bucket_id = 'course-images' and (owner = auth.uid() or public.is_admin()));
drop policy if exists "avatars_owner_read" on storage.objects;
create policy "avatars_owner_read" on storage.objects for select
  using (bucket_id = 'avatars' and (owner = auth.uid() or public.is_admin()));
