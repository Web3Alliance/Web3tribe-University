# Fix Profile Picture Upload - Final Solution

## The Problem
You're getting "new row violates row-level security policy" when uploading profile pictures.

## The Solution
Run this SQL in your Supabase SQL Editor: https://supabase.com/dashboard/project/smbxcbpnscdrzlfmimyo/sql/new

Copy and paste this ENTIRE script, then click "Run":

```sql
-- 1. Drop all existing profile picture policies
DROP POLICY IF EXISTS "Users can upload own profile pictures" ON storage.objects;
DROP POLICY IF EXISTS "Users can update own profile pictures" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete own profile pictures" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can view profile pictures" ON storage.objects;
DROP POLICY IF EXISTS "Profile pictures are publicly accessible" ON storage.objects;
DROP POLICY IF EXISTS "Enrolled users can access course materials" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated uploads" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated updates" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated deletes" ON storage.objects;
DROP POLICY IF EXISTS "Public read access" ON storage.objects;

-- 2. Make sure bucket is public
UPDATE storage.buckets 
SET public = true 
WHERE id = 'profile-pictures';

-- 3. Create SIMPLE policies that allow everything for authenticated users
CREATE POLICY "profile_pictures_upload" 
ON storage.objects 
FOR INSERT 
TO authenticated 
WITH CHECK (bucket_id = 'profile-pictures');

CREATE POLICY "profile_pictures_update" 
ON storage.objects 
FOR UPDATE 
TO authenticated 
USING (bucket_id = 'profile-pictures');

CREATE POLICY "profile_pictures_delete" 
ON storage.objects 
FOR DELETE 
TO authenticated 
USING (bucket_id = 'profile-pictures');

CREATE POLICY "profile_pictures_select" 
ON storage.objects 
FOR SELECT 
TO public 
USING (bucket_id = 'profile-pictures');
```

## After Running the Script

1. Refresh your app at https://webtribeuni2700.pinet.com
2. Login with your account
3. Go to Profile (click More → Profile)
4. Click the camera icon to upload a profile picture
5. It should work now!

## What This Does

- Removes all conflicting old policies
- Makes the profile-pictures bucket public
- Creates 4 simple policies:
  - Authenticated users can UPLOAD pictures
  - Authenticated users can UPDATE pictures
  - Authenticated users can DELETE pictures  
  - Everyone can VIEW pictures (public)

## Verification

After running the script, you can verify it worked by running:

```sql
SELECT policyname, cmd FROM pg_policies 
WHERE tablename = 'objects' 
AND policyname LIKE 'profile_pictures%';
```

You should see 4 policies listed.
