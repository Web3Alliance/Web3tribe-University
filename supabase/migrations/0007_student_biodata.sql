-- =====================================================================================
-- 0007: STUDENT BIODATA (required before enrollment, with a temporary skip allowance)
-- =====================================================================================
-- Institutional biodata schools typically need on record for a student. Filling this
-- in is required before a student can enroll in any course — EXCEPT for the first 30
-- students overall (by whichever order they reach this gate), who get a "Skip for now"
-- option for testing/showcase purposes. Once 30 students have gone through this gate
-- (whether by filling it in or skipping), the skip option disappears permanently and
-- every student after that must actually complete the form.
--
-- "skipped = true" with everything else null still counts as "gone through the gate"
-- for both the enrollment check and the 30-student counter — this is what lets those
-- early students enroll without providing data during testing.
-- =====================================================================================

create table if not exists public.student_biodata (
  profile_id uuid primary key references public.profiles(id) on delete cascade,
  skipped boolean not null default false,
  date_of_birth date,
  gender text check (gender is null or gender in ('male', 'female', 'other')),
  nationality text,
  state_of_origin text,
  lga text,
  home_address text,
  next_of_kin_name text,
  next_of_kin_relationship text,
  next_of_kin_phone text,
  next_of_kin_address text,
  highest_qualification text,
  occupation_or_institution text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.student_biodata enable row level security;

drop policy if exists "student_biodata_select_own" on public.student_biodata;
create policy "student_biodata_select_own" on public.student_biodata for select
  using (profile_id = auth.uid() or public.is_admin());

drop policy if exists "student_biodata_insert_own" on public.student_biodata;
create policy "student_biodata_insert_own" on public.student_biodata for insert
  with check (profile_id = auth.uid());

drop policy if exists "student_biodata_update_own" on public.student_biodata;
create policy "student_biodata_update_own" on public.student_biodata for update
  using (profile_id = auth.uid() or public.is_admin())
  with check (profile_id = auth.uid() or public.is_admin());

commit;