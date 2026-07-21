import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Returns the subset of `courseIds` a student has GENUINELY completed —
 * meaning enrollment status is "completed" AND, for any course that has a
 * final exam, that exam was actually passed.
 *
 * Enrollment status alone flips to "completed" once every lesson is
 * finished; it says nothing about whether a final exam was passed. The
 * certificate-generation route already enforces the exam check before
 * issuing a certificate — this helper applies that exact same bar so
 * "completed" means the same thing everywhere a course's completion is used
 * to make a decision (certificates, opportunity matching, and anywhere
 * else that follows). Keep this as the ONE place that logic lives; do not
 * re-implement the enrollment-only check inline elsewhere.
 */
export async function getGenuinelyCompletedCourseIds(
  supabase: SupabaseClient,
  studentId: string,
  courseIds: string[]
): Promise<Set<string>> {
  if (courseIds.length === 0) return new Set();

  const { data: completedEnrollments } = await supabase
    .from("enrollments")
    .select("course_id")
    .eq("student_id", studentId)
    .eq("status", "completed")
    .in("course_id", courseIds);

  const completedCourseIds = new Set((completedEnrollments ?? []).map((e) => e.course_id));
  if (completedCourseIds.size === 0) return completedCourseIds;

  const { data: finalExams } = await supabase
    .from("quizzes")
    .select("id, course_id")
    .eq("is_final_exam", true)
    .in("course_id", Array.from(completedCourseIds));

  const finalExamByCourseId = new Map((finalExams ?? []).map((q) => [q.course_id as string, q.id as string]));
  const finalExamIds = Array.from(finalExamByCourseId.values());

  const passedFinalExamIds = new Set<string>();
  if (finalExamIds.length) {
    const { data: passedAttempts } = await supabase
      .from("quiz_attempts")
      .select("quiz_id")
      .eq("student_id", studentId)
      .eq("passed", true)
      .in("quiz_id", finalExamIds);
    (passedAttempts ?? []).forEach((a) => passedFinalExamIds.add(a.quiz_id));
  }

  const genuinelyCompleted = new Set<string>();
  for (const courseId of completedCourseIds) {
    const finalExamId = finalExamByCourseId.get(courseId);
    if (!finalExamId || passedFinalExamIds.has(finalExamId)) {
      genuinelyCompleted.add(courseId);
    }
  }
  return genuinelyCompleted;
}
