# Account Setup Guide

This guide will help you create the admin and user accounts for Web3Tribe University.

## Method 1: Using Supabase Dashboard (Recommended)

### Step 1: Access Supabase Dashboard

1. Go to: https://supabase.com/dashboard/project/smbxcbpnscdrzlfmimyo
2. Navigate to: **Authentication** → **Users**

### Step 2: Create Administrator Account

1. Click **"Add user"** button
2. Fill in the details:
   ```
   Email: Dinfadashe@gmail.com
   Password: Administrator
   Auto Confirm User: ✓ (Check this box)
   ```
3. Click **"Create user"**
4. The account will be created with `is_admin = true` automatically

### Step 3: Create User Account

1. Click **"Add user"** button again
2. Fill in the details:
   ```
   Email: dashedinfa@gmail.com
   Password: Administrator
   Auto Confirm User: ✓ (Check this box)
   ```
3. Click **"Create user"**
4. This will be a regular user account

### Step 4: Verify Accounts

Run this SQL query in Supabase SQL Editor to verify:

```sql
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
```

Expected result:
- Dinfadashe@gmail.com: `is_admin = true`
- dashedinfa@gmail.com: `is_admin = false`

---

## Method 2: Using SQL Script (Alternative)

If you prefer to use SQL, run this script in Supabase SQL Editor:

**Note:** This method requires the Supabase `auth.users` table access which may not work in all environments.

```sql
-- This script creates test accounts
-- WARNING: Only use in development/testing

-- First, ensure the admin email check is in place
UPDATE public.users 
SET is_admin = true 
WHERE email = 'Dinfadashe@gmail.com';

-- If accounts don't exist yet, you'll need to sign up manually
-- or use Supabase Dashboard method above
```

---

## Method 3: Sign Up Through App (Manual)

### For Administrator Account:

1. Open your app: http://localhost:3000 (or your deployed URL)
2. Click **"Sign Up"**
3. Enter details:
   ```
   Full Name: Administrator
   Email: Dinfadashe@gmail.com
   Password: Administrator
   Country: (Any country)
   ```
4. Click **"Sign Up"**
5. If email verification is required, go to Supabase Dashboard → Authentication → Users
6. Find the user and click **"..."** → **"Confirm email"**
7. The account will automatically have admin access due to the email

### For User Account:

1. Click **"Sign Up"**
2. Enter details:
   ```
   Full Name: Test User
   Email: dashedinfa@gmail.com
   Password: Administrator
   Country: (Any country)
   ```
3. Click **"Sign Up"**
4. Confirm email if needed (same process as above)

---

## Verification Steps

After creating accounts, verify they work:

### 1. Test Administrator Account

1. Log in with: `Dinfadashe@gmail.com` / `Administrator`
2. You should see:
   - **Admin badge** in the top bar (Shield icon)
   - **Admin** tab in bottom navigation
   - Access to `/admin` dashboard
3. Navigate to Admin Dashboard to review courses

### 2. Test User Account

1. Log out of admin account
2. Log in with: `dashedinfa@gmail.com` / `Administrator`
3. You should see:
   - Regular user interface
   - No admin badge or admin access
   - Access to courses, learning, wallet pages

---

## Troubleshooting

### Issue: "Email not confirmed"

**Solution:**
1. Go to Supabase Dashboard
2. Authentication → Users
3. Find the user
4. Click "..." → "Confirm email"

### Issue: "Admin account not showing admin features"

**Solution:**
1. Run this SQL query:
   ```sql
   UPDATE public.users 
   SET is_admin = true 
   WHERE email = 'Dinfadashe@gmail.com';
   ```
2. Log out and log back in

### Issue: "Invalid login credentials"

**Solution:**
1. Verify the email and password are correct
2. Check that email is confirmed in Supabase Dashboard
3. Try resetting the password if needed

---

## Security Recommendations

### For Production:

1. **Change default password immediately** after first login
2. Use strong passwords (minimum 12 characters)
3. Enable two-factor authentication if available
4. Never share admin credentials
5. Regularly review admin access logs

### Password Change:

After logging in with default password:
1. Go to **Profile** page
2. Click **"Change Password"**
3. Set a strong, unique password
4. Save changes

---

## Next Steps

Once accounts are created and verified:

1. ✅ Log in with admin account
2. ✅ Explore the admin dashboard
3. ✅ Create a test course as a tutor
4. ✅ Review and approve/reject the course as admin
5. ✅ Test user account by enrolling in courses
6. ✅ Verify token earnings work correctly

---

## Quick Command Reference

### Check if accounts exist:
```sql
SELECT email, is_admin, email_verified 
FROM public.users 
WHERE email IN ('Dinfadashe@gmail.com', 'dashedinfa@gmail.com');
```

### Grant admin access manually:
```sql
UPDATE public.users 
SET is_admin = true 
WHERE email = 'Dinfadashe@gmail.com';
```

### Confirm email manually:
```sql
UPDATE auth.users 
SET email_confirmed_at = NOW() 
WHERE email IN ('Dinfadashe@gmail.com', 'dashedinfa@gmail.com');
```

### Reset password (requires Supabase Dashboard):
- Use Dashboard → Authentication → Users → "..." → "Send password reset email"

---

**Need Help?**

If you encounter any issues:
1. Check the Supabase Dashboard for error logs
2. Verify email confirmation status
3. Check the browser console for error messages
4. Review the DEPLOYMENT_GUIDE.md for setup instructions
