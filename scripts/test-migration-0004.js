const { PGlite } = require('@electric-sql/pglite');
const { pg_trgm } = require('@electric-sql/pglite/contrib/pg_trgm');

async function main() {
  const db = new PGlite({ extensions: { pg_trgm } });

  await db.exec(`
    create schema if not exists auth;
    create table if not exists auth.users (id uuid primary key default gen_random_uuid(), email text, raw_user_meta_data jsonb default '{}'::jsonb, created_at timestamptz default now());
    create or replace function auth.uid() returns uuid language plpgsql stable as $$
      begin return nullif(current_setting('app.current_user_id', true), '')::uuid;
      exception when others then return null; end;
    $$;
    create schema if not exists storage;
    create table if not exists storage.buckets (id text primary key, name text not null, public boolean default false, file_size_limit bigint, allowed_mime_types text[], owner uuid, created_at timestamptz default now());
    create table if not exists storage.objects (id uuid primary key default gen_random_uuid(), bucket_id text references storage.buckets(id), name text, owner uuid, created_at timestamptz default now());
    alter table storage.objects enable row level security;
    create or replace function storage.foldername(name text) returns text[] language sql immutable as $$ select string_to_array(name, '/'); $$;
  `);

  const fs = require('fs');
  await db.exec(fs.readFileSync('supabase/migrations/0001_schema.sql', 'utf8'));
  await db.exec(fs.readFileSync('supabase/migrations/0002_storage.sql', 'utf8'));
  await db.exec(fs.readFileSync('supabase/migrations/0003_tokenomics_and_resources.sql', 'utf8'));
  console.log('0001+0002+0003 applied.');

  await db.exec(fs.readFileSync('supabase/migrations/0004_discussion_chat.sql', 'utf8'));
  console.log('0004 applied successfully.');

  // Idempotency check
  await db.exec(fs.readFileSync('supabase/migrations/0004_discussion_chat.sql', 'utf8'));
  console.log('0004 re-run (idempotency check) succeeded.\n');

  // ---- Functional test: create a course, students, thread, replies, reactions ----
  await db.exec(`
    do $$ begin create role authenticated; exception when duplicate_object then null; end $$;
    grant usage on schema public to authenticated;
    grant all on all tables in schema public to authenticated;
    grant execute on all functions in schema public to authenticated;
  `);

  const instructorId = (await db.query(`insert into auth.users (email, raw_user_meta_data) values ('inst@test.com','{"role":"instructor","full_name":"Instructor"}') returning id;`)).rows[0].id;
  const studentAId = (await db.query(`insert into auth.users (email, raw_user_meta_data) values ('a@test.com','{"role":"student","full_name":"Student A"}') returning id;`)).rows[0].id;
  const studentBId = (await db.query(`insert into auth.users (email, raw_user_meta_data) values ('b@test.com','{"role":"student","full_name":"Student B"}') returning id;`)).rows[0].id;

  const courseId = (await db.query(`insert into public.courses (instructor_id, title, slug, status) values ($1,'Test Course','test-course','published') returning id;`, [instructorId])).rows[0].id;
  await db.query(`insert into public.enrollments (student_id, course_id) values ($1,$2);`, [studentAId, courseId]);
  await db.query(`insert into public.enrollments (student_id, course_id) values ($1,$2);`, [studentBId, courseId]);

  async function asUser(userId, fn) {
    await db.exec('begin;');
    await db.query(`select set_config('app.current_user_id', $1, true);`, [userId]);
    await db.exec('set local role authenticated;');
    try { const r = await fn(); await db.exec('commit;'); return r; }
    catch (e) { await db.exec('rollback;'); throw e; }
  }

  let pass = 0, fail = 0;
  function check(label, cond) { if (cond) { console.log('  PASS:', label); pass++; } else { console.log('  FAIL:', label); fail++; } }

  // Student A posts a question
  const thread = await asUser(studentAId, async () => {
    return (await db.query(
      `insert into public.discussion_threads (course_id, author_id, title, body) values ($1,$2,'Question','How does this work?') returning id;`,
      [courseId, studentAId]
    )).rows[0];
  });
  check('student can post a thread in an enrolled course', !!thread);

  // Instructor replies
  const reply = await asUser(instructorId, async () => {
    return (await db.query(
      `insert into public.discussion_replies (thread_id, author_id, body, is_instructor_reply) values ($1,$2,'Here is the answer', true) returning id;`,
      [thread.id, instructorId]
    )).rows[0];
  });
  check('instructor can reply', !!reply);

  // Non-enrolled outsider tries to reply -> should be blocked by RLS
  const outsiderId = (await db.query(`insert into auth.users (email, raw_user_meta_data) values ('out@test.com','{"role":"student","full_name":"Outsider"}') returning id;`)).rows[0].id;
  let outsiderBlocked = false;
  try {
    await asUser(outsiderId, async () => {
      await db.query(`insert into public.discussion_replies (thread_id, author_id, body) values ($1,$2,'sneaky reply');`, [thread.id, outsiderId]);
    });
  } catch (e) {
    outsiderBlocked = true;
  }
  check('non-enrolled outsider cannot reply (RLS blocks it)', outsiderBlocked);

  // Student B likes the reply
  await asUser(studentBId, async () => {
    await db.query(`insert into public.discussion_reactions (reply_id, profile_id, reaction) values ($1,$2,'like');`, [reply.id, studentBId]);
  });
  const afterLike = await db.query(`select like_count, dislike_count from public.discussion_replies where id = $1;`, [reply.id]);
  check('like_count incremented to 1 after a like', afterLike.rows[0].like_count === 1);

  // Student B switches to dislike (upsert-style update)
  await asUser(studentBId, async () => {
    await db.query(`update public.discussion_reactions set reaction = 'dislike' where reply_id = $1 and profile_id = $2;`, [reply.id, studentBId]);
  });
  const afterSwitch = await db.query(`select like_count, dislike_count from public.discussion_replies where id = $1;`, [reply.id]);
  check('switching like->dislike updates both counts correctly', afterSwitch.rows[0].like_count === 0 && afterSwitch.rows[0].dislike_count === 1);

  // Create 4 more distinct disliking users to reach the threshold of 5
  const dislikers = [studentBId]; // already disliked
  for (let i = 0; i < 4; i++) {
    const uid = (await db.query(`insert into auth.users (email, raw_user_meta_data) values ('disliker${i}@test.com','{"role":"student","full_name":"Disliker ${i}"}') returning id;`)).rows[0].id;
    await db.query(`insert into public.enrollments (student_id, course_id) values ($1,$2);`, [uid, courseId]);
    dislikers.push(uid);
    await asUser(uid, async () => {
      await db.query(`insert into public.discussion_reactions (reply_id, profile_id, reaction) values ($1,$2,'dislike');`, [reply.id, uid]);
    });
  }

  const replyAfter5 = await db.query(`select count(*)::int as c from public.discussion_replies where id = $1;`, [reply.id]);
  check('reply auto-deleted after reaching 5 dislikes', replyAfter5.rows[0].c === 0);

  const auditEntry = await db.query(`select * from public.audit_logs where action = 'discussion.auto_delete_reply' and target_id = $1;`, [reply.id]);
  check('auto-deletion recorded in audit_logs', auditEntry.rows.length === 1);

  // Reactions for the deleted reply should have cascade-deleted too
  const orphanReactions = await db.query(`select count(*)::int as c from public.discussion_reactions where reply_id = $1;`, [reply.id]);
  check('reactions cascade-deleted along with the reply', orphanReactions.rows[0].c === 0);

  console.log(`\n=== RESULTS: ${pass} passed, ${fail} failed ===`);
  if (fail > 0) process.exit(1);
}
main().catch(e => { console.error('FAILED:', e.message); process.exit(1); });
