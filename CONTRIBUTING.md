# Contributing to Web3tribe University

Thank you for helping. Web3tribe University is an open-source learning platform built to run in
community training centres, so contributions of code, documentation, translations and course
content are all welcome. By taking part you agree to follow our [Code of Conduct](CODE_OF_CONDUCT.md).

## Ways to contribute

- **Translations** — the interface is available in English, Hausa, Yorùbá and Igbo, but only the
  landing page, sign-in and navigation are translated so far (`messages/*.json`). Native-speaker
  review and new strings are very welcome.
- **Bug reports and fixes** — use the bug-report issue template.
- **Documentation** — setup, deployment and self-hosting guides.
- **Accessibility** — screen-reader, keyboard, captioning and low-bandwidth improvements.
- **Security findings** — please do **not** open a public issue; see [SECURITY.md](SECURITY.md).

## Before you start

1. Search existing issues. For anything bigger than a small fix, open an issue first so we can
   agree the approach before you spend time on it.
2. Check the [roadmap](ROADMAP.md) to see where the project is heading.

## Local setup

```bash
git clone https://github.com/Web3Alliance/Web3tribe-University.git
cd Web3tribe-University
npm ci
cp .env.example .env.local   # fill in a Supabase project's keys (see docs/ENV_SETUP.md)
npm run dev
```

You need your own Supabase project for the app itself (see `docs/DEPLOYMENT_GUIDE.md`). The unit
tests and the security tests below need no Supabase project.

## Checks your change must pass

```bash
npm run lint
npx tsc --noEmit
npm test
# if you touched supabase/migrations or any security policy:
pip install pgserver "psycopg[binary]"      # Python 3.12 recommended
python3 supabase/tests/security/run_all.py
```

The security test replays known attacks against a throw-away local Postgres and fails if any
becomes possible or any legitimate action stops working. **Every new migration must keep it green**
and should add attack/legitimate-use cases for what it changes (`supabase/tests/security/suite.py`).
GitHub Actions runs the same checks on every pull request.

## Database changes — the rules

Read `docs/DATABASE.md` first. In short: new tables need row-level security; new functions that
must not be called from the browser need `revoke execute … from public, anon, authenticated`;
anything that moves W3TR or grades work happens server-side with the service role, never from the
browser. Migrations are numbered, idempotent where possible, and never edited after being applied.

## Pull requests

- One focused change per pull request, with a clear description of *why*.
- Add or update tests. Update docs when behaviour changes.
- Don't commit secrets, `.env*` files, build output or generated patches.
- Be patient and kind in review; maintainers are a small team.

## Licence

Contributions are accepted under the project's [MIT licence](LICENSE).
