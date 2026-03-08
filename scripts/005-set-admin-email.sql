-- Set admin access for existing accounts with Dinfadashe@gmail.com
-- Run this script to grant admin access to any existing accounts

-- Update existing user to admin if email matches
UPDATE public.users
SET is_admin = true
WHERE email = 'Dinfadashe@gmail.com';

-- Verify the update
SELECT id, email, full_name, is_admin
FROM public.users
WHERE email = 'Dinfadashe@gmail.com';
