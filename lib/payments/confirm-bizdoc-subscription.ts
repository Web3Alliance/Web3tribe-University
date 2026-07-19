import { createBizdocAdminClient } from "@/lib/supabase/bizdoc-admin";

const COMMISSION_RATE = 0.3;
const MONTHLY_AMOUNT = 1500;
const ANNUAL_AMOUNT = 15000;

interface PaystackChargeData {
  reference: string;
  metadata?: { user_id?: string; plan?: string };
}

/**
 * Ported directly from BizDoc's own app/api/subscription/activate/route.ts,
 * adapted to use BizDoc's separate Supabase project (via
 * createBizdocAdminClient) rather than Web3tribe University's. Same logic,
 * same tables, same behavior — just called from the shared consolidated
 * webhook instead of its own dedicated route, since Paystack only allows one
 * webhook URL per account and this account is shared across products.
 *
 * BizDoc identifies its own transactions by the presence of
 * `metadata.user_id` (set when BizDoc itself initializes the Paystack
 * transaction) rather than by looking up the reference in a table, unlike
 * Web3tribe's own donations/W3TR purchases. Returns false (unhandled) if
 * metadata.user_id isn't present, so the caller knows this wasn't a BizDoc
 * transaction.
 */
export async function confirmBizdocSubscription(data: PaystackChargeData): Promise<boolean> {
  const userId = data.metadata?.user_id;
  if (!userId) return false;

  const supabaseAdmin = createBizdocAdminClient();
  const plan = data.metadata?.plan ?? "monthly";
  const months = plan === "annual" ? 12 : 1;
  const subscriptionAmount = plan === "annual" ? ANNUAL_AMOUNT : MONTHLY_AMOUNT;
  const expiresAt = new Date(Date.now() + months * 30 * 24 * 60 * 60 * 1000).toISOString();

  await supabaseAdmin.from("subscriptions").upsert(
    {
      user_id: userId,
      status: "active",
      plan,
      subscribed_at: new Date().toISOString(),
      expires_at: expiresAt,
      paystack_reference: data.reference,
    },
    { onConflict: "user_id" }
  );

  const { data: biz } = await supabaseAdmin
    .from("businesses")
    .select("referral_code, name")
    .eq("user_id", userId)
    .single();

  if (biz?.referral_code) {
    const { data: marketer } = await supabaseAdmin
      .from("marketers")
      .select("id, email")
      .eq("referral_code", biz.referral_code)
      .eq("status", "active")
      .single();

    if (marketer) {
      const commission = subscriptionAmount * COMMISSION_RATE;
      for (let i = 0; i < months; i++) {
        const earningMonth = new Date(Date.now() + i * 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 7);
        await supabaseAdmin.from("marketer_earnings").insert({
          marketer_id: marketer.id,
          business_user_id: userId,
          business_name: biz.name,
          subscription_amount: subscriptionAmount,
          commission_amount: commission,
          month: earningMonth,
          plan,
          paid: false,
          paystack_reference: data.reference,
        });
      }

      const totalCommission = commission * months;
      try {
        await supabaseAdmin.rpc("increment_marketer_earned", { marketer_id: marketer.id, amount: totalCommission });
      } catch {
        const { data: marketerRow } = await supabaseAdmin
          .from("marketers")
          .select("total_earned")
          .eq("id", marketer.id)
          .single();
        if (marketerRow) {
          await supabaseAdmin
            .from("marketers")
            .update({ total_earned: Number(marketerRow.total_earned) + totalCommission })
            .eq("id", marketer.id);
        }
      }
      console.log("Commission recorded for marketer:", marketer.email, "amount:", totalCommission);
    }
  }

  console.log("BizDoc subscription activated for:", userId, "plan:", plan);
  return true;
}