-- ============================================
-- ULTRA SIMPLE STORAGE FIX FOR PROFILE PICTURES
-- Run this in Supabase SQL Editor
-- ============================================

-- Step 1: Drop ALL existing policies on storage.objects
DROP POLICY IF EXISTS "Users can upload own profile pictures" ON storage.objects;
DROP POLICY IF EXISTS "Users can update own profile pictures" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete own profile pictures" ON storage.objects;
DROP POLICY IF EXISTS "Profile pictures are publicly accessible" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can view profile pictures" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload profile pictures" ON storage.objects;
DROP POLICY IF EXISTS "Public Access" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload" ON storage.objects;
DROP POLICY IF EXISTS "Give users access to own folder" ON storage.objects;

-- Step 2: Make sure the bucket exists and is public
INSERT INTO storage.buckets (id, name, public)
VALUES ('profile-pictures', 'profile-pictures', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- Step 3: Enable RLS on storage.objects (should already be enabled)
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- Step 4: Create SUPER PERMISSIVE policies (we'll restrict later if needed)

-- Allow ALL authenticated users to insert ANY file in profile-pictures bucket
CREATE POLICY "Allow authenticated uploads to profile-pictures"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'profile-pictures');

-- Allow ALL authenticated users to update ANY file in profile-pictures bucket
CREATE POLICY "Allow authenticated updates to profile-pictures"
ON storage.objects
FOR UPDATE
TO authenticated
USING (bucket_id = 'profile-pictures');

-- Allow ALL authenticated users to delete ANY file in profile-pictures bucket
CREATE POLICY "Allow authenticated deletes in profile-pictures"
ON storage.objects
FOR DELETE
TO authenticated
USING (bucket_id = 'profile-pictures');

-- Allow EVERYONE (public) to read/view profile pictures
CREATE POLICY "Public read access to profile-pictures"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'profile-pictures');

-- Step 5: Verify the policies were created
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual 
FROM pg_policies 
WHERE tablename = 'objects' AND policyname LIKE '%profile-pictures%';
