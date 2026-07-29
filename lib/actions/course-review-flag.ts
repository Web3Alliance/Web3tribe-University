import type { SupabaseClient } from "@supabase/supabase-js";
import { notifyUser, notifyAdmins } from "@/lib/notify";

/**
 * A published course previously stayed live and fully unmoderated no
 * matter what an instructor changed afterward — title, price, curriculum,
 * quiz questions, anything. That meant admin approval only ever meant
 * something at the moment of first publish, not for the lifetime of the
 * course. This flips a published course back to "pending_review" the
 * moment its OWNER (not an admin) edits its content again, so every
 * version of the course a student sees has actually been reviewed.
 *
 * Admin edits never trigger this — an admin acting on a course is already
 * the review, not something that needs re-reviewing.
 *
 * Call this from every instructor-facing action that changes a published
 * course's content: details, curriculum (sections/lessons/resources), and
 * quizzes/questions. Safe to call even when the course isn't published —
 * it's a no-op for courses in any other status.
 */
export async function flagCourseForReReviewIfPublished(
  supabase: SupabaseClient,
  courseId: string,
  actorIsAdmin: boolean
): Promise<void> {
  if (actorIsAdmin) return;

  const { data: course } = await supabase.from("courses").select("status, title, instructor_id").eq("id", courseId).single();
  if (!course || course.status !== "published") return;

  await supabase
    .from("courses")
    .update({
      status: "pending_review",
      // Clear the prior review decision — a fresh edit needs a fresh
      // decision, not the old approval notes hanging around looking current.
      reviewed_at: null,
      reviewed_by: null,
      review_notes: null,
    })
    .eq("id", courseId);

  await notifyUser({
    profileId: course.instructor_id,
    title: "Course resubmitted for review",
    body: `Your edit to "${course.title}" has taken it back off the catalog until an admin reviews the change. Students already enrolled keep their access.`,
    linkUrl: `/instructor/courses/${courseId}/edit`,
  });

  await notifyAdmins({
    title: "Course needs re-review",
    body: `"${course.title}" was edited by its instructor and has been pulled back from the catalog pending your review.`,
    linkUrl: "/admin/courses",
  });
}
