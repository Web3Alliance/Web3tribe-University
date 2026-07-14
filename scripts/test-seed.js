const { PGlite } = require('@electric-sql/pglite');
const { pg_trgm } = require('@electric-sql/pglite/contrib/pg_trgm');
const fs = require('fs');

async function run(withInstructor) {
  const db = new PGlite({ extensions: { pg_trgm } });

  await db.exec(`
    create schema if not exists auth;
    create table if not exists auth.users (
      id uuid primary key default gen_random_uuid(),
      email text,
      raw_user_meta_data jsonb default '{}'::jsonb,
      created_at timestamptz default now()
    );
    create or replace function auth.uid() returns uuid language sql stable as $$ select null::uuid; $$;

    create schema if not exists storage;
    create table if not exists storage.buckets (
      id text primary key, name text not null, public boolean default false,
      file_size_limit bigint, allowed_mime_types text[], owner uuid, created_at timestamptz default now()
    );
    create table if not exists storage.objects (
      id uuid primary key default gen_random_uuid(), bucket_id text references storage.buckets(id),
      name text, owner uuid, created_at timestamptz default now()
    );
    alter table storage.objects enable row level security;
    create or replace function storage.foldername(name text) returns text[] language sql immutable as $$
      select string_to_array(name, '/');
    $$;
  `);

  await db.exec(fs.readFileSync('supabase/migrations/0001_schema.sql', 'utf8'));
  await db.exec(fs.readFileSync('supabase/migrations/0002_storage.sql', 'utf8'));

  if (withInstructor) {
    await db.query(`insert into auth.users (email, raw_user_meta_data) values ('instructor@test.com','{"role":"instructor","full_name":"Test Instructor"}');`);
  }

  await db.exec(fs.readFileSync('supabase/seed/seed.sql', 'utf8'));

  const categories = await db.query('select count(*)::int as c from public.categories;');
  const rules = await db.query('select count(*)::int as c from public.reward_rules;');
  const flags = await db.query('select count(*)::int as c from public.feature_flags;');
  const campaigns = await db.query('select count(*)::int as c from public.donation_campaigns;');
  const courses = await db.query('select count(*)::int as c from public.courses;');
  const lessons = await db.query('select count(*)::int as c from public.lessons;');

  console.log(`\n[withInstructor=${withInstructor}]`);
  console.log('  categories:', categories.rows[0].c, '(expect 18)');
  console.log('  reward_rules:', rules.rows[0].c, '(expect 9)');
  console.log('  feature_flags:', flags.rows[0].c, '(expect 3)');
  console.log('  donation_campaigns:', campaigns.rows[0].c, '(expect 1)');
  console.log('  courses:', courses.rows[0].c, withInstructor ? '(expect 1)' : '(expect 0)');
  console.log('  lessons:', lessons.rows[0].c, withInstructor ? '(expect 3)' : '(expect 0)');
}

async function main() {
  await run(false);
  await run(true);
  console.log('\n=== SEED SCRIPT VALIDATION COMPLETE ===');
}

main().catch((e) => { console.error('SEED VALIDATION FAILED:', e); process.exit(1); });
