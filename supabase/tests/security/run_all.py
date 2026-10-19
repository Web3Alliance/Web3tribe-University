#!/usr/bin/env python3
"""
Replays the BugBunny audit findings (and the extra holes found in the code review) against a
throw-away local PostgreSQL, twice:

  BEFORE = your migrations 0001-0021          -> attacks are expected to WORK (proves the replica is faithful)
  AFTER  = 0001-0022 (0022 is also run twice  -> every attack must be BLOCKED and every legitimate
           to prove it is idempotent)            action must still WORK

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

FIX = os.path.join(pgh.REPO, "supabase", "migrations", "0022_security_hardening.sql")


def main():
    verbose = "-v" in sys.argv
    after_only = "--after" in sys.argv
    tmp = tempfile.mkdtemp(prefix="w3t-pg-")
    server = pgserver.get_server(tmp)                      # stopped & cleaned automatically on exit
    uri = server.get_uri()
    pgh.HOST = urllib.parse.parse_qs(urllib.parse.urlparse(uri).query)["host"][0]

    plan = [("w3t_after", True, "after")] if after_only else [("w3t_before", False, "before"), ("w3t_after", True, "after")]
    summary = {}
    for db, with_fix, phase in plan:
        pgh.fresh_db(db)
        problems = pgh.apply_migrations(db, with_fix=with_fix)
        if problems:
            print("MIGRATION PROBLEMS:", problems)
            return 2
        if with_fix:
            pgh.run_sql_file(db, FIX)                      # second run of 0022: must be a no-op, not an error
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
