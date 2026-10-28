-- =====================================================================================
-- 0023: EDITS TO A LIVE COURSE ALWAYS GO BACK TO ADMIN REVIEW  (enforced by the database)
-- =====================================================================================
-- Requirement: "when instructors edit, changes should be submitted for admin review".
--
-- The application already does this for edits made through its own screens
-- (lib/actions/course-review-flag.ts, called from the course and quiz actions). But that is
-- a convention in application code, and an instructor can change a published course
-- without using those screens: PATCH /api/courses/[id] never called it, and the database
-- API accepts direct edits. Result: a course could be approved and then have its price or
-- content changed with no review.
--
-- This migration moves the rule into the database so NO path can skip it:
--
--   * If the course's own instructor changes the CONTENT of a course that is currently
--     'published', the course is moved to 'pending_review' in the same transaction, the
--     previous review decision is cleared, and the instructor and every admin are notified
--     (same wording as the in-app flow).
--   * "Content" = the course row itself (title, price, description, thumbnail, …) AND its
--     curriculum: sections, lessons, lesson/course resources, quizzes, quiz questions and
--     assignments.
--   * Not affected: moderators/admins (they ARE the review), the server (service role / SQL
--     editor), counters that change as students learn (enrolment count, ratings, completions),
--     draft or already-pending courses, and "saves" that change nothing.
--   * Students who are already enrolled keep access (migration 0017), exactly as before.
--
-- The application's own helper keeps working and cannot double-notify: if the database has
-- already moved the course to review, the helper sees 'pending_review' and does nothing.
-- This migration needs NO application deploy and can be run on its own.
-- Idempotent (safe to run twice).
-- =====================================================================================


-- ---- who is calling? (read straight from the request's token claims) ------------------------------------
-- 'authenticated' = a signed-in user working through the browser/API. The server (service role),
-- the Supabase SQL editor and database-internal code are NOT 'authenticated' and are never held
-- to this rule. Reads the claims directly instead of depending on auth.role().
create or replace function public.request_role()
returns text
language sql
stable
set search_path = public
as $$
  select coalesce(nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role', '');
$$;

-- ---- notifications (same text the application sends) ---------------------------------------------
create or replace function public.notify_course_flagged(p_course_id uuid, p_title text, p_instructor_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.notifications (profile_id, title, body, link_url)
  values (
    p_instructor_id,
    'Course resubmitted for review',
    format('Your edit to "%s" has taken it back off the catalog until an admin reviews the change. Students already enrolled keep their access.', p_title),
    '/instructor/courses/' || p_course_id || '/edit'
  );

  insert into public.notifications (profile_id, title, body, link_url)
  select p.id,
         'Course needs re-review',
         format('"%s" was edited by its instructor and has been pulled back from the catalog pending your review.', p_title),
         '/admin/courses'
  from public.profiles p
  where p.role in ('admin', 'super_admin');
end;
$$;

-- ---- move a published course back to review (used by the curriculum triggers) ------------------------
create or replace function public.flag_published_course_for_review(p_course_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_title text;
  v_instructor uuid;
begin
  update public.courses
     set status = 'pending_review',
         reviewed_at = null,
         reviewed_by = null,
         review_notes = null
   where id = p_course_id
     and status = 'published'
  returning title, instructor_id into v_title, v_instructor;

  if found then
    perform public.notify_course_flagged(p_course_id, v_title, v_instructor);
  end if;
end;
$$;

-- ---- 1. the course row itself ---------------------------------------------------------------------------
-- Only the columns below are "system" columns (set by the platform, not authored by the
-- instructor). Anything else — including any column added in the future — counts as content,
-- so the safe default is "this edit needs review".
create or replace function public.review_on_course_edit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_system text[] := array[
    'id', 'instructor_id', 'organization_id', 'status', 'version',
    'average_rating', 'rating_count', 'enrollment_count', 'completion_count',
    'published_at', 'submitted_for_review_at', 'reviewed_at', 'reviewed_by', 'review_notes',
    'is_featured', 'created_at', 'updated_at'
  ];
begin
  -- Only an end user (browser session) is subject to this. The server, the SQL editor and
  -- counter-updating database functions run without an 'authenticated' JWT role.
  if public.request_role() <> 'authenticated' or public.is_moderator_or_above() then
    return new;
  end if;

  -- "Featuring" a course on the site is a staff decision, never the instructor's.
  if new.is_featured is distinct from old.is_featured then
    raise exception 'Only staff can feature a course.' using errcode = '42501';
  end if;

  -- Review is only triggered by the course's owner editing a course that is live right now.
  if old.status is distinct from 'published' or new.status is distinct from 'published'
     or auth.uid() is distinct from old.instructor_id then
    return new;
  end if;

  -- A save that changes no content (or only counters) is not an edit.
  if (to_jsonb(new) - v_system) is not distinct from (to_jsonb(old) - v_system) then
    return new;
  end if;

  new.status := 'pending_review';
  new.reviewed_at := null;
  new.reviewed_by := null;
  new.review_notes := null;
  perform public.notify_course_flagged(new.id, new.title, new.instructor_id);
  return new;
end;
$$;

drop trigger if exists trg_courses_review_on_edit on public.courses;
create trigger trg_courses_review_on_edit
  before update on public.courses
  for each row execute function public.review_on_course_edit();

-- ---- 2. the curriculum (sections, lessons, resources, quizzes, questions, assignments) ----------------------
create or replace function public.review_on_course_content_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v jsonb;
  v_course uuid;
begin
  if public.request_role() <> 'authenticated' or public.is_moderator_or_above() then
    return null;
  end if;

  if tg_op = 'DELETE' then
    v := to_jsonb(old);
  else
    v := to_jsonb(new);
  end if;

  v_course := case tg_table_name
    when 'lesson_resources' then (select l.course_id from public.lessons l where l.id = (v ->> 'lesson_id')::uuid)
    when 'quiz_questions'   then (select q.course_id from public.quizzes q where q.id = (v ->> 'quiz_id')::uuid)
    else (v ->> 'course_id')::uuid
  end;

  if v_course is null then
    return null;
  end if;

  -- only when the course's own instructor made the change
  if exists (select 1 from public.courses c where c.id = v_course and c.instructor_id = auth.uid()) then
    perform public.flag_published_course_for_review(v_course);
  end if;
  return null;
end;
$$;

drop trigger if exists trg_review_on_edit on public.course_sections;
create trigger trg_review_on_edit after insert or update or delete on public.course_sections
  for each row execute function public.review_on_course_content_change();

drop trigger if exists trg_review_on_edit on public.lessons;
create trigger trg_review_on_edit after insert or update or delete on public.lessons
  for each row execute function public.review_on_course_content_change();

drop trigger if exists trg_review_on_edit on public.lesson_resources;
create trigger trg_review_on_edit after insert or update or delete on public.lesson_resources
  for each row execute function public.review_on_course_content_change();

drop trigger if exists trg_review_on_edit on public.course_resources;
create trigger trg_review_on_edit after insert or update or delete on public.course_resources
  for each row execute function public.review_on_course_content_change();

drop trigger if exists trg_review_on_edit on public.quizzes;
create trigger trg_review_on_edit after insert or update or delete on public.quizzes
  for each row execute function public.review_on_course_content_change();

drop trigger if exists trg_review_on_edit on public.quiz_questions;
create trigger trg_review_on_edit after insert or update or delete on public.quiz_questions
  for each row execute function public.review_on_course_content_change();

drop trigger if exists trg_review_on_edit on public.assignments;
create trigger trg_review_on_edit after insert or update or delete on public.assignments
  for each row execute function public.review_on_course_content_change();

-- ---- none of these helpers is callable from the browser -------------------------------------------------------
revoke execute on function public.request_role() from public, anon, authenticated;
revoke execute on function public.notify_course_flagged(uuid, text, uuid) from public, anon, authenticated;
revoke execute on function public.flag_published_course_for_review(uuid) from public, anon, authenticated;
revoke execute on function public.review_on_course_edit() from public, anon, authenticated;
revoke execute on function public.review_on_course_content_change() from public, anon, authenticated;
