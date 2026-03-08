-- Check if is_admin column exists in users table
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public'
AND table_name = 'users'
AND column_name = 'is_admin';

-- If the above returns no rows, the column doesn't exist
-- Run script 004-add-admin-and-file-types.sql to add it

-- Check current admin users
SELECT id, email, full_name, is_admin
FROM public.users
WHERE email = 'Dinfadashe@gmail.com' OR email = 'dinfadashe@gmail.com';
