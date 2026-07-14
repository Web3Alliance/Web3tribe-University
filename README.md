# Web3tribe University

**Learn. Build. Earn.**

A national learn-and-earn digital skills platform built with Next.js and Supabase. Students earn **W3TR** (an in-app reward asset — not a cryptocurrency) by learning; instructors earn W3TR by teaching; contributors earn W3TR for valuable educational content.

> **On blockchain:** This platform intentionally contains **no blockchain, wallet, smart contract, or cryptocurrency integration**. W3TR is implemented as a conventional relational ledger (see `supabase/migrations/0001_schema.sql`, tables `w3tr_wallets` / `w3tr_transactions`). The architecture is deliberately modular (`lib/reward-engine.ts`) so that an on-chain representation could be added later, behind the `blockchain_adapter_enabled` feature flag, without changing any application code — but nothing on-chain exists today.

---

## Tech stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 16 (App Router, Turbopack), React 19, TypeScript |
| Styling | Tailwind CSS v4, shadcn/ui-style components (hand-built on Radix primitives), Framer Motion |
| Backend | Supabase (PostgreSQL, Auth, Storage, Row Level Security) |
| Certificates | Server-generated PDF via `pdf-lib` + QR verification via `qrcode` |
| Payments | Paystack (donations); Flutterwave scaffolded behind a feature flag |
| Testing | Vitest (unit), Playwright (E2E) |
| Deployment | Netlify (`@netlify/plugin-nextjs`) + Supabase |

---

## Project structure

```
app/
  (marketing)            → landing page, at app/page.tsx
  login/ register/ ...   → auth pages
  student/                → student dashboard, courses, learning, wallet, certificates
  instructor/             → instructor dashboard, course authoring, analytics
  organization/           → organization dashboard, programs, learners
  admin/                  → user management, course moderation, rewards, donations, CMS
  super-admin/            → feature flags, system settings
  api/                    → REST route handlers (courses, lessons, quizzes, certificates,
                             donations, rewards, notifications, uploads)
components/
  ui/                     → hand-built shadcn-style primitives (button, dialog, table, ...)
  dashboard/              → shell, sidebar, topbar shared across all role dashboards
  course/                 → course cards, curriculum builder, lesson player, enroll flow
  admin/ settings/        → role-specific interactive widgets
contexts/
  auth-context.tsx        → client-side session/profile state
lib/
  supabase/               → browser / server / admin (service-role) / middleware clients
  actions/                → Next.js Server Actions (auth, courses, admin, organization, ...)
  reward-engine.ts        → the W3TR ledger abstraction (see note above)
  rbac.ts                 → role-based access control helpers
  certificate.ts          → PDF certificate generation
  paystack.ts             → Paystack donation integration
supabase/
  migrations/0001_schema.sql   → complete database schema, functions, triggers, RLS
  migrations/0002_storage.sql  → storage buckets and their policies
  seed/seed.sql                → categories, reward rules, feature flags, sample course
scripts/
  test-*.js               → schema/reward-engine/RLS validation scripts (run against an
                             in-memory Postgres via PGlite — no live Supabase required)
tests/
  unit/                   → Vitest unit tests (rbac, reward-engine, utils)
  e2e/                    → Playwright E2E tests (see tests/e2e/*.spec.ts for prerequisites)
```

---

## Getting started

```bash
npm install
cp .env.example .env.local   # then fill in your Supabase project's keys
npm run dev
```

See **`docs/ENV_SETUP.md`** for exactly which environment variables are required vs. optional, and **`docs/DEPLOYMENT_GUIDE.md`** for the full Supabase + Netlify deployment walkthrough.

### Setting up the database

1. Create a new Supabase project.
2. In the SQL Editor, run `supabase/migrations/0001_schema.sql`, then `supabase/migrations/0002_storage.sql`.
3. Optionally run `supabase/seed/seed.sql` for categories, default reward rules, feature flags, and a sample donation campaign.
4. Register an instructor account through `/register`, then re-run the sample-course block at the bottom of `seed.sql` if you want a populated example course (see the comment in that file — it explains why this can't be fully automated, since `auth.users` is managed by Supabase Auth, not plain SQL).
5. Promote your own account to `super_admin` for full access:
   ```sql
   update public.profiles set role = 'super_admin' where email = 'you@example.com';
   ```

### Running the test suites

```bash
npm run test               # unit tests (Vitest) — no external services required
npm run db:test-schema     # validates the full SQL schema against an in-memory Postgres
npm run db:test-functional # exercises the reward engine, idempotency, rating triggers
npm run db:test-rls        # exercises RLS policies with simulated Supabase roles
npm run db:test-storage    # validates the storage buckets/policies migration
npm run db:test-seed       # validates the seed script (with and without an instructor present)
npm run test:e2e           # Playwright E2E — requires a running dev server + real Supabase project
```

The `db:test-*` scripts are a distinctive part of this project: they spin up a real, in-memory PostgreSQL engine (via `@electric-sql/pglite`) with a minimal stub of Supabase's `auth` and `storage` schemas, then run the actual migration SQL against it and assert on real query results — not just "does it parse." This is how the reward engine's idempotency behavior, RLS enforcement, and rating triggers were verified during development, and you can re-run them at any time to confirm the schema still behaves correctly after you modify it.

---

## Key design decisions

- **No blockchain today, but the seam is real.** `lib/reward-engine.ts` defines a `RewardEngine` interface with one implementation (`LedgerRewardEngine`, backed by Postgres RPC functions). Every place in the app that awards or spends W3TR calls this interface, not Supabase directly. A future `OnChainRewardEngine` could implement the same interface.
- **RLS is the real security boundary**, not just application-layer role checks. Every table has row-level security policies (see Section 15 of `0001_schema.sql`); `lib/rbac.ts` provides ergonomic helpers for the application layer, but the database itself refuses cross-user access even if application code has a bug.
- **Server Actions + Route Handlers side by side.** Most interactive UI (course creation, moderation, admin actions) uses Next.js Server Actions for simplicity. A parallel REST API surface exists under `app/api/*` for anything a future mobile app or third-party integration would need (course CRUD, lesson completion, quiz submission, certificate generation, donations).
- **Certificates are real PDFs, not placeholders.** `lib/certificate.ts` generates an actual landscape A4 PDF with an embedded QR code linking to a public `/verify/[code]` page, uploaded to Supabase Storage.

---

## What you need to configure before going live

This project is code-complete and builds cleanly, but a few things require your own credentials/setup before real users can use it in production:

- **Supabase project**: run the migrations, get your project URL / anon key / service role key.
- **Google OAuth** (optional): enable the Google provider in Supabase Dashboard → Authentication → Providers, with your own Google Cloud OAuth client.
- **Phone OTP** (optional): configure an SMS provider (e.g. Twilio) in Supabase Dashboard → Authentication → Providers → Phone.
- **Paystack**: set `PAYSTACK_SECRET_KEY` / `NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY` to accept real donations; configure the webhook URL in your Paystack dashboard.
- **Transactional email**: the auth flows (verification, password reset) use Supabase's built-in email sending by default — for production volume, configure a custom SMTP provider in Supabase Dashboard → Authentication → SMTP Settings.
- **Push notifications** (optional): generate VAPID keys and set `NEXT_PUBLIC_VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` if you want to build out actual push delivery (the `notifications` table and in-app UI already exist; browser push delivery itself is left as a documented extension point).

See `docs/DEPLOYMENT_GUIDE.md` for the complete walkthrough.
