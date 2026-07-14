const { PGlite } = require('@electric-sql/pglite');
const { pg_trgm } = require('@electric-sql/pglite/contrib/pg_trgm');
const fs = require('fs');

async function main() {
  const db = new PGlite({ extensions: { pg_trgm } });

  // Minimal stand-in for the parts of Supabase's `auth` schema our migration references.
  // Real Supabase projects already have this schema managed by GoTrue; we only need
  // enough of it here to validate that our own SQL is syntactically and referentially
  // correct.
  await db.exec(`
    create schema if not exists auth;
    create table if not exists auth.users (
      id uuid primary key default gen_random_uuid(),
      email text,
      raw_user_meta_data jsonb default '{}'::jsonb,
      created_at timestamptz default now()
    );
    create or replace function auth.uid() returns uuid language sql stable as $$
      select null::uuid;
    $$;
  `);
  console.log('Stubbed auth schema created.');

  const sql = fs.readFileSync(process.argv[2], 'utf8');

  try {
    await db.exec(sql);
    console.log('SUCCESS: schema executed without errors.');
  } catch (err) {
    console.error('SCHEMA EXECUTION FAILED:');
    console.error(err.message);
    process.exit(1);
  }

  // Sanity: confirm key tables and functions exist
  const tables = await db.query(`
    select table_name from information_schema.tables
    where table_schema = 'public' order by table_name;
  `);
  console.log(`\nPublic tables created: ${tables.rows.length}`);
  tables.rows.forEach(r => console.log(' -', r.table_name));

  const funcs = await db.query(`
    select routine_name from information_schema.routines
    where routine_schema = 'public' and routine_type = 'FUNCTION'
    order by routine_name;
  `);
  console.log(`\nPublic functions created: ${funcs.rows.length}`);
  funcs.rows.forEach(r => console.log(' -', r.routine_name));

  const policies = await db.query(`select count(*)::int as c from pg_policies where schemaname = 'public';`);
  console.log(`\nRLS policies created: ${policies.rows[0].c}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
