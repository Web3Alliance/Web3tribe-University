-- =====================================================================================
-- 0020: HARDEN enrollments_select_own AGAINST FUTURE RLS RECURSION
-- =====================================================================================
-- Found during a full security audit: enrollments_select_own's "is this the
-- course's instructor" check was a raw, un-encapsulated subquery directly
-- into public.courses:
--
--   exists (select 1 from public.courses c where c.id = course_id and c.instructor_id = auth.uid())
--
-- This is NOT currently causing the infinite-recursion bug fixed in 0018 —
-- but only by accident. That subquery triggers courses' own RLS policy
-- (courses_select_published_or_own), which internally calls
-- is_enrolled_in_course() — and since that helper is SECURITY DEFINER, it
-- happens to break the cycle before it can recurse back into enrollments.
--
-- That's a real, live escape hatch today, but it's fragile: it depends on
-- courses' policy continuing to reference is_enrolled_in_course() in
-- exactly its current form. If anyone edits courses_select_published_or_own
-- later without realizing enrollments_select_own implicitly depends on it,
-- the exact same recursion bug from before this migration could return —
-- with no test or code comment anywhere warning them.
--
-- This gives enrollments_select_own its own explicit, independent
-- SECURITY DEFINER helper, so it no longer depends on courses' internal
-- policy structure at all.
-- =====================================================================================

create or replace function public.is_instructor_of_course(p_course_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.courses c
    where c.id = p_course_id and c.instructor_id = auth.uid()
  );
$$;

drop policy if exists "enrollments_select_own" on public.enrollments;
create policy "enrollments_select_own" on public.enrollments for select
  using (
    student_id = auth.uid()
    or public.is_admin()
    or public.is_instructor_of_course(course_id)
  );
