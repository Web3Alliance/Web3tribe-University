-- =====================================================================================
-- 0021: STORAGE WRITE POLICIES WERE NAMED "INSTRUCTOR_WRITE" BUT NEVER CHECKED ROLE
-- =====================================================================================
-- Found during audit: the insert policies for course-videos, course-documents,
-- and course-images all only checked `auth.uid() is not null` — meaning ANY
-- authenticated user (a student, an organization account, anyone) could
-- upload files into these buckets, not just instructors, despite the policy
-- names implying otherwise. The avatars bucket right next to these in the
-- same migration correctly scopes uploads to the user's own folder, which is
-- why this reads as an oversight rather than a deliberate choice.
--
-- Actual exploitable impact was contained (getting an uploaded file to
-- actually appear anywhere in the app still requires passing the proper
-- course-ownership check in the corresponding server action), but "any
-- logged-in user can write to a bucket named for instructors" is still a
-- real least-privilege violation worth closing directly at the storage
-- layer, not just relying on the application layer to catch it.
-- =====================================================================================

drop policy if exists "course_videos_instructor_write" on storage.objects;
create policy "course_videos_instructor_write" on storage.objects for insert
  with check (
    bucket_id = 'course-videos'
    and exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('instructor', 'admin', 'super_admin'))
  );

drop policy if exists "course_documents_instructor_write" on storage.objects;
create policy "course_documents_instructor_write" on storage.objects for insert
  with check (
    bucket_id = 'course-documents'
    and exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('instructor', 'admin', 'super_admin'))
  );

drop policy if exists "course_images_instructor_write" on storage.objects;
create policy "course_images_instructor_write" on storage.objects for insert
  with check (
    bucket_id = 'course-images'
    and exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('instructor', 'admin', 'super_admin'))
  );
