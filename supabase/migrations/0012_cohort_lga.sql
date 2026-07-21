-- =====================================================================================
-- 0012: LGA (LOCAL GOVERNMENT AREA) FOR COHORTS AND PROFILES
-- =====================================================================================
-- Adds a structured Local Government Area field alongside state, for both cohorts
-- (so instructors can specify exactly where a hybrid/in-person cohort meets, down to
-- LGA level) and profiles (so students can set their own LGA for closer "near me"
-- matching than state alone provides). Kept as free text rather than a fixed
-- dropdown — Nigeria has 774 LGAs and no single canonical list is bundled with this
-- schema; validating against a real list can be layered on later without another
-- migration.
--
-- Same rule as state_region: required for hybrid/in-person cohorts, forced to null
-- for fully online ones — enforced by the existing trigger from 0006, extended here.
-- =====================================================================================

alter table public.cohorts add column if not exists lga text;
alter table public.profiles add column if not exists lga text;

create index if not exists idx_cohorts_lga on public.cohorts(lga);

create or replace function public.enforce_cohort_location_matches_course()
returns trigger language plpgsql as $$
declare
  course_mode cohort_delivery_mode;
begin
  select delivery_mode into course_mode from public.courses where id = new.course_id;

  if course_mode = 'online' then
    new.state_region := null;
    new.lga := null;
    new.address := null;
  elsif new.state_region is null then
    raise exception 'This course is % — a state is required when starting a cohort for it.', course_mode;
  end if;

  return new;
end;
$$;

commit;