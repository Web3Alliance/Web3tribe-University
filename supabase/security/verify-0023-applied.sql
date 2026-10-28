-- =====================================================================================
-- VERIFY THAT MIGRATION 0023 (edits to a live course go back to review) IS APPLIED
-- =====================================================================================
-- Read-only. Paste into the Supabase SQL editor. Every row should say PASS.
-- A FAIL names the missing part. Safe to run BEFORE the migration too (it just reports FAIL).
select check_name, expected, actual,
       case when actual = expected then 'PASS' else 'FAIL' end as result
from (values
  ('review trigger on courses (title, price, description, thumbnail …)', true,
     exists (select 1 from pg_trigger t where t.tgname = 'trg_courses_review_on_edit' and t.tgrelid = to_regclass('public.courses') and not t.tgisinternal)),
  ('review trigger on course_sections', true,
     exists (select 1 from pg_trigger t where t.tgname = 'trg_review_on_edit' and t.tgrelid = to_regclass('public.course_sections') and not t.tgisinternal)),
  ('review trigger on lessons', true,
     exists (select 1 from pg_trigger t where t.tgname = 'trg_review_on_edit' and t.tgrelid = to_regclass('public.lessons') and not t.tgisinternal)),
  ('review trigger on lesson_resources', true,
     exists (select 1 from pg_trigger t where t.tgname = 'trg_review_on_edit' and t.tgrelid = to_regclass('public.lesson_resources') and not t.tgisinternal)),
  ('review trigger on course_resources', true,
     exists (select 1 from pg_trigger t where t.tgname = 'trg_review_on_edit' and t.tgrelid = to_regclass('public.course_resources') and not t.tgisinternal)),
  ('review trigger on quizzes', true,
     exists (select 1 from pg_trigger t where t.tgname = 'trg_review_on_edit' and t.tgrelid = to_regclass('public.quizzes') and not t.tgisinternal)),
  ('review trigger on quiz_questions', true,
     exists (select 1 from pg_trigger t where t.tgname = 'trg_review_on_edit' and t.tgrelid = to_regclass('public.quiz_questions') and not t.tgisinternal)),
  ('review trigger on assignments', true,
     exists (select 1 from pg_trigger t where t.tgname = 'trg_review_on_edit' and t.tgrelid = to_regclass('public.assignments') and not t.tgisinternal)),
  ('rule sends the course to pending_review', true,
     coalesce(position('pending_review' in pg_get_functiondef(to_regprocedure('public.review_on_course_edit()'))) > 0, false)),
  ('helper functions are NOT callable from the browser', true,
     (select count(*) = 5 and bool_and(not has_function_privilege('anon', f.oid, 'execute') and not has_function_privilege('authenticated', f.oid, 'execute'))
        from (select to_regprocedure(x) as oid from unnest(array[
          'public.review_on_course_edit()', 'public.review_on_course_content_change()',
          'public.flag_published_course_for_review(uuid)', 'public.notify_course_flagged(uuid, text, uuid)',
          'public.request_role()']) as x) f
       where f.oid is not null)),
  ('an instructor cannot self-feature a course (staff-only)', true,
     coalesce(position('Only staff can feature a course' in pg_get_functiondef(to_regprocedure('public.review_on_course_edit()'))) > 0, false))
) as t(check_name, expected, actual)
order by (actual = expected), check_name;
