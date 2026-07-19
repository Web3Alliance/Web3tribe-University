import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyPaystackWebhookSignature, verifyPaystackTransaction } from "@/lib/paystack";
import { confirmDonationByReference } from "@/lib/payments/confirm-donation";
import { confirmW3trPurchaseByReference } from "@/lib/payments/confirm-w3tr-purchase";
import { confirmBizdocSubscription } from "@/lib/payments/confirm-bizdoc-subscription";

/**
 * SINGLE, CONSOLIDATED PAYSTACK WEBHOOK — read this before touching anything here.
 * =====================================================================================
 * Paystack only allows ONE webhook URL per account (Dashboard → Settings → API Keys
 * & Webhooks — there's exactly one "Live Webhook URL" field, not one per product).
 * This Paystack account is shared across multiple products: Web3tribe University
 * (donations + W3TR purchases) and BizDoc (subscription activation + marketer
 * commissions) — confirmed by finding BizDoc's actual
 * app/api/subscription/activate/route.ts, which is the real code behind the
 * previously-configured webhook URL (a prior assumption that this was
 * charitytoken.net turned out to be wrong — that codebase has no Paystack
 * integration at all).
 *
 * Because of that constraint, this is the ONE route that should be configured as the
 * Live Webhook URL: https://yourdomain.com/api/payments/webhook
 *
 * It verifies the signature and transaction ONCE, then tries each payment type in
 * turn:
 *   1. BizDoc subscriptions — identified by metadata.user_id being present (BizDoc
 *      sets this when it initializes the transaction). Checked first since it's a
 *      cheap property check, no database round-trip needed to rule it out.
 *   2. W3TR purchases — identified by the reference matching a row in
 *      Web3tribe University's own w3tr_purchases table.
 *   3. Donations — identified by the reference matching a row in Web3tribe
 *      University's own donations table.
 *
 * BizDoc's logic writes to BizDoc's OWN, separate Supabase project (see
 * lib/supabase/bizdoc-admin.ts and lib/payments/confirm-bizdoc-subscription.ts) —
 * it is a completely different database from Web3tribe University's, reached via
 * BIZDOC_SUPABASE_URL / BIZDOC_SUPABASE_SERVICE_ROLE_KEY env vars set directly in
 * this project's deployment (never committed to the repo).
 *
 * The individual /api/donations/paystack/webhook and /api/w3tr/purchase/webhook
 * routes still exist and still work correctly if called directly, but Paystack
 * itself will only ever call whichever single URL is configured in its dashboard —
 * so once that's switched to this route, those two become dead code for live
 * traffic (kept only in case something needs to call that specific logic directly).
 * =====================================================================================
 */
export async function POST(request: Request) {
  const rawBody = await request.text();
  const signature = request.headers.get("x-paystack-signature");

  const isValid = await verifyPaystackWebhookSignature(rawBody, signature);
  if (!isValid) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  const event = JSON.parse(rawBody) as {
    event: string;
    data: { reference: string; metadata?: { user_id?: string; plan?: string } };
  };

  if (event.event === "charge.success") {
    try {
      const verification = await verifyPaystackTransaction(event.data.reference);
      if (verification.status === "success") {
        const reference = event.data.reference;

        const handledAsBizdocSubscription = await confirmBizdocSubscription(event.data);
        if (handledAsBizdocSubscription) return NextResponse.json({ received: true, handledAs: "bizdoc_subscription" });

        const admin = createAdminClient();

        const handledAsW3trPurchase = await confirmW3trPurchaseByReference(admin, reference);
        if (handledAsW3trPurchase) return NextResponse.json({ received: true, handledAs: "w3tr_purchase" });

        const handledAsDonation = await confirmDonationByReference(admin, reference);
        if (handledAsDonation) return NextResponse.json({ received: true, handledAs: "donation" });

        console.warn(`Paystack webhook: reference "${reference}" did not match any known payment type.`);
      }
    } catch (e) {
      console.error("Consolidated Paystack webhook verification failed:", e);
      return NextResponse.json({ error: "Verification failed" }, { status: 500 });
    }
  }

  return NextResponse.json({ received: true });
}