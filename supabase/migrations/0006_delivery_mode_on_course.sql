-- =====================================================================================
-- 0006: DELIVERY MODE BELONGS TO THE COURSE, NOT THE COHORT
-- =====================================================================================
-- Correction to 0005: delivery mode (online / hybrid / in_person) is decided once,
-- by the course's original author, when the course is created — not by whichever
-- instructor later starts a cohort to teach it. A cohort inherits its course's
-- delivery mode; it doesn't set its own.
--
-- This moves delivery_mode from cohorts to courses, and replaces the old
-- cohorts-only CHECK constraint (which can't reference another table) with a
-- trigger that enforces the same rule by looking up the parent course:
--   - course.delivery_mode = 'online'              -> cohort.state_region must be NULL
--   - course.delivery_mode IN ('hybrid','in_person') -> cohort.state_region required
-- =====================================================================================

alter table public.courses add column if not exists delivery_mode cohort_delivery_mode not null default 'online';
comment on column public.courses.delivery_mode is
  'Set once by the course''s original author; cohorts inherit it and cannot override it.';

alter table public.cohorts drop constraint if exists cohort_location_required_unless_online;
alter table public.cohorts drop column if exists delivery_mode;

create or replace function public.enforce_cohort_location_matches_course()
returns trigger language plpgsql as $$
declare
  course_mode cohort_delivery_mode;
begin
  select delivery_mode into course_mode from public.courses where id = new.course_id;

  if course_mode = 'online' then
    new.state_region := null;
    new.address := null;
  elsif new.state_region is null then
    raise exception 'This course is % — a state is required when starting a cohort for it.', course_mode;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_cohort_location_matches_course on public.cohorts;
create trigger trg_cohort_location_matches_course
  before insert or update on public.cohorts
  for each row execute function public.enforce_cohort_location_matches_course();

commit;