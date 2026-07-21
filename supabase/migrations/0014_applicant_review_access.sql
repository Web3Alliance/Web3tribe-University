-- =====================================================================================
-- 0014: APPLICANT REVIEW ACCESS FOR ORGANIZATIONS
-- =====================================================================================
-- When a student expresses interest in an opportunity (an explicit, opt-in act that
-- already requires visible_for_opportunities = true), the posting organization needs
-- enough information to review and contact them:
--   * WHICH of the opportunity's required courses they completed, and when
--   * Their biodata (qualification, occupation, contact-relevant details)
-- profiles (name, email, phone, avatar, bio) are already publicly selectable, but
-- enrollments and student_biodata were locked to the student/admin/instructor only —
-- so the applicant review screen could never show completions or biodata.
--
-- Both policies below are scoped to the APPLICANT RELATIONSHIP: an organization can
-- only read this data for a student who has applied to one of that organization's own
-- opportunities. Enrollment visibility is further narrowed to just the courses the
-- opportunity actually requires — an org never sees the rest of a student's learning
-- history.
-- =====================================================================================

-- Completed-course visibility, narrowed to the required courses of the specific
-- opportunity the student applied to.
drop policy if exists "enrollments_select_by_applied_org" on public.enrollments;
create policy "enrollments_select_by_applied_org" on public.enrollments for select
  using (
    exists (
      select 1
      from public.opportunity_applications oa
      join public.opportunities o on o.id = oa.opportunity_id
      join public.organizations org on org.id = o.organization_id
      where oa.student_id = enrollments.student_id
        and org.owner_profile_id = auth.uid()
        and enrollments.course_id = any (o.required_course_ids)
    )
  );

-- Biodata visibility for the same applicant relationship.
drop policy if exists "student_biodata_select_by_applied_org" on public.student_biodata;
create policy "student_biodata_select_by_applied_org" on public.student_biodata for select
  using (
    exists (
      select 1
      from public.opportunity_applications oa
      join public.opportunities o on o.id = oa.opportunity_id
      join public.organizations org on org.id = o.organization_id
      where oa.student_id = student_biodata.profile_id
        and org.owner_profile_id = auth.uid()
    )
  );
