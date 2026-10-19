import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import { getRewardEngine } from "@/lib/reward-engine";

export type CompleteLessonResult =
  | { ok: true }
  | { ok: false; status: 400 | 403 | 404 | 500; error: string };

/**
 * The ONE place that decides "this student really has finished this lesson".
 * Both the API route and the server action call it, so the rule can't drift.
 *
 * Why it exists: completing a lesson pays out W3TR and moves the enrolment towards
 * 100% (which unlocks the certificate), and the database function that does it is
 * server-only (migration 0022). Server-side we must therefore prove, BEFORE calling it:
 *   1. the enrolment exists and belongs to the authenticated student (not someone else's), and
 *   2. the lesson belongs to the enrolment's course (not a lesson from a different/paid course).
 *
 * `studentId` MUST come from the verified session (getCurrentProfile), never from the request.
 */
export async function completeLessonForStudent(
  params: { studentId: string; enrollmentId: string; lessonId: string },
  deps: { admin?: SupabaseClient } = {}
): Promise<CompleteLessonResult> {
  const { studentId, enrollmentId, lessonId } = params;
  const admin = deps.admin ?? createAdminClient();

  const { data: enrollment } = await admin
    .from("enrollments")
    .select("id, student_id, course_id")
    .eq("id", enrollmentId)
    .maybeSingle();

  if (!enrollment) return { ok: false, status: 404, error: "Enrollment not found." };
  if (enrollment.student_id !== studentId) return { ok: false, status: 403, error: "Forbidden" };

  const { data: lesson } = await admin
    .from("lessons")
    .select("id, course_id")
    .eq("id", lessonId)
    .maybeSingle();

  if (!lesson || lesson.course_id !== enrollment.course_id) {
    return { ok: false, status: 400, error: "That lesson doesn't belong to the course you're enrolled in." };
  }

  try {
    await getRewardEngine(admin, admin).completeLesson(enrollmentId, lessonId);
  } catch (e) {
    return { ok: false, status: 500, error: e instanceof Error ? e.message : "Failed to complete lesson." };
  }
  return { ok: true };
}
