# Database security regression tests

Replays the October 2026 BugBunny audit findings (plus the extra holes found in the follow-up
code review) against a **throw-away local PostgreSQL**, to prove that:

1. on migrations `0001`–`0021` the attacks **work** (so the replica is faithful), and
2. after `0022_security_hardening.sql` **every attack is blocked** *and* every legitimate user
   action (sign-up, profile edit, enrol via the server, instructor submit, admin role change,
   anonymous catalogue browsing, …) **still works**.

It never connects to your real Supabase project.

## Run it

```bash
pip install pgserver "psycopg[binary]"
python3 supabase/tests/security/run_all.py          # before + after
python3 supabase/tests/security/run_all.py --after  # regression check only
python3 supabase/tests/security/run_all.py -v       # list every individual check
```

Exit code is `0` only when nothing is exploitable and nothing legitimate is broken, so it can
run in CI. **Re-run it whenever you add a migration** — it is the safety net for the mistake
that caused this incident (new database functions/tables that were reachable from the browser).

## What is simulated

`shim.sql` recreates Supabase's roles (`anon`, `authenticated`, `service_role`), the `auth`
schema and `auth.uid()`, Supabase's default privileges, and a minimal `storage` schema.
The real Storage *service* (HTTP, public URLs) is **not** simulated — after applying a
migration to production, open a public avatar URL in a private window and upload one avatar
to confirm both still work.

Test-only substitution: the embedded Postgres has no `pg_trgm`, so that one extension line and
its search index are skipped in the local copy (no security impact).

## Adding a test

Add an `attack(...)` (must end up BLOCKED) or `legit(...)` (must keep WORKING) line to
`suite.py`. Each is a single SQL statement run as `anon`, a user, or `service_role`.
