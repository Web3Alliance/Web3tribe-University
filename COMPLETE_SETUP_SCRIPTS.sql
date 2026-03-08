-- =========================================
-- COMPLETE SQL SCRIPTS FOR WEB3TRIBE UNIVERSITY
-- Run these scripts in your Supabase SQL Editor
-- =========================================

-- 1. ENABLE REQUIRED EXTENSIONS
-- =========================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. ENSURE USERS TABLE HAS REQUIRED COLUMNS
-- =========================================
ALTER TABLE public.users 
ADD COLUMN IF NOT EXISTS bio TEXT,
ADD COLUMN IF NOT EXISTS is_admin BOOLEAN DEFAULT FALSE;

-- Add index for faster user search
CREATE INDEX IF NOT EXISTS idx_users_full_name ON public.users USING gin(to_tsvector('english', full_name));
CREATE INDEX IF NOT EXISTS idx_users_email ON public.users(email);

-- 3. USER FOLLOWS TABLE
-- =========================================
CREATE TABLE IF NOT EXISTS public.user_follows (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  follower_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  following_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(follower_id, following_id),
  CHECK (follower_id != following_id)
);

CREATE INDEX IF NOT EXISTS idx_user_follows_follower ON public.user_follows(follower_id);
CREATE INDEX IF NOT EXISTS idx_user_follows_following ON public.user_follows(following_id);

-- 4. FORUM POSTS TABLE
-- =========================================
CREATE TABLE IF NOT EXISTS public.forum_posts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  media_url TEXT,
  likes_count INTEGER DEFAULT 0,
  comments_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_forum_posts_user ON public.forum_posts(user_id);
CREATE INDEX IF NOT EXISTS idx_forum_posts_created ON public.forum_posts(created_at DESC);

-- 5. FORUM POST LIKES TABLE
-- =========================================
CREATE TABLE IF NOT EXISTS public.forum_post_likes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  post_id UUID REFERENCES public.forum_posts(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(post_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_forum_post_likes_post ON public.forum_post_likes(post_id);
CREATE INDEX IF NOT EXISTS idx_forum_post_likes_user ON public.forum_post_likes(user_id);

-- 6. FORUM POST COMMENTS TABLE
-- =========================================
CREATE TABLE IF NOT EXISTS public.forum_post_comments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  post_id UUID REFERENCES public.forum_posts(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_forum_post_comments_post ON public.forum_post_comments(post_id);
CREATE INDEX IF NOT EXISTS idx_forum_post_comments_user ON public.forum_post_comments(user_id);

-- 7. PRIVATE MESSAGES TABLE
-- =========================================
CREATE TABLE IF NOT EXISTS public.private_messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  sender_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  receiver_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CHECK (sender_id != receiver_id)
);

CREATE INDEX IF NOT EXISTS idx_private_messages_sender ON public.private_messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_private_messages_receiver ON public.private_messages(receiver_id);
CREATE INDEX IF NOT EXISTS idx_private_messages_created ON public.private_messages(created_at DESC);

-- 8. ROW LEVEL SECURITY POLICIES
-- =========================================

-- Enable RLS on all tables
ALTER TABLE public.user_follows ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.forum_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.forum_post_likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.forum_post_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.private_messages ENABLE ROW LEVEL SECURITY;

-- Drop existing policies to avoid conflicts
DROP POLICY IF EXISTS "Users can view all follows" ON public.user_follows;
DROP POLICY IF EXISTS "Users can follow others" ON public.user_follows;
DROP POLICY IF EXISTS "Users can unfollow" ON public.user_follows;
DROP POLICY IF EXISTS "Anyone authenticated can view forum posts" ON public.forum_posts;
DROP POLICY IF EXISTS "Users can create their own posts" ON public.forum_posts;
DROP POLICY IF EXISTS "Users can update their own posts" ON public.forum_posts;
DROP POLICY IF EXISTS "Users can delete their own posts" ON public.forum_posts;
DROP POLICY IF EXISTS "Users can view all likes" ON public.forum_post_likes;
DROP POLICY IF EXISTS "Users can like posts" ON public.forum_post_likes;
DROP POLICY IF EXISTS "Users can unlike posts" ON public.forum_post_likes;
DROP POLICY IF EXISTS "Users can view all comments" ON public.forum_post_comments;
DROP POLICY IF EXISTS "Users can comment on posts" ON public.forum_post_comments;
DROP POLICY IF EXISTS "Users can delete their own comments" ON public.forum_post_comments;
DROP POLICY IF EXISTS "Users can view their messages" ON public.private_messages;
DROP POLICY IF EXISTS "Users can send messages" ON public.private_messages;
DROP POLICY IF EXISTS "Users can update received messages (mark as read)" ON public.private_messages;
DROP POLICY IF EXISTS "Authenticated users can view other user profiles" ON public.users;

-- USER FOLLOWS POLICIES
CREATE POLICY "Users can view all follows"
  ON public.user_follows FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can follow others"
  ON public.user_follows FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = follower_id);

CREATE POLICY "Users can unfollow"
  ON public.user_follows FOR DELETE
  TO authenticated
  USING (auth.uid() = follower_id);

-- FORUM POSTS POLICIES
CREATE POLICY "Anyone authenticated can view forum posts"
  ON public.forum_posts FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can create their own posts"
  ON public.forum_posts FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own posts"
  ON public.forum_posts FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own posts"
  ON public.forum_posts FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- FORUM POST LIKES POLICIES
CREATE POLICY "Users can view all likes"
  ON public.forum_post_likes FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can like posts"
  ON public.forum_post_likes FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can unlike posts"
  ON public.forum_post_likes FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- FORUM POST COMMENTS POLICIES
CREATE POLICY "Users can view all comments"
  ON public.forum_post_comments FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can comment on posts"
  ON public.forum_post_comments FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own comments"
  ON public.forum_post_comments FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- PRIVATE MESSAGES POLICIES
CREATE POLICY "Users can view their messages"
  ON public.private_messages FOR SELECT
  TO authenticated
  USING (auth.uid() = sender_id OR auth.uid() = receiver_id);

CREATE POLICY "Users can send messages"
  ON public.private_messages FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = sender_id);

CREATE POLICY "Users can update received messages (mark as read)"
  ON public.private_messages FOR UPDATE
  TO authenticated
  USING (auth.uid() = receiver_id);

-- USERS TABLE POLICY (for search)
CREATE POLICY "Authenticated users can view other user profiles"
  ON public.users FOR SELECT
  TO authenticated
  USING (true);

-- 9. FUNCTION TO CHARGE W3TR FOR MESSAGES
-- =========================================
CREATE OR REPLACE FUNCTION public.charge_message_fee()
RETURNS TRIGGER AS $$
DECLARE
  sender_balance DECIMAL(20, 2);
BEGIN
  -- Get sender's current balance
  SELECT w3tr_balance INTO sender_balance
  FROM public.users
  WHERE id = NEW.sender_id;

  -- Check if sender has enough balance
  IF sender_balance < 1.0 THEN
    RAISE EXCEPTION 'Insufficient W3TR balance. You need 1 W3TR to send a message.';
  END IF;

  -- Deduct 1 W3TR from sender
  UPDATE public.users
  SET w3tr_balance = w3tr_balance - 1.0
  WHERE id = NEW.sender_id;

  -- Record transaction
  INSERT INTO public.transactions (user_id, type, amount, currency, description)
  VALUES (NEW.sender_id, 'spend', -1.0, 'W3TR', 'Message sent');

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop and recreate trigger
DROP TRIGGER IF EXISTS charge_message_fee_trigger ON public.private_messages;
CREATE TRIGGER charge_message_fee_trigger
  BEFORE INSERT ON public.private_messages
  FOR EACH ROW EXECUTE FUNCTION public.charge_message_fee();

-- 10. GRANT ADMIN ACCESS TO YOUR EMAIL
-- =========================================
UPDATE public.users 
SET is_admin = TRUE 
WHERE email = 'dinfadashe@gmail.com';

-- 11. PERFORMANCE OPTIMIZATION INDEXES
-- =========================================
-- These indexes speed up common queries

-- Composite indexes for faster joins
CREATE INDEX IF NOT EXISTS idx_enrollments_user_course ON public.enrollments(user_id, course_id);
CREATE INDEX IF NOT EXISTS idx_progress_user_module ON public.module_progress(user_id, module_id);
CREATE INDEX IF NOT EXISTS idx_transactions_user_created ON public.transactions(user_id, created_at DESC);

-- Partial indexes for active records
CREATE INDEX IF NOT EXISTS idx_courses_published ON public.courses(created_at DESC) WHERE status = 'published';
CREATE INDEX IF NOT EXISTS idx_messages_unread ON public.private_messages(receiver_id, created_at DESC) WHERE is_read = FALSE;

-- Full text search index for course titles
CREATE INDEX IF NOT EXISTS idx_courses_title_search ON public.courses USING gin(to_tsvector('english', title));

-- 12. VACUUM AND ANALYZE FOR PERFORMANCE
-- =========================================
VACUUM ANALYZE public.users;
VACUUM ANALYZE public.courses;
VACUUM ANALYZE public.enrollments;
VACUUM ANALYZE public.forum_posts;
VACUUM ANALYZE public.private_messages;

-- =========================================
-- SETUP COMPLETE!
-- =========================================
-- Your database is now fully configured with:
-- ✓ User search by name, email, or first name
-- ✓ Follow/unfollow system
-- ✓ Students forum with posts, likes, comments
-- ✓ Private messaging with 1 W3TR fee per message
-- ✓ Optimized indexes for fast queries
-- ✓ Proper RLS policies for security
-- =========================================
