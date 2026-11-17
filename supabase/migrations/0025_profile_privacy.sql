-- =====================================================================================
-- 0025  Profile privacy (BugBunny report cc6b1c2, finding #2)
--
-- Problem: every signed-in user could read every profile row, including email, phone,
-- location and account-status fields.
--
-- Fix: signed-in users can now read only the genuinely public columns of other people's
-- profiles (name, username, avatar, bio, role, verified-instructor badge, join date).
-- Everything else is private and is reached only through three server-side functions that
-- check WHO is asking and WHY:
--   * my_profile()                  - your own full profile
--   * profile_contacts(ids)         - contact details, only for people you have a real
--                                     relationship with (your own learners/applicants/members) or staff
--   * staff_profiles(search, limit) - full rows for admin/user-management screens
-- Deploy the application code FIRST (it already uses these functions), then run this file.
-- Safe to run more than once.
-- =====================================================================================

-- ---- 1. Column-level access: public columns only --------------------------------------
revoke select on table public.profiles from authenticated;
grant select (id, full_name, username, avatar_url, bio, role, is_instructor_verified, created_at)
  on table public.profiles to authenticated;
-- anon keeps (id, full_name, username, avatar_url) from migration 0022.
-- Columns added to profiles in future are private by default (no grant) - a safe default.

-- ---- 2. Who may see someone's private details ------------------------------------------
create or replace function public.can_view_private_profile(p_target uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select auth.uid() is not null and (
    p_target = auth.uid()
    or public.is_moderator_or_above()
    -- an instructor sees the learners enrolled in their own courses / cohorts
    or exists (
      select 1 from public.enrollments e
      left join public.courses c on c.id = e.course_id
      left join public.cohorts ch on ch.id = e.cohort_id
      where e.student_id = p_target
        and (c.instructor_id = auth.uid() or ch.instructor_id = auth.uid())
    )
    -- an organization owner sees their own members, programme learners and applicants
    or exists (
      select 1 from public.organization_members om
      join public.organizations o on o.id = om.organization_id
      where om.profile_id = p_target and o.owner_profile_id = auth.uid()
    )
    or exists (
      select 1 from public.organization_program_assignments pa
      join public.organization_programs pr on pr.id = pa.program_id
      join public.organizations o on o.id = pr.organization_id
      where pa.profile_id = p_target and o.owner_profile_id = auth.uid()
    )
    or exists (
      select 1 from public.opportunity_applications oa
      join public.opportunities op on op.id = oa.opportunity_id
      join public.organizations o on o.id = op.organization_id
      where oa.student_id = p_target and o.owner_profile_id = auth.uid()
    )
  );
$$;

create or replace function public.my_profile()
returns setof public.profiles
language sql
stable
security definer
set search_path = public
as $$
  select * from public.profiles where id = auth.uid();
$$;

create or replace function public.profile_contacts(p_ids uuid[])
returns table (id uuid, email text, phone text, phone_verified boolean, country text, state_region text, lga text)
language sql
stable
security definer
set search_path = public
as $$
  select p.id, p.email, p.phone, p.phone_verified, p.country, p.state_region, p.lga
  from public.profiles p
  where p.id = any (p_ids) and public.can_view_private_profile(p.id);
$$;

create or replace function public.staff_profiles(p_query text default null, p_limit int default 100)
returns setof public.profiles
language sql
stable
security definer
set search_path = public
as $$
  select * from public.profiles
  where public.is_admin()
    and (p_query is null or p_query = '' or full_name ilike '%' || p_query || '%' or email ilike '%' || p_query || '%')
  order by created_at desc
  limit least(greatest(p_limit, 1), 200);
$$;

-- Only signed-in users may call them (the checks above do the real gating).
revoke execute on function public.can_view_private_profile(uuid) from public, anon, authenticated;
revoke execute on function public.my_profile() from public, anon;
revoke execute on function public.profile_contacts(uuid[]) from public, anon;
revoke execute on function public.staff_profiles(text, int) from public, anon;
grant execute on function public.my_profile() to authenticated;
grant execute on function public.profile_contacts(uuid[]) to authenticated;
grant execute on function public.staff_profiles(text, int) to authenticated;
grant execute on function public.can_view_private_profile(uuid) to service_role;
