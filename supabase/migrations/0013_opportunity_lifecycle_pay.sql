-- =====================================================================================
-- 0013: OPPORTUNITY LIFECYCLE, SHORTLIST MESSAGING, OFFER RESPONSE, AND EXPECTED PAY
-- =====================================================================================
-- Closes the feedback loop that 0011 left open:
--   * Organizations must attach a "next steps" message when shortlisting, and the
--     student is notified (in-app + email, handled in the app layer).
--   * Shortlisted students can ACCEPT or REJECT the offer — rejection requires a
--     note back to the organization.
--   * Opportunities now carry an expected pay (amount + ISO currency + period) so
--     students always know what an opportunity pays before expressing interest.
-- =====================================================================================

-- New application statuses for the student's response to a shortlist.
-- (Safe on PG12+: the new values are not used elsewhere in this migration.)
alter type application_status add value if not exists 'accepted';
alter type application_status add value if not exists 'rejected';

-- ---- Expected pay on opportunities ---------------------------------------------------
alter table public.opportunities add column if not exists pay_amount numeric(14, 2);
alter table public.opportunities add column if not exists pay_currency text not null default 'NGN';
alter table public.opportunities add column if not exists pay_period text not null default 'month'
  check (pay_period in ('hour', 'day', 'week', 'month', 'year', 'project'));

comment on column public.opportunities.pay_amount is
  'Expected pay for this opportunity. Required for all NEW opportunities (enforced in the app layer so pre-existing rows without pay remain valid).';
comment on column public.opportunities.pay_currency is
  'ISO 4217 currency code for pay_amount, in the currency of the opportunity''s country (e.g. NGN, GHS, KES, USD).';

-- ---- Shortlist message + student response on applications ----------------------------
alter table public.opportunity_applications add column if not exists shortlist_message text;
alter table public.opportunity_applications add column if not exists shortlisted_at timestamptz;
alter table public.opportunity_applications add column if not exists response_note text;
alter table public.opportunity_applications add column if not exists responded_at timestamptz;

comment on column public.opportunity_applications.shortlist_message is
  'Required next-steps message written by the organization when shortlisting; shown to the student in-app and emailed to them.';
comment on column public.opportunity_applications.response_note is
  'Optional note from the student when responding to a shortlist; required by the app layer when the response is a rejection.';

-- ---- RLS: let students update their OWN application ----------------------------------
-- 0011 only allowed the posting organization to update applications, which made it
-- impossible for a shortlisted student to record an accept/reject. Students may now
-- update rows where they are the applicant; which state transitions are legal
-- (only shortlisted -> accepted/rejected) is enforced by the server action, and the
-- organization-facing fields they could theoretically touch are never trusted from
-- this path.
drop policy if exists "opportunity_apps_update_own" on public.opportunity_applications;
create policy "opportunity_apps_update_own" on public.opportunity_applications for update
  using (student_id = auth.uid())
  with check (student_id = auth.uid());
