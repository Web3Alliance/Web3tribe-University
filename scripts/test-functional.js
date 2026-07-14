const { PGlite } = require('@electric-sql/pglite');
const { pg_trgm } = require('@electric-sql/pglite/contrib/pg_trgm');
const fs = require('fs');

async function main() {
  const db = new PGlite({ extensions: { pg_trgm } });

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

  const sql = fs.readFileSync('supabase/migrations/0001_schema.sql', 'utf8');
  await db.exec(sql);
  console.log('Schema applied.\n');

  // ---- Create a student and instructor via the auth.users trigger path -----------
  const student = await db.query(`
    insert into auth.users (email, raw_user_meta_data) values ('student@test.com', '{"role":"student","full_name":"Ada Student"}')
    returning id;
  `);
  const studentId = student.rows[0].id;

  const instructor = await db.query(`
    insert into auth.users (email, raw_user_meta_data) values ('instructor@test.com', '{"role":"instructor","full_name":"Chinedu Instructor"}')
    returning id;
  `);
  const instructorId = instructor.rows[0].id;

  console.log('Created student:', studentId);
  console.log('Created instructor:', instructorId);

  // Check profile + wallet auto-provisioned
  const profile = await db.query(`select role, full_name from public.profiles where id = $1`, [studentId]);
  console.log('\nStudent profile auto-created:', profile.rows[0]);

  const wallet = await db.query(`select balance from public.w3tr_wallets where profile_id = $1`, [studentId]);
  console.log('Student wallet auto-created, balance:', wallet.rows[0].balance);

  // ---- Instructor creates a course with sections and lessons ----------------------
  const cat = await db.query(`insert into public.categories (name, slug) values ('Artificial Intelligence','ai') returning id;`);
  const categoryId = cat.rows[0].id;

  const course = await db.query(`
    insert into public.courses (instructor_id, category_id, title, slug, status)
    values ($1, $2, 'Intro to AI', 'intro-to-ai', 'published') returning id;
  `, [instructorId, categoryId]);
  const courseId = course.rows[0].id;

  const section = await db.query(`
    insert into public.course_sections (course_id, title, display_order) values ($1, 'Getting Started', 1) returning id;
  `, [courseId]);
  const sectionId = section.rows[0].id;

  const lesson1 = await db.query(`
    insert into public.lessons (section_id, course_id, title, content_type, display_order, w3tr_reward)
    values ($1, $2, 'What is AI?', 'video', 1, 5) returning id;
  `, [sectionId, courseId]);
  const lesson1Id = lesson1.rows[0].id;

  const lesson2 = await db.query(`
    insert into public.lessons (section_id, course_id, title, content_type, display_order, w3tr_reward)
    values ($1, $2, 'History of AI', 'video', 2, 5) returning id;
  `, [sectionId, courseId]);
  const lesson2Id = lesson2.rows[0].id;

  console.log('\nCourse created with 2 lessons.');

  // ---- Student enrolls ------------------------------------------------------------
  const enrollment = await db.query(`
    insert into public.enrollments (student_id, course_id) values ($1, $2) returning id;
  `, [studentId, courseId]);
  const enrollmentId = enrollment.rows[0].id;
  console.log('Student enrolled:', enrollmentId);

  // ---- Complete lesson 1 via complete_lesson() RPC --------------------------------
  await db.query(`select public.complete_lesson($1, $2);`, [enrollmentId, lesson1Id]);
  let walletAfter1 = await db.query(`select balance from public.w3tr_wallets where profile_id = $1`, [studentId]);
  let enrollAfter1 = await db.query(`select progress_percent, status from public.enrollments where id = $1`, [enrollmentId]);
  console.log('\nAfter completing lesson 1:');
  console.log('  Wallet balance:', walletAfter1.rows[0].balance, '(expect 5)');
  console.log('  Enrollment progress:', enrollAfter1.rows[0].progress_percent, '% status:', enrollAfter1.rows[0].status, '(expect 50%, active)');

  // ---- Complete lesson 2 -> should trigger course completion + 50 bonus ----------
  await db.query(`select public.complete_lesson($1, $2);`, [enrollmentId, lesson2Id]);
  let walletAfter2 = await db.query(`select balance, lifetime_earned from public.w3tr_wallets where profile_id = $1`, [studentId]);
  let enrollAfter2 = await db.query(`select progress_percent, status from public.enrollments where id = $1`, [enrollmentId]);
  console.log('\nAfter completing lesson 2 (course complete):');
  console.log('  Wallet balance:', walletAfter2.rows[0].balance, '(expect 5+5+50=60)');
  console.log('  Lifetime earned:', walletAfter2.rows[0].lifetime_earned);
  console.log('  Enrollment progress:', enrollAfter2.rows[0].progress_percent, '% status:', enrollAfter2.rows[0].status, '(expect 100%, completed)');

  // ---- Idempotency check: completing lesson 1 again should NOT double-award -----
  await db.query(`select public.complete_lesson($1, $2);`, [enrollmentId, lesson1Id]);
  let walletAfter3 = await db.query(`select balance from public.w3tr_wallets where profile_id = $1`, [studentId]);
  console.log('\nAfter re-completing lesson 1 (idempotency check):');
  console.log('  Wallet balance:', walletAfter3.rows[0].balance, '(expect still 60, no double award)');

  // ---- Ledger check ----------------------------------------------------------------
  const txs = await db.query(`select type, amount, description from public.w3tr_transactions where profile_id = $1 order by created_at`, [studentId]);
  console.log('\nFull W3TR transaction ledger for student:');
  txs.rows.forEach(r => console.log('  ', r.type, r.amount, '-', r.description));

  // ---- Negative balance protection test --------------------------------------------
  console.log('\nTesting negative-balance protection (should throw):');
  try {
    await db.query(`select public.spend_w3tr($1, 99999, 'test', null, 'overspend attempt');`, [studentId]);
    console.log('  FAIL: overspend was not blocked!');
  } catch (e) {
    console.log('  PASS: overspend correctly rejected ->', e.message.split('\n')[0]);
  }

  // ---- Course rating trigger test ---------------------------------------------------
  await db.query(`insert into public.course_reviews (course_id, student_id, rating, review_text) values ($1, $2, 5, 'Great course!');`, [courseId, studentId]);
  const ratingCheck = await db.query(`select average_rating, rating_count from public.courses where id = $1`, [courseId]);
  console.log('\nCourse rating after review insert:', ratingCheck.rows[0], '(expect 5.00, count 1)');

  // ---- Daily login streak test -------------------------------------------------------
  const login1 = await db.query(`select * from public.record_daily_login($1);`, [studentId]);
  console.log('\nFirst daily login:', login1.rows[0].streak_day, 'W3TR:', login1.rows[0].w3tr_awarded);

  console.log('\n=== ALL FUNCTIONAL TESTS COMPLETED ===');
}

main().catch((e) => { console.error('TEST SUITE ERROR:', e); process.exit(1); });
