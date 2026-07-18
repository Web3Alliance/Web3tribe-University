-- =====================================================================================
-- 0005: COHORTS + LOCATION-AWARE DISCOVERY
-- =====================================================================================
-- Introduces:
--  1. cohorts: instructor-led instances of teaching an EXISTING course (which may have
--     been authored by a different instructor originally) — with a location (state +
--     optional address) for hybrid/in-person delivery, or fully online. Enrollment
--     closes once a cohort's start_date has passed.
--  2. enrollments.cohort_id: an enrollment can optionally be tied to a specific cohort;
--     direct course enrollment (no cohort) remains fully supported and unchanged.
--  3. profiles.state_region already existed (added in 0001) but was never exposed in
--     any settings UI — this migration doesn't need to add it, just start using it.
--
-- Accreditation note: instructor eligibility to start a cohort for a course is NOT
-- gated here — public.profiles.is_instructor_verified and
-- instructor_profiles.verification_status already exist for exactly this purpose, and
-- can be wired into cohort creation's RLS/application checks later without a further
-- migration. Left open now to match the platform's "all roles unregulated for testing"
-- stage.
-- =====================================================================================

do $$ begin
  create type cohort_delivery_mode as enum ('online', 'hybrid', 'in_person');
exception when duplicate_object then null; end $$;

do $$ begin
  create type cohort_status as enum ('upcoming', 'in_progress', 'completed', 'cancelled');
exception when duplicate_object then null; end $$;

create table if not exists public.cohorts (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses(id) on delete cascade,
  instructor_id uuid not null references public.profiles(id) on delete cascade,
  title text,
  delivery_mode cohort_delivery_mode not null default 'online',
  state_region text,
  address text,
  max_students int,
  start_date date not null,
  end_date date,
  status cohort_status not null default 'upcoming',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint cohort_location_required_unless_online check (
    delivery_mode = 'online' or state_region is not null
  )
);

create index if not exists idx_cohorts_course on public.cohorts(course_id);
create index if not exists idx_cohorts_instructor on public.cohorts(instructor_id);
create index if not exists idx_cohorts_state on public.cohorts(state_region);
create index if not exists idx_cohorts_start_date on public.cohorts(start_date);

alter table public.enrollments add column if not exists cohort_id uuid references public.cohorts(id) on delete set null;
create index if not exists idx_enrollments_cohort on public.enrollments(cohort_id);

alter table public.cohorts enable row level security;

-- Anyone can see cohorts of published courses (needed for the public course
-- detail page to list upcoming cohorts, including logged-out visitors).
drop policy if exists "cohorts_select" on public.cohorts;
create policy "cohorts_select" on public.cohorts for select
  using (
    exists (select 1 from public.courses c where c.id = course_id and c.status = 'published')
    or instructor_id = auth.uid()
    or public.is_admin()
  );

-- Any instructor can start a cohort for any published course (see
-- accreditation note above) — a future gate would add an is_instructor_verified
-- check here without needing a new migration.
drop policy if exists "cohorts_insert" on public.cohorts;
create policy "cohorts_insert" on public.cohorts for insert
  with check (
    instructor_id = auth.uid()
    and exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('instructor', 'admin', 'super_admin'))
    and exists (select 1 from public.courses c where c.id = course_id and c.status = 'published')
  );

drop policy if exists "cohorts_update" on public.cohorts;
create policy "cohorts_update" on public.cohorts for update
  using (instructor_id = auth.uid() or public.is_admin())
  with check (instructor_id = auth.uid() or public.is_admin());

drop policy if exists "cohorts_delete" on public.cohorts;
create policy "cohorts_delete" on public.cohorts for delete
  using (instructor_id = auth.uid() or public.is_admin());

commit;