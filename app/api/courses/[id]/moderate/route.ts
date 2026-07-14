import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/rbac";
import { getRewardEngine } from "@/lib/reward-engine";

interface ModerateBody {
  action: "approve" | "reject" | "request_changes";
  notes?: string;
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: courseId } = await params;
  const profile = await requireRole("moderator");
  if (!profile) return NextResponse.json({ data: null, error: "Forbidden" }, { status: 403 });

  const body = (await request.json()) as ModerateBody;
  const supabase = await createClient();

  const statusMap = { approve: "published", reject: "rejected", request_changes: "changes_requested" } as const;
  const newStatus = statusMap[body.action];
  if (!newStatus) return NextResponse.json({ data: null, error: "Invalid action." }, { status: 400 });

  const update: Record<string, unknown> = {
    status: newStatus,
    reviewed_at: new Date().toISOString(),
    reviewed_by: profile.id,
    review_notes: body.notes || null,
  };
  if (newStatus === "published") update.published_at = new Date().toISOString();

  const { error } = await supabase.from("courses").update(update).eq("id", courseId);
  if (error) return NextResponse.json({ data: null, error: error.message }, { status: 500 });

  await supabase.from("course_moderation_log").insert({
    course_id: courseId,
    actor_profile_id: profile.id,
    action: body.action,
    notes: body.notes || null,
  });

  if (body.action === "approve") {
    const { data: course } = await supabase.from("courses").select("instructor_id,title").eq("id", courseId).single();
    if (course) {
      const rewardEngine = getRewardEngine(supabase);
      await rewardEngine.award(course.instructor_id, "course_publish_bonus", 100, {
        referenceTable: "courses",
        referenceId: courseId,
        description: `"${course.title}" approved and published`,
      });
    }
  }

  return NextResponse.json({ data: { success: true, status: newStatus }, error: null });
}
