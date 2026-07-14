"use server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/rbac";
import { getRewardEngine } from "@/lib/reward-engine";

export async function completeLessonAction(enrollmentId: string, lessonId: string, courseSlug: string) {
  const profile = await getCurrentProfile();
  if (!profile) return { error: "You must be logged in." };

  const supabase = await createClient();
  const rewardEngine = getRewardEngine(supabase);

  try {
    await rewardEngine.completeLesson(enrollmentId, lessonId);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Failed to complete lesson." };
  }

  revalidatePath(`/student/courses/${courseSlug}`);
  revalidatePath("/student/dashboard");
  return { error: null };
}
