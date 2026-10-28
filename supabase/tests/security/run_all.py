#!/usr/bin/env python3
"""
Replays the BugBunny audit findings (plus the extra holes found in the code review, and the
"edits to a live course must go back to review" rule) against a throw-away local PostgreSQL in
three states:

  BEFORE      = migrations 0001-0021 (before the audit fix) -> attacks are expected to WORK
                                                               (proves the replica is faithful)
  AFTER 0022  = + the audit fix                             -> informational (what was live first)
  AFTER       = everything (0001-latest)                    -> every attack must be BLOCKED and every
                legitimate action must still WORK. Migrations 0022 and 0023 are also run a second
                time on this database to prove they are idempotent.

Exit code 0 only if AFTER has no exploitable attack and no broken legitimate check.
Nothing here touches your real Supabase project: it runs on an embedded, temporary Postgres.

  pip install pgserver "psycopg[binary]"
  python3 supabase/tests/security/run_all.py            # full before/after
  python3 supabase/tests/security/run_all.py --after    # regression check only (faster)
  add -v to list every individual check
"""
import json, os, sys, tempfile, urllib.parse

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import pgserver
import pgh, suite

LATEST = "0023"
RERUN = ["0022_security_hardening.sql", "0023_enforce_review_on_edit.sql"]   # run twice on the final database


def main():
    verbose = "-v" in sys.argv
    after_only = "--after" in sys.argv
    tmp = tempfile.mkdtemp(prefix="w3t-pg-")
    server = pgserver.get_server(tmp)                      # stopped & cleaned automatically on exit
    uri = server.get_uri()
    pgh.HOST = urllib.parse.parse_qs(urllib.parse.urlparse(uri).query)["host"][0]

    plan = [("w3t_after", LATEST, "after")] if after_only else [
        ("w3t_before", "0021", "before"),
        ("w3t_0022", "0022", "after 0022"),
        ("w3t_after", LATEST, "after"),
    ]
    summary = {}
    for db, upto, phase in plan:
        pgh.fresh_db(db)
        problems = pgh.apply_migrations(db, upto=upto)
        if problems:
            print("MIGRATION PROBLEMS:", problems)
            return 2
        if phase == "after":
            for name in RERUN:                              # second run of each fix: must be a no-op, not an error
                try:
                    pgh.run_sql_file(db, os.path.join(pgh.REPO, "supabase", "migrations", name))
                except Exception as e:
                    print(f"{name} FAILED when run a second time (not idempotent): {e}")
                    return 2
        R = suite.run_suite(db)
        exploitable, broken = suite.report(R, phase)
        summary[phase] = (len(exploitable), len(broken))
        if verbose or phase == "after":
            for r in R:
                if (phase == "after" and r[3] in ("EXPLOITABLE", "BROKEN")) or verbose:
                    flag = {"EXPLOITABLE": "EXPLOITABLE", "BLOCKED": "blocked    ", "WORKS": "works      ", "BROKEN": "BROKEN     "}[r[3]]
                    print(f"  [{flag}] {r[0]:<30} {r[2]}")
    ok = summary["after"] == (0, 0)
    print("\nRESULT:", "PASS — all attacks blocked, all legitimate actions still work" if ok else "FAIL — see lines above")
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main())
