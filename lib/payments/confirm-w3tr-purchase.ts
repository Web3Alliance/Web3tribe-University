import type { SupabaseClient } from "@supabase/supabase-js";
import { getRewardEngine } from "@/lib/reward-engine";

/**
 * Confirms a W3TR purchase given a verified Paystack reference, crediting
 * the student's wallet. Returns true if a matching, not-yet-confirmed
 * purchase was found and processed; false if no purchase matches this
 * reference (so the caller can try other payment types instead of assuming
 * this reference belongs to a W3TR purchase).
 */
export async function confirmW3trPurchaseByReference(admin: SupabaseClient, reference: string): Promise<boolean> {
  const { data: purchase } = await admin
    .from("w3tr_purchases")
    .select("*")
    .eq("provider_reference", reference)
    .maybeSingle();

  if (!purchase) return false;
  if (purchase.status === "confirmed") return true; // already handled, nothing to do

  const rewardEngine = getRewardEngine(admin);
  await rewardEngine.award(purchase.profile_id, "token_purchase", Number(purchase.w3tr_amount), {
    referenceTable: "w3tr_purchases",
    referenceId: purchase.id,
    description: `Purchased ${purchase.w3tr_amount} W3TR (${purchase.bundle_key} bundle)`,
  });

  await admin
    .from("w3tr_purchases")
    .update({ status: "confirmed", confirmed_at: new Date().toISOString() })
    .eq("id", purchase.id);

  return true;
}