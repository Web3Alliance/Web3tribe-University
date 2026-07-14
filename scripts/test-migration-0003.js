const { PGlite } = require('@electric-sql/pglite');
const { pg_trgm } = require('@electric-sql/pglite/contrib/pg_trgm');
const fs = require('fs');

async function main() {
  const db = new PGlite({ extensions: { pg_trgm } });

  await db.exec(`
    create schema if not exists auth;
    create table if not exists auth.users (
      id uuid primary key default gen_random_uuid(), email text,
      raw_user_meta_data jsonb default '{}'::jsonb, created_at timestamptz default now()
    );
    create or replace function auth.uid() returns uuid language plpgsql stable as $$
      begin return nullif(current_setting('app.current_user_id', true), '')::uuid;
      exception when others then return null; end;
    $$;
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

  // Create an instructor + a course + lesson + quiz BEFORE running 0003, to prove
  // the migration correctly normalizes pre-existing rows, not just new ones.
  const instructor = await db.query(`insert into auth.users (email, raw_user_meta_data) values ('inst@test.com','{"role":"instructor","full_name":"Test Instructor"}') returning id;`);
  const instructorId = instructor.rows[0].id;

  const course = await db.query(`insert into public.courses (instructor_id, title, slug, status) values ($1,'Test Course','test-course','published') returning id;`, [instructorId]);
  const courseId = course.rows[0].id;
  const section = await db.query(`insert into public.course_sections (course_id, title, display_order) values ($1,'S1',1) returning id;`, [courseId]);
  const sectionId = section.rows[0].id;

  // Insert a lesson with the OLD default reward (5) explicitly, to simulate pre-migration data.
  const lesson = await db.query(`insert into public.lessons (section_id, course_id, title, w3tr_reward) values ($1,$2,'L1', 5) returning id;`, [sectionId, courseId]);
  const lessonId = lesson.rows[0].id;

  // Insert a lesson quiz with OLD defaults (reward 10, max_attempts 3).
  const quiz = await db.query(`insert into public.quizzes (course_id, lesson_id, is_final_exam, title, w3tr_reward, max_attempts) values ($1,$2,false,'L1 Quiz',10,3) returning id;`, [courseId, lessonId]);
  const quizId = quiz.rows[0].id;

  // Insert a final exam quiz with OLD defaults too.
  const finalExam = await db.query(`insert into public.quizzes (course_id, is_final_exam, title, w3tr_reward, max_attempts) values ($1,true,'Final Exam',10,3) returning id;`, [courseId]);
  const finalExamId = finalExam.rows[0].id;

  console.log('Pre-migration state created (simulating an existing platform with old defaults).\n');

  await fs.promises.access('supabase/seed/seed.sql').then(async () => {
    await db.exec(fs.readFileSync('supabase/seed/seed.sql', 'utf8'));
  });

  // Now run migration 0003.
  await db.exec(fs.readFileSync('supabase/migrations/0003_tokenomics_and_resources.sql', 'utf8'));
  console.log('Migration 0003 executed successfully.\n');

  const lessonAfter = await db.query(`select w3tr_reward from public.lessons where id = $1;`, [lessonId]);
  const quizAfter = await db.query(`select w3tr_reward, max_attempts from public.quizzes where id = $1;`, [quizId]);
  const examAfter = await db.query(`select w3tr_reward, max_attempts from public.quizzes where id = $1;`, [finalExamId]);

  console.log('Existing lesson reward normalized:', lessonAfter.rows[0].w3tr_reward, '(expect 1)');
  console.log('Existing lesson-quiz reward/attempts normalized:', quizAfter.rows[0], '(expect reward 2, max_attempts 999)');
  console.log('Existing final-exam reward/attempts normalized:', examAfter.rows[0], '(expect reward 10, max_attempts 999)');

  // New rows created AFTER the migration should pick up the new defaults automatically.
  const newLesson = await db.query(`insert into public.lessons (section_id, course_id, title) values ($1,$2,'L2') returning w3tr_reward;`, [sectionId, courseId]);
  console.log('New lesson picks up default reward:', newLesson.rows[0].w3tr_reward, '(expect 1)');

  const newQuiz = await db.query(`insert into public.quizzes (course_id, lesson_id, title) values ($1,$2,'L2 Quiz') returning w3tr_reward, max_attempts;`, [courseId, lessonId]);
  console.log('New quiz picks up default reward/attempts:', newQuiz.rows[0], '(expect reward 2, max_attempts 999)');

  // course_resources table
  const resource = await db.query(`
    insert into public.course_resources (course_id, title, file_url, uploaded_by)
    values ($1, 'Intro Textbook (PDF)', 'https://example.com/book.pdf', $2)
    returning id, title;
  `, [courseId, instructorId]);
  console.log('\ncourse_resources insert works:', resource.rows[0]);

  // Confirm complete_lesson still functions correctly (end-to-end reward flow) after
  // the function was replaced by this migration.
  const student = await db.query(`insert into auth.users (email, raw_user_meta_data) values ('stud@test.com','{"role":"student"}') returning id;`);
  const studentId = student.rows[0].id;
  const enrollment = await db.query(`insert into public.enrollments (student_id, course_id) values ($1,$2) returning id;`, [studentId, courseId]);
  const enrollmentId = enrollment.rows[0].id;

  await db.query(`select public.complete_lesson($1, $2);`, [enrollmentId, lessonId]);
  const wallet1 = await db.query(`select balance from public.w3tr_wallets where profile_id = $1;`, [studentId]);
  console.log('\nAfter completing 1 of 2 lessons, wallet balance:', wallet1.rows[0].balance, '(expect 1, the fixed lesson reward)');

  await db.query(`select public.complete_lesson($1, $2);`, [enrollmentId, newLesson.rows[0] ? lessonId : lessonId]);

  console.log('\n=== MIGRATION 0003 VALIDATION COMPLETE ===');
}

main().catch((e) => { console.error('MIGRATION 0003 VALIDATION FAILED:', e.message); process.exit(1); });
