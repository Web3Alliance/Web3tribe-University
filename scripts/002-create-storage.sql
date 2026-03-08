-- Create storage buckets for profile pictures
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'profile-pictures',
  'profile-pictures',
  true,
  5242880, -- 5MB
  ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif']
) ON CONFLICT (id) DO NOTHING;

-- Create storage bucket for course materials (videos, PDFs, text files, documents)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'course-materials',
  'course-materials',
  false, -- Changed to private for download protection
  524288000, -- 500MB for videos
  ARRAY[
    'video/mp4', 
    'video/webm', 
    'video/ogg', 
    'application/pdf',
    'text/plain',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/msword'
  ]
) ON CONFLICT (id) DO NOTHING;

-- Create storage bucket for course thumbnails
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'course-thumbnails',
  'course-thumbnails',
  true,
  5242880, -- 5MB
  ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
) ON CONFLICT (id) DO NOTHING;

-- Enable RLS on storage.objects
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- Policy: Users can upload their own profile pictures
CREATE POLICY "Users can upload their own profile pictures"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'profile-pictures' AND
  (storage.foldername(name))[1] = 'avatars' AND
  auth.uid()::text = (storage.foldername(name))[2]
);

-- Policy: Users can update their own profile pictures
CREATE POLICY "Users can update their own profile pictures"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'profile-pictures' AND
  (storage.foldername(name))[1] = 'avatars' AND
  auth.uid()::text = (storage.foldername(name))[2]
);

-- Policy: Users can delete their own profile pictures
CREATE POLICY "Users can delete their own profile pictures"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'profile-pictures' AND
  (storage.foldername(name))[1] = 'avatars' AND
  auth.uid()::text = (storage.foldername(name))[2]
);

-- Policy: Profile pictures are publicly readable
CREATE POLICY "Profile pictures are publicly readable"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'profile-pictures');

-- =========================================
-- COURSE MATERIALS STORAGE POLICIES
-- =========================================

-- Policy: Tutors can upload course materials
CREATE POLICY "Tutors can upload course materials"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'course-materials'
);

-- Policy: Tutors can update their course materials
CREATE POLICY "Tutors can update their course materials"
ON storage.objects
FOR UPDATE
TO authenticated
USING (bucket_id = 'course-materials');

-- Policy: Tutors can delete their course materials
CREATE POLICY "Tutors can delete their course materials"
ON storage.objects
FOR DELETE
TO authenticated
USING (bucket_id = 'course-materials');

-- Policy: Only authenticated enrolled users can access course materials
CREATE POLICY "Enrolled users can access course materials"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'course-materials' AND
  EXISTS (
    SELECT 1 FROM public.enrollments
    WHERE enrollments.user_id = auth.uid()
    AND (storage.foldername(name))[2]::uuid = ANY(
      SELECT course_id FROM public.enrollments WHERE user_id = auth.uid()
    )
  )
);

-- =========================================
-- COURSE THUMBNAILS STORAGE POLICIES
-- =========================================

-- Policy: Tutors can upload course thumbnails
CREATE POLICY "Tutors can upload course thumbnails"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'course-thumbnails');

-- Policy: Tutors can update course thumbnails
CREATE POLICY "Tutors can update course thumbnails"
ON storage.objects
FOR UPDATE
TO authenticated
USING (bucket_id = 'course-thumbnails');

-- Policy: Tutors can delete course thumbnails
CREATE POLICY "Tutors can delete course thumbnails"
ON storage.objects
FOR DELETE
TO authenticated
USING (bucket_id = 'course-thumbnails');

-- Policy: Course thumbnails are publicly readable
CREATE POLICY "Course thumbnails are publicly readable"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'course-thumbnails');
