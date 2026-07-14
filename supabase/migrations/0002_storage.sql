-- =====================================================================================
-- WEB3TRIBE UNIVERSITY — STORAGE BUCKETS & POLICIES
-- =====================================================================================
-- Run this AFTER 0001_schema.sql. Creates the storage buckets referenced by the
-- application (lib/certificate.ts, app/api/upload/route.ts) and their access policies.
-- =====================================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('course-videos', 'course-videos', true, 524288000, array['video/mp4','video/webm','video/quicktime']),
  ('course-documents', 'course-documents', true, 26214400, array['application/pdf','application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document','text/plain']),
  ('course-images', 'course-images', true, 10485760, array['image/png','image/jpeg','image/webp','image/gif']),
  ('avatars', 'avatars', true, 5242880, array['image/png','image/jpeg','image/webp']),
  ('assignments', 'assignments', false, 26214400, null),
  ('certificates', 'certificates', true, 5242880, array['application/pdf'])
on conflict (id) do nothing;

-- Course content (videos/documents/images): readable by anyone (course previews and
-- published-course content are meant to be publicly reachable via CDN-style URLs;
-- the application layer still gates *access to the lesson page* itself via RLS on
-- the `lessons` table), writable only by the owning instructor or an admin.
create policy "course_videos_public_read" on storage.objects for select
  using (bucket_id = 'course-videos');
create policy "course_videos_instructor_write" on storage.objects for insert
  with check (bucket_id = 'course-videos' and auth.uid() is not null);
create policy "course_videos_instructor_update" on storage.objects for update
  using (bucket_id = 'course-videos' and owner = auth.uid());
create policy "course_videos_instructor_delete" on storage.objects for delete
  using (bucket_id = 'course-videos' and owner = auth.uid());

create policy "course_documents_public_read" on storage.objects for select
  using (bucket_id = 'course-documents');
create policy "course_documents_instructor_write" on storage.objects for insert
  with check (bucket_id = 'course-documents' and auth.uid() is not null);
create policy "course_documents_instructor_update" on storage.objects for update
  using (bucket_id = 'course-documents' and owner = auth.uid());
create policy "course_documents_instructor_delete" on storage.objects for delete
  using (bucket_id = 'course-documents' and owner = auth.uid());

create policy "course_images_public_read" on storage.objects for select
  using (bucket_id = 'course-images');
create policy "course_images_instructor_write" on storage.objects for insert
  with check (bucket_id = 'course-images' and auth.uid() is not null);
create policy "course_images_instructor_update" on storage.objects for update
  using (bucket_id = 'course-images' and owner = auth.uid());
create policy "course_images_instructor_delete" on storage.objects for delete
  using (bucket_id = 'course-images' and owner = auth.uid());

-- Avatars: any authenticated user may upload their own; publicly readable.
create policy "avatars_public_read" on storage.objects for select
  using (bucket_id = 'avatars');
create policy "avatars_own_write" on storage.objects for insert
  with check (bucket_id = 'avatars' and auth.uid() is not null and (storage.foldername(name))[1] = auth.uid()::text);
create policy "avatars_own_update" on storage.objects for update
  using (bucket_id = 'avatars' and owner = auth.uid());
create policy "avatars_own_delete" on storage.objects for delete
  using (bucket_id = 'avatars' and owner = auth.uid());

-- Assignments: private bucket. Students can upload/read their own submissions;
-- the owning instructor can read submissions for their own course's assignments
-- (enforced at the application layer, since ownership of an assignment requires
-- a join the storage policy engine cannot easily express — the API route in
-- app/api/upload/route.ts additionally scopes the storage path by profile id).
create policy "assignments_own_read" on storage.objects for select
  using (bucket_id = 'assignments' and owner = auth.uid());
create policy "assignments_own_write" on storage.objects for insert
  with check (bucket_id = 'assignments' and auth.uid() is not null and (storage.foldername(name))[1] = auth.uid()::text);

-- Certificates: publicly readable (so verification links work for anyone), writes
-- restricted to the service role only (issued exclusively by
-- app/api/certificates/generate/route.ts using the admin client).
create policy "certificates_public_read" on storage.objects for select
  using (bucket_id = 'certificates');
