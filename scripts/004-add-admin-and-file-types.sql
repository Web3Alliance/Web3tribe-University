-- Add admin role and course rejection reason
-- Add support for more file types

-- Add is_admin column to users table
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS is_admin BOOLEAN DEFAULT FALSE;

-- Add rejection reason to courses table
ALTER TABLE public.courses ADD COLUMN IF NOT EXISTS rejection_reason TEXT;

-- Add file URLs to modules table for additional file types
ALTER TABLE public.modules ADD COLUMN IF NOT EXISTS txt_file_url TEXT;
ALTER TABLE public.modules ADD COLUMN IF NOT EXISTS docx_file_url TEXT;
ALTER TABLE public.modules ADD COLUMN IF NOT EXISTS txt_filename TEXT;
ALTER TABLE public.modules ADD COLUMN IF NOT EXISTS docx_filename TEXT;

-- Create admin RLS policies for courses
CREATE POLICY "Admins can view all courses"
  ON public.courses FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = auth.uid()
      AND users.is_admin = TRUE
    )
  );

CREATE POLICY "Admins can update all courses"
  ON public.courses FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = auth.uid()
      AND users.is_admin = TRUE
    )
  );

-- Create course review history table
CREATE TABLE IF NOT EXISTS public.course_reviews (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  course_id UUID REFERENCES public.courses(id) ON DELETE CASCADE,
  reviewer_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  action TEXT NOT NULL, -- 'approved' or 'rejected'
  reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for course reviews
CREATE INDEX IF NOT EXISTS idx_course_reviews_course ON public.course_reviews(course_id);
CREATE INDEX IF NOT EXISTS idx_course_reviews_reviewer ON public.course_reviews(reviewer_id);

-- RLS for course reviews
ALTER TABLE public.course_reviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view all reviews"
  ON public.course_reviews FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = auth.uid()
      AND users.is_admin = TRUE
    )
  );

CREATE POLICY "Admins can create reviews"
  ON public.course_reviews FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = reviewer_id AND
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = auth.uid()
      AND users.is_admin = TRUE
    )
  );
