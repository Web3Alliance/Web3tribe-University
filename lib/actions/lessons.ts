"use server";
import { revalidatePath } from "next/cache";
import { getCurrentProfile } from "@/lib/rbac";
import { completeLessonForStudent } from "@/lib/lesson-completion";

export async function completeLessonAction(enrollmentId: string, lessonId: string, courseSlug: string) {
  const profile = await getCurrentProfile();
  if (!profile) return { error: "You must be logged in." };

  // SECURITY: server actions are public POST endpoints, so the enrolment must be proven to
  // belong to the caller (and the lesson to its course) before anything is paid out.
  const result = await completeLessonForStudent({ studentId: profile.id, enrollmentId, lessonId });
  if (!result.ok) return { error: result.error };

  revalidatePath(`/student/courses/${courseSlug}`);
  revalidatePath("/student/dashboard");
  return { error: null };
}
