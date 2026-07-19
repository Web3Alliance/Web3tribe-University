import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyPaystackWebhookSignature, verifyPaystackTransaction } from "@/lib/paystack";
import { confirmW3trPurchaseByReference } from "@/lib/payments/confirm-w3tr-purchase";

/**
 * Paystack webhook receiver for W3TR token purchases.
 *
 * IMPORTANT: Paystack only supports ONE webhook URL per account, and this
 * account is shared with other products (donations, charitytoken.net). See
 * app/api/payments/webhook/route.ts — THAT is the one route that should
 * actually be configured in Paystack's dashboard going forward. This route
 * still works correctly if called directly, but Paystack itself will only
 * ever hit whichever single URL is configured there.
 *
 * Uses the admin (service-role) client because webhooks arrive with no user
 * session — signature verification below is what authorizes the write, not
 * RLS.
 */
export async function POST(request: Request) {
  const rawBody = await request.text();
  const signature = request.headers.get("x-paystack-signature");

  const isValid = await verifyPaystackWebhookSignature(rawBody, signature);
  if (!isValid) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  const event = JSON.parse(rawBody) as { event: string; data: { reference: string } };

  if (event.event === "charge.success") {
    try {
      const verification = await verifyPaystackTransaction(event.data.reference);
      if (verification.status === "success") {
        const admin = createAdminClient();
        await confirmW3trPurchaseByReference(admin, event.data.reference);
      }
    } catch (e) {
      console.error("W3TR purchase webhook verification failed:", e);
      return NextResponse.json({ error: "Verification failed" }, { status: 500 });
    }
  }

  return NextResponse.json({ received: true });
}