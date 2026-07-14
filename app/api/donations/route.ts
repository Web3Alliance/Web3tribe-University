import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/rbac";
import { initializePaystackTransaction } from "@/lib/paystack";

interface CreateDonationBody {
  campaignId?: string;
  amount: number;
  currency?: string;
  method: "card" | "bank_transfer" | "paystack" | "flutterwave" | "manual";
  donorName?: string;
  donorEmail: string;
  isAnonymous?: boolean;
}

export async function POST(request: Request) {
  const body = (await request.json()) as CreateDonationBody;
  if (!body.amount || body.amount <= 0) {
    return NextResponse.json({ data: null, error: "A valid donation amount is required." }, { status: 400 });
  }
  if (!body.donorEmail) {
    return NextResponse.json({ data: null, error: "Donor email is required." }, { status: 400 });
  }

  const profile = await getCurrentProfile(); // may be null — guests can donate
  const supabase = await createClient();

  const { data: donation, error } = await supabase
    .from("donations")
    .insert({
      campaign_id: body.campaignId ?? null,
      donor_id: profile?.id ?? null,
      donor_name: body.isAnonymous ? null : body.donorName ?? profile?.full_name ?? null,
      donor_email: body.donorEmail,
      is_anonymous: !!body.isAnonymous,
      amount: body.amount,
      currency: body.currency ?? "NGN",
      method: body.method,
      status: "pending",
    })
    .select()
    .single();

  if (error || !donation) {
    return NextResponse.json({ data: null, error: error?.message ?? "Failed to record donation." }, { status: 500 });
  }

  if (body.method === "paystack") {
    try {
      const paystackData = await initializePaystackTransaction({
        email: body.donorEmail,
        amountKobo: Math.round(body.amount * 100),
        reference: donation.id,
        callbackUrl: `${process.env.NEXT_PUBLIC_SITE_URL}/donate/thank-you`,
        metadata: { donationId: donation.id },
      });

      await supabase.from("donations").update({ provider_reference: paystackData.reference }).eq("id", donation.id);

      return NextResponse.json({ data: { donation, authorizationUrl: paystackData.authorization_url }, error: null });
    } catch (e) {
      return NextResponse.json({ data: { donation }, error: e instanceof Error ? e.message : "Paystack error." }, { status: 502 });
    }
  }

  // manual / bank_transfer / other methods: recorded as pending, an admin confirms
  // it later from /admin/donations once funds are verified to have arrived.
  return NextResponse.json({ data: { donation }, error: null });
}
