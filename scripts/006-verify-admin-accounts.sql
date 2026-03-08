-- =========================================
-- Verify and Update Admin Accounts
-- =========================================
-- Run this AFTER creating accounts through Supabase Dashboard

-- 1. Check if accounts exist
SELECT 
  id,
  email,
  full_name,
  is_admin,
  is_tutor,
  email_verified,
  created_at
FROM public.users
WHERE email IN ('Dinfadashe@gmail.com', 'dashedinfa@gmail.com')
ORDER BY email;

-- 2. Ensure admin account has admin privileges
UPDATE public.users 
SET 
  is_admin = true,
  full_name = COALESCE(NULLIF(full_name, ''), 'Administrator')
WHERE email = 'Dinfadashe@gmail.com';

-- 3. Ensure user account is regular user (not admin)
UPDATE public.users 
SET 
  is_admin = false,
  full_name = COALESCE(NULLIF(full_name, ''), 'Test User')
WHERE email = 'dashedinfa@gmail.com';

-- 4. Verify the updates
SELECT 
  email,
  full_name,
  is_admin,
  w3tr_balance,
  email_verified
FROM public.users
WHERE email IN ('Dinfadashe@gmail.com', 'dashedinfa@gmail.com')
ORDER BY is_admin DESC;

-- Expected output:
-- Dinfadashe@gmail.com | Administrator | true  | 0 | true
-- dashedinfa@gmail.com | Test User     | false | 0 | true
