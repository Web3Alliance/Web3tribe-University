import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/rbac";
import { getRewardEngine } from "@/lib/reward-engine";

interface CompleteLessonBody {
  enrollmentId: string;
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: lessonId } = await params;
  const profile = await getCurrentProfile();
  if (!profile) return NextResponse.json({ data: null, error: "Unauthorized" }, { status: 401 });

  const body = (await request.json()) as CompleteLessonBody;
  if (!body.enrollmentId) return NextResponse.json({ data: null, error: "enrollmentId is required." }, { status: 400 });

  const supabase = await createClient();

  const { data: enrollment } = await supabase
    .from("enrollments")
    .select("student_id")
    .eq("id", body.enrollmentId)
    .single();
  if (!enrollment || enrollment.student_id !== profile.id) {
    return NextResponse.json({ data: null, error: "Forbidden" }, { status: 403 });
  }

  const rewardEngine = getRewardEngine(supabase);
  try {
    await rewardEngine.completeLesson(body.enrollmentId, lessonId);
  } catch (e) {
    return NextResponse.json({ data: null, error: e instanceof Error ? e.message : "Failed to complete lesson." }, { status: 500 });
  }

  return NextResponse.json({ data: { success: true }, error: null });
}
