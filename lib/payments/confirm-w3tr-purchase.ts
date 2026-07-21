import type { SupabaseClient } from "@supabase/supabase-js";
import { getRewardEngine } from "@/lib/reward-engine";

/**
 * Confirms a W3TR purchase given a verified Paystack reference, crediting
 * the student's wallet. Returns true if a matching purchase was found (and
 * either just confirmed by this call, or already confirmed by a prior one);
 * false if no purchase matches this reference (so the caller can try other
 * payment types instead of assuming this reference belongs to a W3TR
 * purchase).
 *
 * Concurrency: if Paystack redelivers the same webhook (which it does,
 * deliberately, as a retry policy) two requests can both start executing
 * confirmDelivery in close succession. A plain "SELECT status, then decide,
 * then UPDATE" has a window where both requests read status = 'pending'
 * before either has written 'confirmed', which would award W3TR twice for
 * one payment. Claiming the row with a single conditional UPDATE closes
 * that window: Postgres serializes concurrent UPDATEs to the same row, so
 * only one of the two requests can ever have its WHERE clause match and
 * come back with a row — the other gets zero rows back and skips the award.
 */
export async function confirmW3trPurchaseByReference(admin: SupabaseClient, reference: string): Promise<boolean> {
  const { data: purchase } = await admin
    .from("w3tr_purchases")
    .select("id")
    .eq("provider_reference", reference)
    .maybeSingle();

  if (!purchase) return false;

  // Atomically claim this purchase: only succeeds for whichever concurrent
  // request gets there first, because the WHERE clause excludes rows any
  // other request already flipped to 'confirmed'.
  const { data: claimed } = await admin
    .from("w3tr_purchases")
    .update({ status: "confirmed", confirmed_at: new Date().toISOString() })
    .eq("id", purchase.id)
    .neq("status", "confirmed")
    .select("*")
    .maybeSingle();

  if (!claimed) return true; // already confirmed by another request — nothing more to do

  const rewardEngine = getRewardEngine(admin);
  await rewardEngine.award(claimed.profile_id, "token_purchase", Number(claimed.w3tr_amount), {
    referenceTable: "w3tr_purchases",
    referenceId: claimed.id,
    description: `Purchased ${claimed.w3tr_amount} W3TR (${claimed.bundle_key} bundle)`,
  });

  return true;
}