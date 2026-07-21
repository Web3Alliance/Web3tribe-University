-- =====================================================================================
-- 0015: ATOMIC DONATION CAMPAIGN TOTALS
-- =====================================================================================
-- Backs the fix in lib/payments/confirm-donation.ts: incrementing
-- donation_campaigns.raised_amount used to be a JS-side "read the current
-- value, add to it, write it back" — under concurrent webhook deliveries
-- (Paystack retries the same webhook deliberately) two donations confirmed
-- at nearly the same moment could both read the same starting value and one
-- increment would silently overwrite the other. A single atomic UPDATE
-- (raised_amount = raised_amount + amount, evaluated entirely by Postgres)
-- has no such window.
-- =====================================================================================

create or replace function public.increment_campaign_raised(
  p_campaign_id uuid,
  p_amount numeric
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.donation_campaigns
    set raised_amount = raised_amount + p_amount
    where id = p_campaign_id;
end;
$$;
