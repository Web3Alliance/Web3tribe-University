const { PGlite } = require('@electric-sql/pglite');
const fs = require('fs');

async function main() {
  const db = new PGlite();

  await db.exec(`
    create schema if not exists auth;
    create or replace function auth.uid() returns uuid language sql stable as $$ select null::uuid; $$;

    create schema if not exists storage;
    create table if not exists storage.buckets (
      id text primary key,
      name text not null,
      public boolean default false,
      file_size_limit bigint,
      allowed_mime_types text[],
      owner uuid,
      created_at timestamptz default now()
    );
    create table if not exists storage.objects (
      id uuid primary key default gen_random_uuid(),
      bucket_id text references storage.buckets(id),
      name text,
      owner uuid,
      created_at timestamptz default now()
    );
    alter table storage.objects enable row level security;
    create or replace function storage.foldername(name text) returns text[] language sql immutable as $$
      select string_to_array(name, '/');
    $$;
  `);
  console.log('Stubbed auth + storage schemas created.');

  const sql = fs.readFileSync(process.argv[2], 'utf8');
  try {
    await db.exec(sql);
    console.log('SUCCESS: storage migration executed without errors.');
  } catch (err) {
    console.error('STORAGE MIGRATION FAILED:', err.message);
    process.exit(1);
  }

  const buckets = await db.query('select id, public from storage.buckets order by id;');
  console.log('Buckets created:', buckets.rows);

  const policies = await db.query(`select count(*)::int as c from pg_policies where schemaname = 'storage';`);
  console.log('Storage policies created:', policies.rows[0].c);
}

main().catch((e) => { console.error(e); process.exit(1); });
