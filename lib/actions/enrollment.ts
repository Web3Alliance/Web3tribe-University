"use server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/rbac";

export async function enrollInCourse(courseId: string, courseSlug: string) {
  const profile = await getCurrentProfile();
  if (!profile) return { error: "You must be logged in to enroll." };

  const supabase = await createClient();
  const { error } = await supabase.from("enrollments").insert({
    student_id: profile.id,
    course_id: courseId,
  });

  if (error && !error.message.includes("duplicate")) {
    return { error: error.message };
  }

  revalidatePath(`/student/courses/${courseSlug}`);
  return { error: null };
}

export async function toggleWishlist(courseId: string, courseSlug: string, isWishlisted: boolean) {
  const profile = await getCurrentProfile();
  if (!profile) return { error: "You must be logged in." };

  const supabase = await createClient();
  if (isWishlisted) {
    await supabase.from("wishlists").delete().eq("student_id", profile.id).eq("course_id", courseId);
  } else {
    await supabase.from("wishlists").insert({ student_id: profile.id, course_id: courseId });
  }
  revalidatePath(`/student/courses/${courseSlug}`);
  return { error: null };
}

export async function submitCourseReview(courseId: string, courseSlug: string, rating: number, reviewText: string) {
  const profile = await getCurrentProfile();
  if (!profile) return { error: "You must be logged in." };

  const supabase = await createClient();
  const { error } = await supabase.from("course_reviews").upsert(
    { course_id: courseId, student_id: profile.id, rating, review_text: reviewText },
    { onConflict: "course_id,student_id" }
  );
  if (error) return { error: error.message };

  revalidatePath(`/student/courses/${courseSlug}`);
  return { error: null };
}
