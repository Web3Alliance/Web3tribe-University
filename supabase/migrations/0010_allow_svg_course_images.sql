-- =====================================================================================
-- 0010: ALLOW SVG IN course-images BUCKET (for auto-generated course covers)
-- =====================================================================================
-- The course-images bucket was originally restricted to png/jpeg/webp/gif — this adds
-- image/svg+xml so the server-generated official course cover (see
-- lib/course-cover.ts, wired into moderateCourseAction) can actually be uploaded.
-- Everything else about the bucket (public read, size limit, RLS policies) is
-- unchanged.
-- =====================================================================================

update storage.buckets
set allowed_mime_types = array['image/png','image/jpeg','image/webp','image/gif','image/svg+xml']
where id = 'course-images';

commit;