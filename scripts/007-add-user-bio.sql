-- Add bio/description field to users table
ALTER TABLE public.users 
ADD COLUMN IF NOT EXISTS bio TEXT;

-- Add comment
COMMENT ON COLUMN public.users.bio IS 'User biography or self-description';
