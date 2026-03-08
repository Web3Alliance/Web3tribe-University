# Admin Setup Guide

## Setting Up the First Admin User

After deploying your app, you need to manually set yourself as an admin in the Supabase database.

### Steps:

1. **Go to Supabase Dashboard:**
   - Visit: https://supabase.com/dashboard/project/smbxcbpnscdrzlfmimyo
   - Navigate to: **SQL Editor**

2. **Run Database Migrations:**
   ```sql
   -- First, run the admin schema migration
   -- Copy and paste the entire content from scripts/004-add-admin-and-file-types.sql
   ```

3. **Make Yourself Admin:**
   ```sql
   -- Replace YOUR_EMAIL with your actual email address
   UPDATE public.users
   SET is_admin = TRUE
   WHERE email = 'YOUR_EMAIL@example.com';
   ```

4. **Verify Admin Status:**
   ```sql
   -- Check if admin flag is set
   SELECT id, email, full_name, is_admin
   FROM public.users
   WHERE email = 'YOUR_EMAIL@example.com';
   ```

5. **Access Admin Dashboard:**
   - Log out and log back in to your app
   - You should now see the "Admin" tab in the mobile navigation
   - Click on it to access the course review dashboard

## Granting Admin Access to Others

To grant admin privileges to another user:

1. **Get the user's email:**
   - Find the email address of the user you want to make an admin

2. **Run SQL Query:**
   ```sql
   UPDATE public.users
   SET is_admin = TRUE
   WHERE email = 'THEIR_EMAIL@example.com';
   ```

3. **Notify the user:**
   - They'll need to log out and log back in to see the Admin tab

## Admin Features

Once you're an admin, you can:

- View all submitted courses (pending, approved, rejected)
- Approve courses to make them live
- Reject courses with a reason that's emailed to the tutor
- See course statistics and review history
- Access course details before approval

## Security Notes

- Only grant admin access to trusted users
- Admin actions are logged in the `course_reviews` table
- Email notifications are sent to tutors automatically on approval/rejection
- Admin access cannot be revoked by the admin themselves (requires direct database access)

## Troubleshooting

**Issue: Admin tab not showing**
- Check if is_admin flag is TRUE in database
- Try logging out and back in
- Clear browser cache

**Issue: Can't approve/reject courses**
- Verify you're logged in as an admin user
- Check browser console for errors
- Ensure database permissions are set correctly

**Issue: Emails not sending**
- Email notifications are currently logged to console
- To enable actual emails, integrate with SendGrid, Resend, or similar
- See `/app/api/admin/notify-tutor/route.ts` for implementation

## Email Integration (Production)

To enable actual email sending:

1. **Choose an email service:**
   - SendGrid (recommended)
   - Resend
   - AWS SES
   - Nodemailer with SMTP

2. **Install package:**
   ```bash
   npm install @sendgrid/mail
   # or
   npm install resend
   ```

3. **Update API route:**
   - Edit `/app/api/admin/notify-tutor/route.ts`
   - Replace console.log with actual email sending
   - Add API key to environment variables

4. **Example with SendGrid:**
   ```typescript
   import sgMail from '@sendgrid/mail'
   
   sgMail.setApiKey(process.env.SENDGRID_API_KEY!)
   
   await sgMail.send({
     to: tutorEmail,
     from: 'noreply@web3tribe.com',
     subject,
     text: message
   })
   ```

5. **Add environment variable:**
   ```
   SENDGRID_API_KEY=your_api_key_here
   ```
