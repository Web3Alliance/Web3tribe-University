-- FINAL FIX FOR PROFILE PICTURE UPLOAD RLS ISSUES
-- This script completely resets the profile-pictures bucket policies

-- Step 1: Drop ALL existing policies on storage.objects for profile-pictures
DROP POLICY IF EXISTS "Profile pictures are publicly readable" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload their own profile picture" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their own profile picture" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own profile picture" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload profile pictures" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload own profile pictures" ON storage.objects;
DROP POLICY IF EXISTS "Users can update own profile pictures" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete own profile pictures" ON storage.objects;
DROP POLICY IF EXISTS "Profile pictures are publicly accessible" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can view profile pictures" ON storage.objects;
DROP POLICY IF EXISTS "Enrolled users can access course materials" ON storage.objects;

-- Step 2: Recreate the bucket with correct settings
DELETE FROM storage.buckets WHERE id = 'profile-pictures';

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'profile-pictures',
  'profile-pictures',
  true,
  5242880, -- 5MB
  ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp']
) ON CONFLICT (id) DO UPDATE SET
  public = true,
  file_size_limit = 5242880,
  allowed_mime_types = ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];

-- Step 3: Create simple, working policies
-- Allow authenticated users to INSERT files into their own folder
CREATE POLICY "Allow users to upload profile pictures"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'profile-pictures' 
  AND auth.uid()::text = (string_to_array(name, '/'))[1]
);

-- Allow authenticated users to UPDATE their own files
CREATE POLICY "Allow users to update profile pictures"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'profile-pictures' 
  AND auth.uid()::text = (string_to_array(name, '/'))[1]
);

-- Allow authenticated users to DELETE their own files
CREATE POLICY "Allow users to delete profile pictures"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'profile-pictures' 
  AND auth.uid()::text = (string_to_array(name, '/'))[1]
);

-- Allow public SELECT (viewing) since bucket is public
CREATE POLICY "Allow public to view profile pictures"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'profile-pictures');
