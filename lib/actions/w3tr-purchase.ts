"use server";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/rbac";
import { initializePaystackTransaction } from "@/lib/paystack";
import { findBundle } from "@/lib/w3tr-bundles";

export async function initiateW3trPurchaseAction(bundleKey: string) {
  const profile = await getCurrentProfile();
  if (!profile) return { error: "You must be logged in to buy W3TR." };

  const bundle = findBundle(bundleKey);
  if (!bundle) return { error: "Unknown W3TR bundle." };

  const supabase = await createClient();
  const { data: purchase, error } = await supabase
    .from("w3tr_purchases")
    .insert({
      profile_id: profile.id,
      bundle_key: bundle.key,
      w3tr_amount: bundle.w3trAmount,
      amount_naira: bundle.amountNaira,
      status: "pending",
    })
    .select()
    .single();

  if (error || !purchase) {
    return { error: error?.message ?? "Failed to start purchase." };
  }

  try {
    const paystackData = await initializePaystackTransaction({
      email: profile.email,
      amountKobo: Math.round(bundle.amountNaira * 100),
      reference: purchase.id,
      callbackUrl: `${process.env.NEXT_PUBLIC_SITE_URL}/student/wallet?purchase=pending`,
      metadata: { purchaseId: purchase.id, bundleKey: bundle.key },
    });

    await supabase.from("w3tr_purchases").update({ provider_reference: paystackData.reference }).eq("id", purchase.id);

    return { error: null, authorizationUrl: paystackData.authorization_url };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Paystack error." };
  }
}