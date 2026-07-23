-- =====================================================================================
-- 0017: DON'T LOCK OUT ENROLLED STUDENTS WHEN A COURSE GOES BACK FOR RE-REVIEW
-- =====================================================================================
-- Instructor edits to an already-published course now flip it back to
-- 'pending_review' (see lib/actions/course-review-flag.ts), so every live
-- version of a course has actually been reviewed, not just the first one.
--
-- Both of these SELECT policies previously only allowed a non-owner,
-- non-moderator viewer to see a course/its sections when status = 'published'
-- — with no exception for a student already enrolled. That would have meant
-- a student partway through a course loses access to the course overview
-- page and its section list the moment their instructor fixes a typo and
-- the course drops out of 'published' pending re-approval. lessons_select
-- and course_resources_select already correctly carry this enrollment
-- exception; these two did not.
-- =====================================================================================

drop policy if exists "courses_select_published_or_own" on public.courses;
create policy "courses_select_published_or_own" on public.courses for select
  using (
    status = 'published'
    or instructor_id = auth.uid()
    or public.is_moderator_or_above()
    or exists (
      select 1 from public.enrollments e
      where e.course_id = courses.id and e.student_id = auth.uid() and e.status != 'dropped'
    )
  );

drop policy if exists "sections_select" on public.course_sections;
create policy "sections_select" on public.course_sections for select
  using (exists (
    select 1 from public.courses c where c.id = course_id
    and (
      c.status = 'published'
      or c.instructor_id = auth.uid()
      or public.is_moderator_or_above()
      or exists (
        select 1 from public.enrollments e
        where e.course_id = c.id and e.student_id = auth.uid() and e.status != 'dropped'
      )
    )
  ));
