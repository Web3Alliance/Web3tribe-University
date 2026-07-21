import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Confirms a donation given a verified Paystack reference. Returns true if
 * a matching donation was found (whether just confirmed by this call, or
 * already confirmed by a prior one); false if no donation matches this
 * reference (so the caller can try other payment types instead of assuming
 * this reference belongs to a donation).
 *
 * Concurrency: see the identical comment in confirm-w3tr-purchase.ts — the
 * status flip is done as a single conditional UPDATE so a redelivered
 * webhook can never process the same donation twice. The campaign total is
 * incremented via the increment_campaign_raised() function rather than a
 * JS read-then-write, so two donations confirmed at the same moment don't
 * silently lose one of the increments.
 */
export async function confirmDonationByReference(admin: SupabaseClient, reference: string): Promise<boolean> {
  const { data: donation } = await admin
    .from("donations")
    .select("id")
    .eq("provider_reference", reference)
    .maybeSingle();

  if (!donation) return false;

  const { data: claimed } = await admin
    .from("donations")
    .update({ status: "confirmed", confirmed_at: new Date().toISOString() })
    .eq("id", donation.id)
    .neq("status", "confirmed")
    .select("*")
    .maybeSingle();

  if (!claimed) return true; // already confirmed by another request — nothing more to do

  if (claimed.campaign_id) {
    await admin.rpc("increment_campaign_raised", {
      p_campaign_id: claimed.campaign_id,
      p_amount: Number(claimed.amount),
    });
  }

  return true;
}