-- =====================================================================================
-- 0024  Fixes for BugBunny report cc6b1c2 (12 Nov 2026)
--
--   #1 (High)   Students could author courses/lessons/quizzes, set their own W3TR reward values,
--               enrol in a draft course and farm rewards (the same quiz could pay out on every pass).
--   #3 (Medium) Paid-course PDFs were readable by anyone: course_resources was visible to
--               anonymous callers and the course-documents bucket was public.
--   #4 (Medium) Certificates could be issued for unverified instructors, draft/rejected courses
--               and exams that were not a real assessment.
--   (#2 profile privacy is a separate, larger change - see docs/SECURITY_REMEDIATION_2026-11.md)
--
-- Deploy the application code FIRST, then run this file. Safe to run more than once.
-- =====================================================================================

-- ---- 1. Who may author course content ------------------------------------------------
create or replace function public.can_author_courses()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.current_role_is(array['instructor','admin','super_admin']::user_role[]);
$$;
grant execute on function public.can_author_courses() to anon, authenticated, service_role;

drop policy if exists "courses_instructor_insert" on public.courses;
create policy "courses_instructor_insert" on public.courses for insert
  with check (
    (instructor_id = auth.uid() and public.can_author_courses())
    or public.is_admin()
  );

drop policy if exists "courses_instructor_update_own_draft" on public.courses;
create policy "courses_instructor_update_own_draft" on public.courses for update
  using ((instructor_id = auth.uid() and public.can_author_courses()) or public.is_moderator_or_above())
  with check ((instructor_id = auth.uid() and public.can_author_courses()) or public.is_moderator_or_above());

-- every "manage" policy below: the course's own instructor (who must still BE an instructor/admin)
-- or an admin. A student can never write course content, even on a row they somehow own.
drop policy if exists "sections_manage" on public.course_sections;
create policy "sections_manage" on public.course_sections for all
  using (exists (select 1 from public.courses c where c.id = course_id
         and ((c.instructor_id = auth.uid() and public.can_author_courses()) or public.is_admin())))
  with check (exists (select 1 from public.courses c where c.id = course_id
         and ((c.instructor_id = auth.uid() and public.can_author_courses()) or public.is_admin())));

drop policy if exists "lessons_manage" on public.lessons;
create policy "lessons_manage" on public.lessons for all
  using (exists (select 1 from public.courses c where c.id = course_id
         and ((c.instructor_id = auth.uid() and public.can_author_courses()) or public.is_admin())))
  with check (exists (select 1 from public.courses c where c.id = course_id
         and ((c.instructor_id = auth.uid() and public.can_author_courses()) or public.is_admin())));

drop policy if exists "lesson_resources_manage" on public.lesson_resources;
create policy "lesson_resources_manage" on public.lesson_resources for all
  using (exists (select 1 from public.lessons l join public.courses c on c.id = l.course_id
         where l.id = lesson_id and ((c.instructor_id = auth.uid() and public.can_author_courses()) or public.is_admin())))
  with check (exists (select 1 from public.lessons l join public.courses c on c.id = l.course_id
         where l.id = lesson_id and ((c.instructor_id = auth.uid() and public.can_author_courses()) or public.is_admin())));

drop policy if exists "quizzes_manage" on public.quizzes;
create policy "quizzes_manage" on public.quizzes for all
  using (exists (select 1 from public.courses c where c.id = course_id
         and ((c.instructor_id = auth.uid() and public.can_author_courses()) or public.is_admin())))
  with check (exists (select 1 from public.courses c where c.id = course_id
         and ((c.instructor_id = auth.uid() and public.can_author_courses()) or public.is_admin())));

drop policy if exists "quiz_questions_manage" on public.quiz_questions;
create policy "quiz_questions_manage" on public.quiz_questions for all
  using (exists (select 1 from public.quizzes q join public.courses c on c.id = q.course_id
         where q.id = quiz_id and ((c.instructor_id = auth.uid() and public.can_author_courses()) or public.is_admin())))
  with check (exists (select 1 from public.quizzes q join public.courses c on c.id = q.course_id
         where q.id = quiz_id and ((c.instructor_id = auth.uid() and public.can_author_courses()) or public.is_admin())));

drop policy if exists "assignments_manage" on public.assignments;
create policy "assignments_manage" on public.assignments for all
  using (exists (select 1 from public.courses c where c.id = course_id
         and ((c.instructor_id = auth.uid() and public.can_author_courses()) or public.is_admin())))
  with check (exists (select 1 from public.courses c where c.id = course_id
         and ((c.instructor_id = auth.uid() and public.can_author_courses()) or public.is_admin())));

drop policy if exists "course_resources_manage" on public.course_resources;
create policy "course_resources_manage" on public.course_resources for all
  using (exists (select 1 from public.courses c where c.id = course_id
         and ((c.instructor_id = auth.uid() and public.can_author_courses()) or public.is_admin())))
  with check (exists (select 1 from public.courses c where c.id = course_id
         and ((c.instructor_id = auth.uid() and public.can_author_courses()) or public.is_admin())));

-- ---- 2. Reward amounts are set by the platform, not by whoever authors the content -----
-- (lesson = 1, quiz = 2, final exam = 10 - same values as lib/tokenomics.ts). Only admins can
-- change them; for everybody else INSERT is forced to the platform value and UPDATE keeps the old one.
create or replace function public.protect_reward_amount()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  -- (deliberately NOT security definer: current_user must stay the caller's role)
  if current_user in ('anon', 'authenticated') and not public.is_admin() then
    if tg_op = 'UPDATE' then
      new.w3tr_reward := old.w3tr_reward;
    elsif tg_table_name = 'lessons' then
      new.w3tr_reward := 1;
    else
      -- quizzes (kept in its own branch: lessons rows have no is_final_exam column)
      new.w3tr_reward := case when (to_jsonb(new) ->> 'is_final_exam')::boolean then 10 else 2 end;
    end if;
  end if;
  return new;
end;
$$;
revoke execute on function public.protect_reward_amount() from public, anon, authenticated;

drop trigger if exists trg_protect_lesson_reward on public.lessons;
create trigger trg_protect_lesson_reward before insert or update on public.lessons
  for each row execute function public.protect_reward_amount();
drop trigger if exists trg_protect_quiz_reward on public.quizzes;
create trigger trg_protect_quiz_reward before insert or update on public.quizzes
  for each row execute function public.protect_reward_amount();

-- ---- 3. Learning rewards are paid once, and never on your own / unpublished course ---------
-- award_w3tr is the single place every credit goes through, so the rule lives here.
-- A blocked or repeated award returns the earlier transaction (or NULL) and credits nothing.
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
  v_course_id uuid;
  v_instructor uuid;
  v_status course_status;
begin
  if p_amount = 0 then
    raise exception 'award_w3tr: amount must be non-zero';
  end if;

  if p_type in ('lesson_complete', 'quiz_pass', 'exam_pass', 'course_complete') and p_reference_id is not null then
    -- serialise concurrent attempts for the same learner + item, then check the ledger
    perform pg_advisory_xact_lock(hashtextextended(p_profile_id::text || ':' || p_type::text || ':' || p_reference_id::text, 0));

    select * into v_tx from public.w3tr_transactions
      where profile_id = p_profile_id and type = p_type and reference_id = p_reference_id
      limit 1;
    if found then
      return v_tx;                                   -- already rewarded once: credit nothing
    end if;

    v_course_id := case p_reference_table
      when 'lessons' then (select course_id from public.lessons where id = p_reference_id)
      when 'quizzes' then (select course_id from public.quizzes where id = p_reference_id)
      when 'courses' then p_reference_id
      else null end;

    if v_course_id is not null then
      select instructor_id, status into v_instructor, v_status from public.courses where id = v_course_id;
      if v_instructor = p_profile_id or v_status in ('draft', 'rejected') then
        return null;                                 -- no rewards on your own course or an unpublished one
      end if;
    end if;
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
revoke execute on function public.award_w3tr(uuid, public.w3tr_transaction_type, numeric, text, uuid, text, uuid) from public, anon, authenticated;
grant execute on function public.award_w3tr(uuid, public.w3tr_transaction_type, numeric, text, uuid, text, uuid) to service_role;

-- Belt and braces: the database itself refuses a second reward for the same item. If the
-- farming already put duplicate rows in your ledger this cannot be built; it then only warns
-- (the function above still protects you) - run supabase/security/verify-0024-applied.sql to list them.
do $$
begin
  create unique index if not exists uq_w3tr_reward_once
    on public.w3tr_transactions (profile_id, type, reference_id)
    where type in ('lesson_complete', 'quiz_pass', 'exam_pass', 'course_complete') and reference_id is not null;
exception when unique_violation then
  raise notice 'uq_w3tr_reward_once NOT created: duplicate reward rows already exist. Reconcile them, then re-run this file.';
end $$;

-- ---- 4. Certificate eligibility - one place, enforced on the server --------------------
create or replace function public.certificate_block_reason(p_student uuid, p_course uuid, p_min_questions int default 10)
returns text
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_course public.courses;
  v_verified boolean;
  v_exam uuid;
  v_questions int;
begin
  select * into v_course from public.courses where id = p_course;
  if not found then return 'Course not found.'; end if;
  if v_course.status in ('draft', 'rejected') then return 'This course has not been approved for publication.'; end if;
  if v_course.instructor_id = p_student then return 'You cannot be issued a certificate for your own course.'; end if;

  select (coalesce(p.is_instructor_verified, false) or coalesce(ip.verification_status = 'verified', false))
    into v_verified
    from public.profiles p
    left join public.instructor_profiles ip on ip.profile_id = p.id
    where p.id = v_course.instructor_id;
  if not coalesce(v_verified, false) then return 'This course''s instructor has not been verified yet.'; end if;

  if not exists (select 1 from public.enrollments where student_id = p_student and course_id = p_course and status = 'completed') then
    return 'Course not yet completed.';
  end if;

  select id into v_exam from public.quizzes where course_id = p_course and is_final_exam order by created_at limit 1;
  if v_exam is null then return 'This course has no final exam yet.'; end if;

  select count(*) into v_questions from public.quiz_questions where quiz_id = v_exam;
  if v_questions < p_min_questions then
    return format('The final exam needs at least %s questions before certificates can be issued.', p_min_questions);
  end if;

  if not exists (select 1 from public.quiz_attempts where quiz_id = v_exam and student_id = p_student and passed) then
    return 'Pass the course''s final exam before claiming your certificate.';
  end if;

  return null;   -- eligible
end;
$$;
revoke execute on function public.certificate_block_reason(uuid, uuid, int) from public, anon, authenticated;
grant execute on function public.certificate_block_reason(uuid, uuid, int) to service_role;

-- ---- 5. Course documents are private; only entitled people can download them ------------
-- Resource LISTINGS are visible to the course's instructor, staff and enrolled students only
-- (previously any visitor, including anonymous ones, could read every published course's rows).
drop policy if exists "course_resources_select" on public.course_resources;
create policy "course_resources_select" on public.course_resources for select
  using (
    exists (select 1 from public.courses c where c.id = course_id
            and (c.instructor_id = auth.uid() or public.is_moderator_or_above()))
    or exists (select 1 from public.enrollments e
               where e.course_id = course_resources.course_id and e.student_id = auth.uid()
               and e.status in ('active', 'completed'))
  );

-- The bucket becomes private. Files are handed out by /api/files/document as short-lived signed
-- links after an enrolment check (the server uses the service role, so it needs no policy here).
update storage.buckets set public = false where id = 'course-documents';
drop policy if exists "course_documents_public_read" on storage.objects;
drop policy if exists "course_documents_read_own" on storage.objects;
create policy "course_documents_read_own" on storage.objects for select
  using (bucket_id = 'course-documents' and (owner = auth.uid() or public.is_admin()));
