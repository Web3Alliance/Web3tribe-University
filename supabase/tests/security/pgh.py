import glob, json, os, re, uuid
import psycopg

# Paths are derived from this file's location (<repo>/supabase/tests/security/); the Postgres socket
# directory is set at runtime by run_all.py (pgh.HOST = ...).
HARNESS = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.abspath(os.path.join(HARNESS, "..", "..", ".."))
HOST = None

def admin_conn(dbname="postgres"):
    return psycopg.connect(host=HOST, dbname=dbname, user="postgres", autocommit=True)

def fresh_db(name):
    with admin_conn() as c:
        c.execute(f'drop database if exists "{name}" with (force)')
        c.execute(f'create database "{name}"')
    return name

def run_sql_file(dbname, path):
    sql = open(path, encoding="utf8").read()
    # test-only substitution: the embedded Postgres has no pg_trgm contrib module (search index only; no security impact)
    sql = sql.replace('create extension if not exists "pg_trgm";', '-- (pg_trgm skipped in local test DB)')
    sql = sql.replace("using gin (title gin_trgm_ops)", "(title)")
    with admin_conn(dbname) as c:
        c.execute(sql)

def apply_migrations(dbname, upto="0021"):
    """Apply shim + every migration numbered <= upto (e.g. '0021' = what you had before the audit fix)."""
    run_sql_file(dbname, f"{HARNESS}/shim.sql")
    files = sorted(glob.glob(f"{REPO}/supabase/migrations/*.sql"))
    files = [f for f in files if os.path.basename(f)[:4] <= upto]
    problems = []
    for f in files:
        try:
            run_sql_file(dbname, f)
        except Exception as e:
            problems.append((os.path.basename(f), str(e).strip().splitlines()[0]))
    return problems

class Session:
    """Runs one statement as a Supabase-style caller (anon / authenticated user / service_role / postgres)."""
    def __init__(self, dbname):
        self.dbname = dbname

    def run(self, sql, params=None, role="authenticated", uid=None, fetch=True, rollback=False):
        claims = {"role": role}
        if uid:
            claims["sub"] = str(uid)
        conn = psycopg.connect(host=HOST, dbname=self.dbname, user="postgres", autocommit=False)
        try:
            cur = conn.cursor()
            if role != "postgres":
                cur.execute(f"set local role {role}")
                cur.execute("select set_config('request.jwt.claims', %s, true)", (json.dumps(claims),))
            cur.execute(sql, params)
            rows = cur.fetchall() if (fetch and cur.description) else None
            rc = cur.rowcount
            if rollback:
                conn.rollback()
            else:
                conn.commit()
            return ("OK", rows if rows is not None else rc)
        except Exception as e:
            conn.rollback()
            msg = str(e).strip().splitlines()[0]
            return ("DENIED", msg)
        finally:
            conn.close()

def signup(dbname, email, meta=None, uid=None):
    """Simulates GoTrue creating an auth.users row (this fires the profile-provisioning trigger)."""
    uid = uid or uuid.uuid4()
    with admin_conn(dbname) as c:
        c.execute("insert into auth.users (id, email, raw_user_meta_data) values (%s,%s,%s)",
                  (uid, email, json.dumps(meta or {})))
    return uid
