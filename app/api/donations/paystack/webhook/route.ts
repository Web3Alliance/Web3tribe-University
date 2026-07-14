import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyPaystackWebhookSignature, verifyPaystackTransaction } from "@/lib/paystack";

/**
 * Paystack webhook receiver. Configure this URL (https://yourdomain.org/api/donations/paystack/webhook)
 * in your Paystack Dashboard under Settings → API Keys & Webhooks.
 *
 * This route uses the admin (service-role) Supabase client because webhooks arrive
 * with no user session — signature verification below is what authorizes the write,
 * not RLS.
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
        const { data: donation } = await admin
          .from("donations")
          .select("*")
          .eq("provider_reference", event.data.reference)
          .maybeSingle();

        if (donation && donation.status !== "confirmed") {
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
        }
      }
    } catch (e) {
      console.error("Paystack webhook verification failed:", e);
      return NextResponse.json({ error: "Verification failed" }, { status: 500 });
    }
  }

  return NextResponse.json({ received: true });
}
