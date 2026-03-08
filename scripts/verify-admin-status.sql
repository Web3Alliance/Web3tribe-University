-- Run this query to verify your admin status
-- Copy the output and check if is_admin is TRUE

SELECT 
  id,
  email,
  full_name,
  is_admin,
  is_tutor,
  email_verified,
  created_at
FROM public.users 
WHERE email IN ('dinfadashe@gmail.com', 'dashedinfa@gmail.com')
ORDER BY email;

-- If is_admin is FALSE or NULL for dinfadashe@gmail.com, run this:
-- UPDATE public.users SET is_admin = TRUE WHERE email = 'dinfadashe@gmail.com';

-- To check if the column exists:
-- SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'is_admin';
