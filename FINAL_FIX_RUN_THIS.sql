-- =====================================================
-- FINAL FIX SCRIPT - RUN THIS IN SUPABASE SQL EDITOR
-- =====================================================
-- This script fixes profile picture upload and user search
-- Run this entire script in one go

-- Step 1: Drop ALL existing storage policies
DO $$
BEGIN
    -- Drop all policies on storage.objects
    DROP POLICY IF EXISTS "Users can upload own profile pictures" ON storage.objects;
    DROP POLICY IF EXISTS "Users can update own profile pictures" ON storage.objects;
    DROP POLICY IF EXISTS "Users can delete own profile pictures" ON storage.objects;
    DROP POLICY IF EXISTS "Profile pictures are publicly accessible" ON storage.objects;
    DROP POLICY IF EXISTS "Anyone can view profile pictures" ON storage.objects;
    DROP POLICY IF EXISTS "Authenticated users can upload profile pictures" ON storage.objects;
    DROP POLICY IF EXISTS "Profile pictures are public" ON storage.objects;
    DROP POLICY IF EXISTS "Users can upload profile pictures" ON storage.objects;
    DROP POLICY IF EXISTS "Enrolled users can access course materials" ON storage.objects;
END $$;

-- Step 2: Enable RLS on storage.objects (if not already enabled)
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- Step 3: Create simple, working policies for profile pictures
-- Allow authenticated users to INSERT (upload) to their own folder
CREATE POLICY "profile_upload_policy"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'profile-pictures' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- Allow authenticated users to UPDATE their own files
CREATE POLICY "profile_update_policy"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'profile-pictures' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- Allow authenticated users to DELETE their own files
CREATE POLICY "profile_delete_policy"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'profile-pictures' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- Allow PUBLIC to SELECT (view) all profile pictures
CREATE POLICY "profile_view_policy"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'profile-pictures');

-- Step 4: Ensure user_follows table exists with proper structure
CREATE TABLE IF NOT EXISTS public.user_follows (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  follower_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  following_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(follower_id, following_id)
);

-- Enable RLS on user_follows
ALTER TABLE public.user_follows ENABLE ROW LEVEL SECURITY;

-- Drop existing policies
DROP POLICY IF EXISTS "Users can view all follows" ON public.user_follows;
DROP POLICY IF EXISTS "Users can follow others" ON public.user_follows;
DROP POLICY IF EXISTS "Users can unfollow" ON public.user_follows;

-- Create policies for user_follows
CREATE POLICY "view_follows_policy"
ON public.user_follows
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "create_follow_policy"
ON public.user_follows
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = follower_id);

CREATE POLICY "delete_follow_policy"
ON public.user_follows
FOR DELETE
TO authenticated
USING (auth.uid() = follower_id);

-- Step 5: Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_user_follows_follower ON public.user_follows(follower_id);
CREATE INDEX IF NOT EXISTS idx_user_follows_following ON public.user_follows(following_id);
CREATE INDEX IF NOT EXISTS idx_users_full_name ON public.users USING gin(to_tsvector('english', full_name));
CREATE INDEX IF NOT EXISTS idx_users_email ON public.users(email);

-- Step 6: Ensure forum tables exist
CREATE TABLE IF NOT EXISTS public.forum_posts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  media_url TEXT,
  likes_count INTEGER DEFAULT 0,
  comments_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.forum_post_likes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  post_id UUID NOT NULL REFERENCES public.forum_posts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(post_id, user_id)
);

-- Enable RLS
ALTER TABLE public.forum_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.forum_post_likes ENABLE ROW LEVEL SECURITY;

-- Forum posts policies
DROP POLICY IF EXISTS "Anyone can view forum posts" ON public.forum_posts;
DROP POLICY IF EXISTS "Users can create posts" ON public.forum_posts;
DROP POLICY IF EXISTS "Users can update own posts" ON public.forum_posts;
DROP POLICY IF EXISTS "Users can delete own posts" ON public.forum_posts;

CREATE POLICY "view_forum_posts_policy"
ON public.forum_posts FOR SELECT TO authenticated USING (true);

CREATE POLICY "create_forum_post_policy"
ON public.forum_posts FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "update_own_forum_post_policy"
ON public.forum_posts FOR UPDATE TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "delete_own_forum_post_policy"
ON public.forum_posts FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Forum post likes policies
DROP POLICY IF EXISTS "Anyone can view likes" ON public.forum_post_likes;
DROP POLICY IF EXISTS "Users can like posts" ON public.forum_post_likes;
DROP POLICY IF EXISTS "Users can unlike posts" ON public.forum_post_likes;

CREATE POLICY "view_likes_policy"
ON public.forum_post_likes FOR SELECT TO authenticated USING (true);

CREATE POLICY "create_like_policy"
ON public.forum_post_likes FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "delete_like_policy"
ON public.forum_post_likes FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Create indexes for forum
CREATE INDEX IF NOT EXISTS idx_forum_posts_user ON public.forum_posts(user_id);
CREATE INDEX IF NOT EXISTS idx_forum_posts_created ON public.forum_posts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_forum_likes_post ON public.forum_post_likes(post_id);
CREATE INDEX IF NOT EXISTS idx_forum_likes_user ON public.forum_post_likes(user_id);

-- Done!
SELECT 'Setup complete! Profile picture upload and user search should now work.' as status;
