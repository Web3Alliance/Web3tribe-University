-- =====================================================================================
-- 0011: SKILLS-TO-OPPORTUNITY MATCHING
-- =====================================================================================
-- Closes the loop between "completed a course" and "found real opportunity" —
-- organizations post jobs/gigs/apprenticeships tied to specific required courses;
-- students who have genuinely COMPLETED those courses (not just enrolled) are matched
-- and can express interest.
--
-- Privacy is opt-in by design: a student is only visible to an organization's
-- applicant list if they've explicitly turned on profiles.visible_for_opportunities
-- (default false) AND have applied to that specific opportunity. Completing a course
-- never automatically exposes anyone to anyone.
-- =====================================================================================

do $$ begin
  create type opportunity_type as enum ('job', 'gig', 'apprenticeship', 'internship');
exception when duplicate_object then null; end $$;

do $$ begin
  create type opportunity_status as enum ('open', 'closed');
exception when duplicate_object then null; end $$;

do $$ begin
  create type application_status as enum ('interested', 'shortlisted', 'closed');
exception when duplicate_object then null; end $$;

alter table public.profiles add column if not exists visible_for_opportunities boolean not null default false;
comment on column public.profiles.visible_for_opportunities is
  'Opt-in consent: student is only visible in an organization''s applicant list if this is true AND they have applied to that specific opportunity. Off by default.';

create table if not exists public.opportunities (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  title text not null,
  description text,
  opportunity_type opportunity_type not null default 'job',
  location_state text, -- null means remote/anywhere
  required_course_ids uuid[] not null default '{}',
  application_method text, -- free text: a URL, email, or instructions
  status opportunity_status not null default 'open',
  created_at timestamptz not null default now(),
  expires_at timestamptz
);

create index if not exists idx_opportunities_org on public.opportunities(organization_id);
create index if not exists idx_opportunities_status on public.opportunities(status);

create table if not exists public.opportunity_applications (
  id uuid primary key default gen_random_uuid(),
  opportunity_id uuid not null references public.opportunities(id) on delete cascade,
  student_id uuid not null references public.profiles(id) on delete cascade,
  status application_status not null default 'interested',
  created_at timestamptz not null default now(),
  unique (opportunity_id, student_id)
);

create index if not exists idx_opportunity_apps_opportunity on public.opportunity_applications(opportunity_id);
create index if not exists idx_opportunity_apps_student on public.opportunity_applications(student_id);

alter table public.opportunities enable row level security;
alter table public.opportunity_applications enable row level security;

-- Anyone can browse OPEN opportunities (needed for students to see what's
-- available, including logged-out visitors on a public listings page).
-- The posting organization can always see and manage their own regardless
-- of status.
drop policy if exists "opportunities_select" on public.opportunities;
create policy "opportunities_select" on public.opportunities for select
  using (
    status = 'open'
    or organization_id in (select id from public.organizations where owner_profile_id = auth.uid())
    or public.is_admin()
  );

drop policy if exists "opportunities_insert" on public.opportunities;
create policy "opportunities_insert" on public.opportunities for insert
  with check (organization_id in (select id from public.organizations where owner_profile_id = auth.uid()));

drop policy if exists "opportunities_update" on public.opportunities;
create policy "opportunities_update" on public.opportunities for update
  using (organization_id in (select id from public.organizations where owner_profile_id = auth.uid()) or public.is_admin())
  with check (organization_id in (select id from public.organizations where owner_profile_id = auth.uid()) or public.is_admin());

-- Applications: a student can see and create their OWN applications. An
-- organization can see applications ONLY to opportunities they themselves
-- posted — this is the actual privacy boundary that makes the opt-in
-- consent meaningful (an org never sees applications to someone else's
-- posting).
drop policy if exists "opportunity_apps_select" on public.opportunity_applications;
create policy "opportunity_apps_select" on public.opportunity_applications for select
  using (
    student_id = auth.uid()
    or exists (
      select 1 from public.opportunities o
      join public.organizations org on org.id = o.organization_id
      where o.id = opportunity_id and org.owner_profile_id = auth.uid()
    )
    or public.is_admin()
  );

drop policy if exists "opportunity_apps_insert" on public.opportunity_applications;
create policy "opportunity_apps_insert" on public.opportunity_applications for insert
  with check (student_id = auth.uid());

drop policy if exists "opportunity_apps_update" on public.opportunity_applications;
create policy "opportunity_apps_update" on public.opportunity_applications for update
  using (
    exists (
      select 1 from public.opportunities o
      join public.organizations org on org.id = o.organization_id
      where o.id = opportunity_id and org.owner_profile_id = auth.uid()
    )
    or public.is_admin()
  );

commit;