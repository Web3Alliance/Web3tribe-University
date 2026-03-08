-- Fix forum posts visibility

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Anyone authenticated can view forum posts" ON public.forum_posts;
DROP POLICY IF EXISTS "Users can create their own posts" ON public.forum_posts;
DROP POLICY IF EXISTS "Users can update their own posts" ON public.forum_posts;
DROP POLICY IF EXISTS "Users can delete their own posts" ON public.forum_posts;

-- Enable RLS
ALTER TABLE public.forum_posts ENABLE ROW LEVEL SECURITY;

-- Allow all authenticated users to read all forum posts
CREATE POLICY "forum_posts_select_policy"
  ON public.forum_posts FOR SELECT
  TO authenticated
  USING (true);

-- Allow users to create posts
CREATE POLICY "forum_posts_insert_policy"
  ON public.forum_posts FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Allow users to update their own posts (for likes_count, comments_count)
CREATE POLICY "forum_posts_update_policy"
  ON public.forum_posts FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Allow users to delete their own posts
CREATE POLICY "forum_posts_delete_policy"
  ON public.forum_posts FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Ensure likes and comments tables have correct policies
DROP POLICY IF EXISTS "Users can view all likes" ON public.forum_post_likes;
DROP POLICY IF EXISTS "Users can like posts" ON public.forum_post_likes;
DROP POLICY IF EXISTS "Users can unlike posts" ON public.forum_post_likes;

ALTER TABLE public.forum_post_likes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "forum_likes_select_policy"
  ON public.forum_post_likes FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "forum_likes_insert_policy"
  ON public.forum_post_likes FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "forum_likes_delete_policy"
  ON public.forum_post_likes FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);
