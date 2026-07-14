import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/rbac";
import { getRewardEngine } from "@/lib/reward-engine";

export async function POST() {
  const profile = await getCurrentProfile();
  if (!profile) return NextResponse.json({ data: null, error: "Unauthorized" }, { status: 401 });

  const supabase = await createClient();
  const rewardEngine = getRewardEngine(supabase);

  try {
    const result = await rewardEngine.recordDailyLogin(profile.id);
    return NextResponse.json({ data: result, error: null });
  } catch (e) {
    return NextResponse.json({ data: null, error: e instanceof Error ? e.message : "Failed to record login." }, { status: 500 });
  }
}
