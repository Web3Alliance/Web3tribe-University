-- =====================================================================================
-- VERIFY MIGRATION 0024 (BugBunny report cc6b1c2) IS APPLIED  -  read-only
-- =====================================================================================
-- Part A: every row should say PASS.
select check_name, expected, actual,
       case when actual = expected then 'PASS' else 'FAIL' end as result
from (values
  ('can_author_courses() exists', true, to_regprocedure('public.can_author_courses()') is not null),
  ('students cannot create courses (policy uses can_author_courses)', true,
     coalesce((select with_check like '%can_author_courses%' from pg_policies where schemaname='public' and tablename='courses' and policyname='courses_instructor_insert'), false)),
  ('lessons write policy requires instructor/admin role', true,
     coalesce((select with_check like '%can_author_courses%' from pg_policies where schemaname='public' and tablename='lessons' and policyname='lessons_manage'), false)),
  ('quizzes write policy requires instructor/admin role', true,
     coalesce((select with_check like '%can_author_courses%' from pg_policies where schemaname='public' and tablename='quizzes' and policyname='quizzes_manage'), false)),
  ('quiz_questions write policy requires instructor/admin role', true,
     coalesce((select with_check like '%can_author_courses%' from pg_policies where schemaname='public' and tablename='quiz_questions' and policyname='quiz_questions_manage'), false)),
  ('reward trigger on lessons', true,
     exists (select 1 from pg_trigger where tgname='trg_protect_lesson_reward' and tgrelid=to_regclass('public.lessons') and not tgisinternal)),
  ('reward trigger on quizzes', true,
     exists (select 1 from pg_trigger where tgname='trg_protect_quiz_reward' and tgrelid=to_regclass('public.quizzes') and not tgisinternal)),
  ('award_w3tr pays each item once (guard present)', true,
     coalesce((select prosrc like '%already rewarded once%' from pg_proc where oid = 'public.award_w3tr(uuid, w3tr_transaction_type, numeric, text, uuid, text, uuid)'::regprocedure), false)),
  ('unique once-per-item reward index exists', true, to_regclass('public.uq_w3tr_reward_once') is not null),
  ('certificate_block_reason() exists', true, to_regprocedure('public.certificate_block_reason(uuid, uuid, integer)') is not null),
  ('browser roles cannot call award_w3tr', false,
     has_function_privilege('authenticated', 'public.award_w3tr(uuid, w3tr_transaction_type, numeric, text, uuid, text, uuid)', 'execute')),
  ('browser roles cannot call certificate_block_reason', false,
     has_function_privilege('authenticated', 'public.certificate_block_reason(uuid, uuid, integer)', 'execute')),
  ('course-documents bucket is private', false,
     coalesce((select public from storage.buckets where id='course-documents'), true)),
  ('public-read policy for course documents is gone', false,
     exists (select 1 from pg_policies where schemaname='storage' and policyname='course_documents_public_read')),
  ('course_resources rows are not readable by visitors just because a course is published', true,
     not exists (select 1 from pg_policies where schemaname='public' and tablename='course_resources' and cmd='SELECT' and qual like '%published%'))
) as t(check_name, expected, actual)
order by 4 desc, 1;

-- Part B: DAMAGE CHECKS (read-only). Ideally every query returns zero rows.
-- B1. Course content owned by non-instructors (made through the old hole).
select 'B1 course owned by a non-instructor' as finding, c.id, c.title, c.status, p.email, p.role
from public.courses c join public.profiles p on p.id = c.instructor_id
where p.role not in ('instructor','admin','super_admin');

-- B2. Lessons/quizzes with a reward above the platform values (1 / 2 / 10).
select 'B2 lesson reward > 1' as finding, id, title, w3tr_reward from public.lessons where w3tr_reward > 1
union all
select 'B2 quiz reward above platform value', id, title, w3tr_reward from public.quizzes
  where w3tr_reward > case when is_final_exam then 10 else 2 end;

-- B3. Rewards paid more than once for the same item (the farming). If rows appear here the unique
--     index could not be built: reconcile them, then run 0024 again.
select 'B3 repeated reward' as finding, profile_id, type, reference_id, count(*) as times, sum(amount) as total
from public.w3tr_transactions
where type in ('lesson_complete','quiz_pass','exam_pass','course_complete') and reference_id is not null
group by profile_id, type, reference_id having count(*) > 1
order by total desc;

-- B4. Rewards earned on the learner's OWN course.
select 'B4 reward on own course' as finding, t.profile_id, t.type, t.amount, t.created_at
from public.w3tr_transactions t
left join public.lessons l on t.reference_table='lessons' and l.id=t.reference_id
left join public.quizzes q on t.reference_table='quizzes' and q.id=t.reference_id
join public.courses c on c.id = coalesce(l.course_id, q.course_id, case when t.reference_table='courses' then t.reference_id end)
where t.type in ('lesson_complete','quiz_pass','exam_pass','course_complete') and c.instructor_id = t.profile_id;

-- B5. Certificates that today's rules would NOT have issued (review each; revoke if not legitimate).
select 'B5 certificate fails current rules' as finding, ce.id, ce.certificate_code, ce.course_title_snapshot, ce.student_name_snapshot,
       public.certificate_block_reason(ce.student_id, ce.course_id, 10) as reason
from public.certificates ce
where not ce.revoked
  and public.certificate_block_reason(ce.student_id, ce.course_id, 10) is not null;
