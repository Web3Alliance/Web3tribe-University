# Deployment Guide

This guide walks through deploying Web3tribe University to **Supabase** (database, auth, storage) and **Vercel** (application hosting), from an empty Supabase project to a live site.

## 1. Create your Supabase project

1. Go to [supabase.com](https://supabase.com) and create a new project.
2. Choose a strong database password and a region close to your users (e.g. an EU or nearest-available region for Nigeria-focused traffic, depending on what Supabase offers at the time).
3. Wait for provisioning to finish, then go to **Project Settings → API**. Copy:
   - **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
   - **anon public key** → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - **service_role key** → `SUPABASE_SERVICE_ROLE_KEY` (keep this secret — server-only)

## 2. Apply the database schema

Open the **SQL Editor** in your Supabase project and run **every file in `supabase/migrations/` in numeric order**, from `0001_schema.sql` to the latest (currently `0024_authoring_rewards_certificates_documents.sql`; there is no `0016`). Each file is written to be safe to re-run. Never skip one: later files (0022–0024) contain the security hardening the application relies on.

Then optionally run `supabase/seed/seed.sql` for starter categories, default reward rules, feature flags and a sample donation campaign.

After applying, run the read-only check scripts in `supabase/security/` (`verify-0022-applied.sql`, `verify-0023-applied.sql`, `verify-0024-applied.sql`); every row should say PASS.

You can validate the database rules locally, without touching your real project, with `python3 supabase/tests/security/run_all.py` (see `supabase/tests/security/README.md`).

## 3. Configure authentication

By default, email/password auth works immediately with no extra configuration — Supabase sends verification and password-reset emails using its built-in (rate-limited) email service, which is fine for development and low-volume production use.

### Google OAuth (optional)
1. In the Supabase Dashboard, go to **Authentication → Providers → Google**.
2. Create an OAuth Client ID in the [Google Cloud Console](https://console.cloud.google.com/apis/credentials), with an authorized redirect URI of `https://<your-project-ref>.supabase.co/auth/v1/callback`.
3. Paste the Client ID and Secret into the Supabase provider settings and enable it.
4. No code changes are needed — `components/login-form.tsx` already calls `supabase.auth.signInWithOAuth({ provider: "google" })`.

### Phone OTP (optional)
1. In **Authentication → Providers → Phone**, enable phone auth and configure an SMS provider (Twilio, MessageBird, etc.) with your own account credentials.
2. This is scaffolded but not wired into a UI page by default — add a phone-login form calling `supabase.auth.signInWithOtp({ phone })` if you need it.

### Custom SMTP (recommended for production)
Supabase's built-in email sending is rate-limited and unbranded. For production volume:
1. Go to **Project Settings → Authentication → SMTP Settings**.
2. Configure your own SMTP provider (Resend, Postmark, SES, etc.) with your sending domain verified.

## 4. Promote your first admin

After registering your own account through `/register`, promote it directly in the SQL Editor:

```sql
update public.profiles set role = 'super_admin' where email = 'you@example.com';
```

## 5. Configure environment variables

Copy `.env.example` to `.env.local` for local development; in production set them in Vercel (step 6). See `docs/ENV_SETUP.md` for the full variable reference.

## 6. Deploy to Vercel

1. Push the repository to GitHub.
2. In [Vercel](https://vercel.com), choose **Add New → Project** and import the repository. The framework (Next.js) is detected automatically; the defaults for build command and output are correct.
3. Under **Settings → Environment Variables**, add every variable from `.env.example` that you have a real value for (at minimum `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_SITE_URL` set to your production URL).
4. Deploy. Every push to `main` deploys automatically; pull requests get preview URLs.

**Deploy order when a change includes a database migration:** deploy the application code first, wait for it to be live, *then* run the migration in Supabase.

Security headers are set in `next.config.ts` (the Content-Security-Policy starts in report-only mode; see the comment there before enforcing it).

## 7. Configure Paystack donations (optional)

1. Create a [Paystack](https://paystack.com) account and get your **Secret Key** and **Public Key** from the dashboard.
2. Set `PAYSTACK_SECRET_KEY` and `NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY` in your environment.
3. In the Paystack Dashboard, under **Settings → API Keys & Webhooks**, set your webhook URL to:
   ```
   https://your-domain.example/api/donations/paystack/webhook
   ```
4. Donations made through the app will initialize a Paystack transaction; the webhook confirms payment and updates the donation record and campaign totals automatically.

## 8. Update your redirect/callback URLs

Once you know your production domain, update in Supabase:
- **Authentication → URL Configuration → Site URL**: your production URL.
- **Authentication → URL Configuration → Redirect URLs**: add `https://your-domain.example/api/auth/callback` and `https://your-domain.example/reset-password`.

And update `NEXT_PUBLIC_SITE_URL` in Vercel to match.

## 9. Post-deployment checklist

- [ ] Register an account and confirm the verification email arrives.
- [ ] Promote your account to `super_admin` via SQL.
- [ ] Log in and confirm the student dashboard loads with a W3TR balance of 0.
- [ ] Create a test instructor account, create a course with at least one lesson, submit it for review.
- [ ] Log in as the admin, approve the course from `/admin/courses`, confirm the instructor receives a `course_publish_bonus` W3TR transaction.
- [ ] Enroll as the student account, complete the lesson, confirm W3TR balance increases and a certificate can be generated once the course reaches 100%.
- [ ] Visit `/verify/<certificate_code>` and confirm the public verification page renders.
- [ ] If using Paystack, make a small real test donation and confirm it appears as "confirmed" in `/admin/donations` after the webhook fires.

## Troubleshooting

**Build fails on Vercel with a Supabase-related error at build time.** Ensure `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` are set in Vercel's environment variables — even placeholder values will let the build itself succeed, since these clients only fail at request time if unset, but Next.js's static-generation pass for a handful of pages can be sensitive to this.

**RLS errors ("new row violates row-level security policy").** This almost always means either (a) you're trying to insert/update a row with a `profile_id` that doesn't match the currently authenticated user, or (b) the acting user's role doesn't meet the policy's requirement. Check `lib/rbac.ts` and the relevant policy in `0001_schema.sql` Section 15.

**Certificates aren't generating a PDF URL.** Confirm the `certificates` storage bucket exists (from `0002_storage.sql`) and that `SUPABASE_SERVICE_ROLE_KEY` is set correctly — certificate PDF upload uses the admin client.
