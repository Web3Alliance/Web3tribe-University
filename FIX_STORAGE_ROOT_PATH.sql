-- ============================================
-- FINAL FIX FOR PROFILE PICTURE UPLOAD
-- This script fixes the RLS error by using root path uploads
-- Run this in Supabase SQL Editor
-- ============================================

-- Step 1: Disable RLS temporarily to clean up
ALTER TABLE storage.objects DISABLE ROW LEVEL SECURITY;

-- Step 2: Drop ALL existing policies for profile-pictures bucket
DO $$ 
DECLARE
    pol RECORD;
BEGIN
    FOR pol IN 
        SELECT policyname 
        FROM pg_policies 
        WHERE schemaname = 'storage' 
        AND tablename = 'objects'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON storage.objects', pol.policyname);
    END LOOP;
END $$;

-- Step 3: Re-enable RLS
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- Step 4: Create ultra-simple policies that work with root path uploads
-- Policy 1: Allow authenticated users to INSERT (upload) to profile-pictures bucket
CREATE POLICY "Allow authenticated uploads to profile-pictures"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'profile-pictures');

-- Policy 2: Allow authenticated users to UPDATE their files
CREATE POLICY "Allow authenticated updates to profile-pictures"
ON storage.objects
FOR UPDATE
TO authenticated
USING (bucket_id = 'profile-pictures');

-- Policy 3: Allow authenticated users to DELETE their files
CREATE POLICY "Allow authenticated deletes from profile-pictures"
ON storage.objects
FOR DELETE
TO authenticated
USING (bucket_id = 'profile-pictures');

-- Policy 4: Allow public SELECT (view) access to all profile pictures
CREATE POLICY "Allow public access to profile-pictures"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'profile-pictures');

-- Step 5: Ensure bucket exists and is publicly accessible
INSERT INTO storage.buckets (id, name, public)
VALUES ('profile-pictures', 'profile-pictures', true)
ON CONFLICT (id) 
DO UPDATE SET public = true;

-- Step 6: Verify policies
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies
WHERE schemaname = 'storage' 
AND tablename = 'objects'
AND policyname LIKE '%profile-pictures%'
ORDER BY policyname;
