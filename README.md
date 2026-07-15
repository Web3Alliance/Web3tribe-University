# Web3tribe University

**Learn. Build. Earn.**

A national learn-and-earn digital skills platform built with Next.js and Supabase, developed by **Web3.0 Alliance Ltd**. Students earn **W3TR** (an in-app reward asset — not a cryptocurrency) by learning and passing lesson quizzes; instructors earn W3TR for approved, published courses.

## Why this exists

Web3tribe University is the digital infrastructure being built to replicate and scale, nationally, a delivery model already proven on the ground by our **Digital Inclusion Project** — an initiative bridging emerging technologies and local communities through partnerships with government institutions.

That project's pilot was a physical **Innovation Lab** set up at **Plateau State Polytechnic**, equipped with the tools needed to deliver hands-on digital-skills training. It grew to **600+ beneficiaries**, and the partnerships it generated — including a **₦24,000,000 World Bank grant** to train 80 people in Computer Hardware & Cellphone Repairs — proved both the demand for this kind of training and the institutional trust the model can earn. That evidence is what prompted us to build this platform: a way to digitize and replicate that same model across all 36 states of Nigeria.

This repository is being submitted to the **NextGen Innovation Challenge 2026** (National Board for Technology Incubation, Nigeria, in partnership with UKALD).

> **On blockchain:** This platform intentionally contains **no blockchain, wallet, smart contract, or cryptocurrency integration**. W3TR is implemented as a conventional relational ledger (see `supabase/migrations/0001_schema.sql`, tables `w3tr_wallets` / `w3tr_transactions`). The architecture is deliberately modular (`lib/reward-engine.ts`) so that an on-chain representation could be added later, behind the `blockchain_adapter_enabled` feature flag, without changing any application code — but nothing on-chain exists today.

---

## Tech stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 16 (App Router, Turbopack), React 19, TypeScript |
| Styling | Tailwind CSS v4, shadcn/ui-style components (hand-built on Radix primitives), Framer Motion |
| Backend | Supabase (PostgreSQL, Auth, Storage, Realtime, Row Level Security) |
| Certificates | Server-generated PDF via `pdf-lib` + QR verification via `qrcode` |
| Payments | Paystack (donations); Flutterwave scaffolded behind a feature flag |
| Testing | Vitest (unit), Playwright (E2E), plus in-memory Postgres (PGlite) migration/RLS validation |
| Deployment | Netlify (`@netlify/plugin-nextjs`) + Supabase |

---

## What's actually in the platform

- **Auth & roles** — email/password, Google OAuth, 6 roles (student, instructor, organization, moderator, admin, super_admin), full RBAC enforced at both the application and database (RLS) layers.
- **Course authoring & moderation** — instructors build courses with sections, lessons, and real file uploads (video/PDF/image/audio/download) via Supabase Storage; every course goes through an admin approval pipeline before publishing.
- **Fixed-tokenomics reward engine** — W3TR rewards are platform-wide fixed amounts (not instructor-configurable): 1 W3TR per lesson, 2 for a lesson quiz pass, 10 for a final exam, 20 for course completion. See `lib/tokenomics.ts`.
- **Quiz-gated lesson completion** — every lesson requires an attached quiz (enforced at course-submission time); a lesson is only marked complete once its quiz is passed, with unlimited retakes.
- **Verified digital certificates** — real PDF generation with an embedded QR code linking to a public `/verify/[code]` page, issued once a course reaches 100%.
- **Course discussion / chat** — students ask questions, instructors and peers reply, with like/dislike voting and automatic moderation: a post is auto-deleted the moment it reaches 5 dislikes (logged to `audit_logs`), with Supabase Realtime so new posts/replies appear live. Chat participation earns no W3TR by design.
- **Donations** — Paystack-integrated, with a webhook-confirmed donation pipeline and campaign progress tracking.
- **Admin & Super Admin panels** — user management, course moderation, manual reward grants, categories, announcements, audit logs, feature flags, maintenance mode.

---

## Project structure
---

## Getting started

```bash
npm install
cp .env.example .env.local   # then fill in your Supabase project's keys
npm run dev
```

See **`docs/ENV_SETUP.md`** for exactly which environment variables are required vs. optional, and **`docs/DEPLOYMENT_GUIDE.md`** for the full Supabase + Netlify deployment walkthrough.

### Setting up the database

The simplest path is the single consolidated file (`Web3tribe_University_Complete_Database.sql`, distributed separately) — paste it into the Supabase SQL Editor and run it once. It's split into 5 sections, each committing independently, and every statement is idempotent (safe to re-run).

To apply the migrations one at a time instead:

1. Create a new Supabase project.
2. In the SQL Editor, run in order: `0001_schema.sql` → `0002_storage.sql` → `0003_tokenomics_and_resources.sql` → `0004_discussion_chat.sql`.
3. Optionally run `supabase/seed/seed.sql` for categories, default reward rules, feature flags, and a sample donation campaign.
4. Register an instructor account through `/register`, then re-run the sample-course block at the bottom of `seed.sql` if you want a populated example course (see the comment in that file — it explains why this can't be fully automated, since `auth.users` is managed by Supabase Auth, not plain SQL).
5. Promote your own account to `super_admin` for full access:
```sql
   update public.profiles set role = 'super_admin' where email = 'you@example.com';
```

### Running the test suites

```bash
npm run test                # unit tests (Vitest) — no external services required
npm run db:test-schema      # validates the full SQL schema against an in-memory Postgres
npm run db:test-functional  # exercises the reward engine, idempotency, rating triggers
npm run db:test-rls         # exercises RLS policies with simulated Supabase roles
npm run db:test-storage     # validates the storage buckets/policies migration
npm run db:test-seed        # validates the seed script (with and without an instructor present)
node scripts/test-migration-0003.js   # tokenomics/resources migration validation
node scripts/test-migration-0004.js   # discussion/chat migration validation (incl. the
                                       # 5-dislike auto-delete trigger)
npm run test:e2e            # Playwright E2E — requires a running dev server + real Supabase project
```

The `db:test-*` and `test-migration-*` scripts are a distinctive part of this project: they spin up a real, in-memory PostgreSQL engine (via `@electric-sql/pglite`) with a minimal stub of Supabase's `auth` and `storage` schemas, then run the actual migration SQL against it and assert on real query results — not just "does it parse." This is how the reward engine's idempotency behavior, RLS enforcement, rating triggers, and the chat auto-moderation trigger were verified during development, and you can re-run them at any time to confirm the schema still behaves correctly after you modify it.

---

## Key design decisions

- **No blockchain today, but the seam is real.** `lib/reward-engine.ts` defines a `RewardEngine` interface with one implementation (`LedgerRewardEngine`, backed by Postgres RPC functions). Every place in the app that awards or spends W3TR calls this interface, not Supabase directly. A future `OnChainRewardEngine` could implement the same interface.
- **Fixed tokenomics, not instructor-configurable.** Reward amounts are defined once in `lib/tokenomics.ts` and enforced at the database level, so the W3TR economy can't be inflated by individual instructors setting arbitrary rewards on their own content.
- **RLS is the real security boundary**, not just application-layer role checks. Every table has row-level security policies; `lib/rbac.ts` provides ergonomic helpers for the application layer, but the database itself refuses cross-user access even if application code has a bug.
- **Server Actions + Route Handlers side by side.** Most interactive UI uses Next.js Server Actions for simplicity. A parallel REST API surface exists under `app/api/*` for anything a future mobile app or third-party integration would need.
- **Certificates are real PDFs, not placeholders.** `lib/certificate.ts` generates an actual landscape A4 PDF with an embedded QR code linking to a public `/verify/[code]` page, uploaded to Supabase Storage.
- **Chat moderation is automatic and audited.** The 5-dislike auto-delete rule runs as a database trigger (not application code), and every auto-deletion is logged to `audit_logs` with the reason and a snippet of the removed content, so admins retain accountability without manual moderation overhead.

---

## What you need to configure before going live

This project is code-complete and builds cleanly, but a few things require your own credentials/setup before real users can use it in production:

- **Supabase project**: run the migrations, get your project URL / anon key / service role key.
- **Google OAuth** (optional): enable the Google provider in Supabase Dashboard → Authentication → Providers, with your own Google Cloud OAuth client.
- **Phone OTP** (optional): configure an SMS provider (e.g. Twilio) in Supabase Dashboard → Authentication → Providers → Phone.
- **Paystack**: set `PAYSTACK_SECRET_KEY` / `NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY` to accept real donations; configure the webhook URL in your Paystack dashboard.
- **Transactional email**: the auth flows (verification, password reset) use Supabase's built-in email sending by default — for production volume, configure a custom SMTP provider in Supabase Dashboard → Authentication → SMTP Settings.
- **Push notifications** (optional): generate VAPID keys and set `NEXT_PUBLIC_VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` if you want to build out actual push delivery (the `notifications` table and in-app UI already exist; browser push delivery itself is left as a documented extension point).
- **Supabase Realtime**: confirm `discussion_threads` and `discussion_replies` show as enabled under Database → Replication (migration 0004 attempts to enable this automatically, but it's worth a visual check).

See `docs/DEPLOYMENT_GUIDE.md` for the complete walkthrough.

---

## About Web3.0 Alliance Ltd

Web3.0 Alliance Ltd (RC: 7919874) is a multidisciplinary technology company based in Jos, Plateau State, Nigeria, working across custom software development, IT training, renewable energy, and construction/supply chain. Web3tribe University is our flagship digital-skills initiative, built on the ground evidence of our Digital Inclusion Project.

- Platform: [tribe.theweb3alliance.org](https://tribe.theweb3alliance.org)
- Website: [theweb3alliance.org](https://theweb3alliance.org)