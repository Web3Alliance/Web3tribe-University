# Environment Variables Reference

Copy `.env.example` to `.env.local` for local development. In production (Netlify), set these under **Site settings → Environment variables**.

## Required

| Variable | Where to get it | Notes |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase → Project Settings → API | Public, safe to expose to the browser |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase → Project Settings → API | Public anon key; RLS is what actually protects data |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Project Settings → API | **Secret.** Never expose to the browser. Used only in `lib/supabase/admin.ts` for privileged server-side operations (certificate generation, public certificate verification lookups, system health checks). |
| `NEXT_PUBLIC_SITE_URL` | Your deployed URL, or `http://localhost:3000` locally | Used to build absolute redirect/callback URLs for auth and certificate verification links |

## Optional — Donations (Paystack)

| Variable | Notes |
|---|---|
| `PAYSTACK_SECRET_KEY` | Required to initialize/verify real transactions and validate webhooks. Without it, `/api/donations` will return a clear error for `method: "paystack"` donations, but `manual`/`bank_transfer` donation recording still works (admin-confirmed). |
| `NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY` | Only needed if you build an inline Paystack popup checkout on the client in addition to the redirect flow already implemented. |

## Optional — Donations (Flutterwave)

| Variable | Notes |
|---|---|
| `FLUTTERWAVE_SECRET_KEY` | Not yet wired to a route handler — the `donations_flutterwave_enabled` feature flag exists as a placeholder for this future integration, following the same pattern as `lib/paystack.ts`. |
| `NEXT_PUBLIC_FLUTTERWAVE_PUBLIC_KEY` | Same as above. |

## Email — now used by the app (recommended in production)

| Variable | Notes |
|---|---|
| `RESEND_API_KEY` | **Now actively used** by `lib/email.ts` for transactional emails the app sends directly: learner invitations, "new applicant" alerts to organizations, shortlist notifications to students (with the organization's next-steps message), and offer accepted/declined alerts back to organizations. Without it, these emails are skipped with a server log — in-app notifications for the same events still work fully. Supabase Auth continues to send verification/password-reset emails independently of this key. |
| `EMAIL_FROM` | From name/address for the above, e.g. `Web3tribe University <no-reply@yourdomain.com>`. The domain must be verified in your Resend account. |

## Optional — Push Notifications

| Variable | Notes |
|---|---|
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | Required only if you implement actual browser push delivery. The `notifications` database table and in-app notification center already exist and work without this; this is only for extending delivery to native OS push notifications. Generate with `npx web-push generate-vapid-keys`. |
| `VAPID_PRIVATE_KEY` | Server-side counterpart to the above. **Secret.** |

## What happens if optional variables are missing?

The application is designed to degrade gracefully:
- Without Paystack keys: card/online donations show a clear error; manual/bank-transfer donations still work end-to-end.
- Without custom SMTP: Supabase's default (rate-limited) email sending is used instead — fine for development and low-volume production.
- Without VAPID keys: in-app notifications work fully; only native browser push delivery is unavailable.
- Without Google OAuth configured in Supabase: the "Continue with Google" button will show a Supabase-returned error when clicked, but email/password auth is unaffected.
