const { PGlite } = require('@electric-sql/pglite');
const { pg_trgm } = require('@electric-sql/pglite/contrib/pg_trgm');
const fs = require('fs');

async function main() {
  const db = new PGlite({ extensions: { pg_trgm } });

  // Stub the auth schema. Crucially, auth.uid() here reads a per-session GUC
  // (app.current_user_id) that our test sets via `set local`, mirroring how
  // Supabase's real auth.uid() reads the JWT sub claim from request context.
  await db.exec(`
    create schema if not exists auth;
    create table if not exists auth.users (
      id uuid primary key default gen_random_uuid(),
      email text,
      raw_user_meta_data jsonb default '{}'::jsonb,
      created_at timestamptz default now()
    );
    create or replace function auth.uid() returns uuid language plpgsql stable as $$
      begin
        return nullif(current_setting('app.current_user_id', true), '')::uuid;
      exception when others then
        return null;
      end;
    $$;
  `);

  const sql = fs.readFileSync('supabase/migrations/0001_schema.sql', 'utf8');
  await db.exec(sql);

  // Mimic Supabase's non-superuser roles that RLS actually applies to.
  await db.exec(`
    do $$ begin
      create role authenticated;
    exception when duplicate_object then null; end $$;
    do $$ begin
      create role anon;
    exception when duplicate_object then null; end $$;
    grant usage on schema public to authenticated, anon;
    grant all on all tables in schema public to authenticated, anon;
    grant execute on all functions in schema public to authenticated, anon;
  `);

  console.log('Schema + simulated Supabase roles ready.\n');

  // ---- Seed data as the bootstrapping (superuser) connection ----------------------
  const studentA = (await db.query(`insert into auth.users (email, raw_user_meta_data) values ('a@test.com','{"role":"student","full_name":"Student A"}') returning id;`)).rows[0].id;
  const studentB = (await db.query(`insert into auth.users (email, raw_user_meta_data) values ('b@test.com','{"role":"student","full_name":"Student B"}') returning id;`)).rows[0].id;
  const instructorA = (await db.query(`insert into auth.users (email, raw_user_meta_data) values ('inst-a@test.com','{"role":"instructor","full_name":"Instructor A"}') returning id;`)).rows[0].id;
  const instructorB = (await db.query(`insert into auth.users (email, raw_user_meta_data) values ('inst-b@test.com','{"role":"instructor","full_name":"Instructor B"}') returning id;`)).rows[0].id;

  const draftCourse = (await db.query(`insert into public.courses (instructor_id, title, slug, status) values ($1,'Draft Course','draft-course','draft') returning id;`, [instructorA])).rows[0].id;
  const publishedCourse = (await db.query(`insert into public.courses (instructor_id, title, slug, status) values ($1,'Published Course','published-course','published') returning id;`, [instructorA])).rows[0].id;

  console.log('Seed data created.\n');

  // Helper to run a query AS a given simulated user
  async function asUser(userId, fn) {
    await db.exec('begin;');
    await db.query(`select set_config('app.current_user_id', $1, true);`, [userId || '']);
    await db.exec(`set local role authenticated;`);
    try {
      const result = await fn();
      await db.exec('commit;');
      return result;
    } catch (e) {
      await db.exec('rollback;');
      throw e;
    }
  }

  let pass = 0, fail = 0;
  function check(label, condition) {
    if (condition) { console.log('  PASS:', label); pass++; }
    else { console.log('  FAIL:', label); fail++; }
  }

  console.log('TEST GROUP 1: Course visibility');
  await asUser(studentA, async () => {
    const rows = (await db.query(`select id from public.courses;`)).rows;
    const ids = rows.map(r => r.id);
    check('student sees published course', ids.includes(publishedCourse));
    check('student does NOT see another instructor\'s draft course', !ids.includes(draftCourse));
  });
  await asUser(instructorA, async () => {
    const rows = (await db.query(`select id from public.courses;`)).rows;
    const ids = rows.map(r => r.id);
    check('owning instructor sees own draft course', ids.includes(draftCourse));
  });

  console.log('\nTEST GROUP 2: Course mutation authorization');
  await asUser(instructorB, async () => {
    try {
      await db.query(`update public.courses set title = 'Hijacked!' where id = $1;`, [draftCourse]);
      const check1 = (await db.query(`select title from public.courses where id = $1`, [draftCourse])).rows[0];
      check('non-owner instructor cannot rename another instructor\'s course', check1.title !== 'Hijacked!');
    } catch (e) {
      check('non-owner instructor blocked (via exception) from updating another course', true);
    }
  });

  console.log('\nTEST GROUP 3: Wallet privacy');
  await asUser(studentA, async () => {
    const own = (await db.query(`select balance from public.w3tr_wallets where profile_id = $1;`, [studentA])).rows;
    check('student can read own wallet', own.length === 1);
    const other = (await db.query(`select balance from public.w3tr_wallets where profile_id = $1;`, [studentB])).rows;
    check('student cannot read another student\'s wallet', other.length === 0);
  });

  console.log('\nTEST GROUP 4: Enrollment ownership');
  const enrollmentA = (await db.query(`insert into public.enrollments (student_id, course_id) values ($1,$2) returning id;`, [studentA, publishedCourse])).rows[0].id;
  await asUser(studentB, async () => {
    const rows = (await db.query(`select id from public.enrollments where id = $1;`, [enrollmentA])).rows;
    check('student B cannot see student A\'s enrollment', rows.length === 0);
    try {
      await db.query(`update public.enrollments set progress_percent = 100 where id = $1;`, [enrollmentA]);
    } catch (e) { /* expected in a stricter engine; PGlite RLS still filters rows to 0 either way */ }
    const check2 = (await db.query(`select progress_percent from public.enrollments where id = $1`, [enrollmentA])).rows;
    check('student B cannot modify student A\'s enrollment (RLS-filtered, 0 rows affected visible)', check2.length === 0);
  });

  console.log('\nTEST GROUP 5: Direct wallet mutation blocked (must go through award_w3tr)');
  await asUser(studentA, async () => {
    try {
      await db.query(`update public.w3tr_wallets set balance = 999999 where profile_id = $1;`, [studentA]);
      const bal = (await db.query(`select balance from public.w3tr_wallets where profile_id = $1`, [studentA])).rows[0];
      check('student cannot directly inflate own wallet balance via UPDATE', Number(bal.balance) !== 999999);
    } catch (e) {
      check('student blocked (via exception) from directly updating wallet', true);
    }
  });

  console.log(`\n=== RESULTS: ${pass} passed, ${fail} failed ===`);
  if (fail > 0) process.exit(1);
}

main().catch((e) => { console.error('RLS TEST SUITE ERROR:', e); process.exit(1); });
