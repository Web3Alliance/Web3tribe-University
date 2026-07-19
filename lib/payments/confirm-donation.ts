import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Confirms a donation given a verified Paystack reference. Returns true if a
 * matching, not-yet-confirmed donation was found and processed; false if no
 * donation matches this reference (so the caller can try other payment
 * types instead of assuming this reference belongs to a donation).
 */
export async function confirmDonationByReference(admin: SupabaseClient, reference: string): Promise<boolean> {
  const { data: donation } = await admin
    .from("donations")
    .select("*")
    .eq("provider_reference", reference)
    .maybeSingle();

  if (!donation) return false;
  if (donation.status === "confirmed") return true; // already handled, nothing to do

  await admin
    .from("donations")
    .update({ status: "confirmed", confirmed_at: new Date().toISOString() })
    .eq("id", donation.id);

  if (donation.campaign_id) {
    const { data: campaign } = await admin
      .from("donation_campaigns")
      .select("raised_amount")
      .eq("id", donation.campaign_id)
      .single();
    if (campaign) {
      await admin
        .from("donation_campaigns")
        .update({ raised_amount: Number(campaign.raised_amount) + Number(donation.amount) })
        .eq("id", donation.campaign_id);
    }
  }

  return true;
}