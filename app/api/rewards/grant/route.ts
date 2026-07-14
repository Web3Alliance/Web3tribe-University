import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/rbac";
import { getRewardEngine } from "@/lib/reward-engine";

interface GrantBody {
  profileId: string;
  amount: number;
  description: string;
}

export async function POST(request: Request) {
  const profile = await requireRole("admin");
  if (!profile) return NextResponse.json({ data: null, error: "Forbidden" }, { status: 403 });

  const body = (await request.json()) as GrantBody;
  if (!body.profileId || !body.amount) {
    return NextResponse.json({ data: null, error: "profileId and amount are required." }, { status: 400 });
  }

  const supabase = await createClient();
  const rewardEngine = getRewardEngine(supabase);

  try {
    const tx = await rewardEngine.award(body.profileId, body.amount > 0 ? "admin_grant" : "admin_deduction", body.amount, {
      description: body.description,
      awardedBy: profile.id,
    });

    await supabase.from("audit_logs").insert({
      actor_profile_id: profile.id,
      action: "reward.manual_grant",
      target_table: "w3tr_transactions",
      target_id: body.profileId,
      metadata: { amount: body.amount, description: body.description },
    });

    return NextResponse.json({ data: tx, error: null });
  } catch (e) {
    return NextResponse.json({ data: null, error: e instanceof Error ? e.message : "Failed to grant reward." }, { status: 500 });
  }
}
