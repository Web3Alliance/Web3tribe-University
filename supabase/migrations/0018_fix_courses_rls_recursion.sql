-- =====================================================================================
-- 0018: FIX INFINITE RECURSION IN COURSES RLS POLICY
-- =====================================================================================
-- Migration 0017 added a clause to the courses SELECT policy checking
-- "is this user enrolled in this course?" via a raw subquery against
-- public.enrollments. That created a genuine circular reference: the
-- enrollments SELECT policy (0001_schema.sql) already checks BACK into
-- courses ("is this user the instructor of the course this enrollment
-- belongs to?"). Postgres correctly detected the cycle and refused the
-- query entirely with error 42P17 ("infinite recursion detected in policy
-- for relation courses") — which broke the ENTIRE courses table for any
-- query complex enough to trigger it (the app's actual join-heavy browse
-- query did; simpler ad-hoc SQL test queries often didn't, which is why
-- this was so hard to pin down).
--
-- The fix follows the exact pattern already used elsewhere in this schema
-- (see is_moderator_or_above(), is_admin()) — a SECURITY DEFINER function
-- breaks the cycle because it evaluates its internal query with the
-- function owner's privileges, bypassing enrollments' own RLS instead of
-- re-triggering it.
-- =====================================================================================

create or replace function public.is_enrolled_in_course(p_course_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.enrollments e
    where e.course_id = p_course_id and e.student_id = auth.uid() and e.status != 'dropped'
  );
$$;

drop policy if exists "courses_select_published_or_own" on public.courses;
create policy "courses_select_published_or_own" on public.courses for select
  using (
    status = 'published'
    or instructor_id = auth.uid()
    or public.is_moderator_or_above()
    or public.is_enrolled_in_course(id)
  );

drop policy if exists "sections_select" on public.course_sections;
create policy "sections_select" on public.course_sections for select
  using (exists (
    select 1 from public.courses c where c.id = course_id
    and (
      c.status = 'published'
      or c.instructor_id = auth.uid()
      or public.is_moderator_or_above()
      or public.is_enrolled_in_course(c.id)
    )
  ));
