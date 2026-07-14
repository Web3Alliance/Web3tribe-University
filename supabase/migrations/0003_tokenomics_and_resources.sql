-- =====================================================================================
-- WEB3TRIBE UNIVERSITY — MIGRATION 0003
-- Fixed platform-wide tokenomics, unlimited quiz retakes, and course resources
-- =====================================================================================
-- Run this AFTER 0001_schema.sql, 0002_storage.sql, and (optionally) seed.sql.
-- Safe to re-run.
--
-- WHAT THIS CHANGES:
--   1. Locks lesson and quiz W3TR rewards to fixed, platform-wide amounts instead of
--      being instructor-editable per lesson/quiz. The application UI no longer
--      exposes a reward-amount field to instructors; these defaults are the single
--      source of truth (mirrored in lib/tokenomics.ts on the application side).
--   2. Raises quiz max_attempts to effectively unlimited (999) so students can always
--      retake a failed quiz.
--   3. Adds a course_resources table for instructor-uploaded reference material
--      (textbooks, PDFs, slide decks) that isn't tied to any single lesson.
--   4. Updates the complete_lesson() function's course-completion bonus to match the
--      new fixed tokenomics (20 W3TR instead of 50).
-- =====================================================================================

-- ---- 1. Fixed reward defaults -------------------------------------------------------
alter table public.lessons alter column w3tr_reward set default 1;
alter table public.quizzes alter column w3tr_reward set default 2;

-- Normalize any existing rows created before this migration to the new fixed amounts.
-- Lesson-linked quizzes (is_final_exam = false) get the "quiz pass" reward; the
-- course-wide final exam gets the larger "exam pass" reward.
update public.lessons set w3tr_reward = 1;
update public.quizzes set w3tr_reward = case when is_final_exam then 10 else 2 end;

-- ---- 2. Unlimited quiz retakes ------------------------------------------------------
alter table public.quizzes alter column max_attempts set default 999;
update public.quizzes set max_attempts = 999;

-- ---- 3. Course resources -------------------------------------------------------------
create table if not exists public.course_resources (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses(id) on delete cascade,
  title text not null,
  description text,
  file_url text not null,
  file_type text,
  file_size_bytes bigint,
  uploaded_by uuid references public.profiles(id) on delete set null,
  display_order int not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists idx_course_resources_course on public.course_resources(course_id, display_order);

alter table public.course_resources enable row level security;

drop policy if exists "course_resources_select" on public.course_resources;
create policy "course_resources_select" on public.course_resources for select
  using (
    exists (
      select 1 from public.courses c where c.id = course_id
      and (c.status = 'published' or c.instructor_id = auth.uid() or public.is_moderator_or_above())
    )
    or exists (select 1 from public.enrollments e where e.course_id = course_resources.course_id and e.student_id = auth.uid())
  );

drop policy if exists "course_resources_manage" on public.course_resources;
create policy "course_resources_manage" on public.course_resources for all
  using (exists (select 1 from public.courses c where c.id = course_id and (c.instructor_id = auth.uid() or public.is_admin())))
  with check (exists (select 1 from public.courses c where c.id = course_id and (c.instructor_id = auth.uid() or public.is_admin())));

-- ---- 4. Update complete_lesson() course-completion bonus to match fixed tokenomics --
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

-- ---- 5. Extend course-videos bucket to accept audio, course-documents to accept zip -
update storage.buckets
  set allowed_mime_types = array['video/mp4','video/webm','video/quicktime','audio/mpeg','audio/mp3','audio/wav','audio/ogg']
  where id = 'course-videos';

update storage.buckets
  set allowed_mime_types = array['application/pdf','application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document','text/plain','application/zip','application/x-zip-compressed']
  where id = 'course-documents';

-- ---- 6. Keep reward_rules reference table consistent with the fixed amounts above ---
update public.reward_rules set amount = 1 where rule_key = 'lesson_complete';
update public.reward_rules set amount = 2 where rule_key = 'quiz_pass';
insert into public.reward_rules (rule_key, label, amount, is_active)
  values ('exam_pass', 'Final exam passed', 10, true)
  on conflict (rule_key) do update set amount = 10;
update public.reward_rules set amount = 20 where rule_key = 'course_complete';
