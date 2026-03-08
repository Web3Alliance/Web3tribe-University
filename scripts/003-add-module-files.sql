-- Add file columns to modules table for PDF and video uploads

-- Add pdf_url column for module PDF materials
ALTER TABLE public.modules 
ADD COLUMN IF NOT EXISTS pdf_url TEXT;

-- Add video_file_url column (in addition to existing video_url for external links)
ALTER TABLE public.modules 
ADD COLUMN IF NOT EXISTS video_file_url TEXT;

-- Add file metadata columns
ALTER TABLE public.modules 
ADD COLUMN IF NOT EXISTS pdf_filename TEXT,
ADD COLUMN IF NOT EXISTS pdf_size BIGINT,
ADD COLUMN IF NOT EXISTS video_filename TEXT,
ADD COLUMN IF NOT EXISTS video_size BIGINT;

-- Add comments
COMMENT ON COLUMN public.modules.pdf_url IS 'URL to uploaded PDF file in Supabase storage';
COMMENT ON COLUMN public.modules.video_file_url IS 'URL to uploaded video file in Supabase storage';
COMMENT ON COLUMN public.modules.video_url IS 'External video URL (YouTube, Vimeo, etc.)';
COMMENT ON COLUMN public.modules.pdf_filename IS 'Original filename of uploaded PDF';
COMMENT ON COLUMN public.modules.video_filename IS 'Original filename of uploaded video';
