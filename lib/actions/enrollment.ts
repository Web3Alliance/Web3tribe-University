"use server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/rbac";

export async function enrollInCourse(courseId: string, courseSlug: string) {
  const profile = await getCurrentProfile();
  if (!profile) return { error: "You must be logged in to enroll." };

  const supabase = await createClient();

  // Platform rule: a student can only have one course actively in progress
  // at a time. Check for any *other* active enrollment before allowing a
  // new one — "active" specifically, not "completed" or "dropped", since
  // finishing or dropping a course is exactly what frees a student up to
  // start a new one.
  const { data: activeElsewhereRows } = await supabase
    .from("enrollments")
    .select("course_id, courses(title, slug)")
    .eq("student_id", profile.id)
    .eq("status", "active")
    .neq("course_id", courseId)
    .limit(1);

  const activeElsewhere = activeElsewhereRows?.[0];

  if (activeElsewhere) {
    const coursesField = activeElsewhere.courses as unknown;
    const activeCourse = Array.isArray(coursesField)
      ? (coursesField as { title: string; slug: string }[])[0]
      : (coursesField as { title: string; slug: string } | null);
    return {
      error: `Finish or drop "${activeCourse?.title ?? "your current course"}" before enrolling in a new one — you can only have one course in progress at a time.`,
    };
  }

  // Check for an existing row for this exact course first, rather than just
  // inserting and swallowing a duplicate-key error: a student re-enrolling
  // after previously dropping this same course needs their existing row
  // flipped back to "active", not silently ignored (the old code did the
  // latter — it caught the duplicate-key error and returned success without
  // ever actually reactivating the enrollment).
  const { data: existing } = await supabase
    .from("enrollments")
    .select("id, status")
    .eq("student_id", profile.id)
    .eq("course_id", courseId)
    .maybeSingle();

  if (existing) {
    if (existing.status === "active") return { error: "You're already enrolled in this course." };
    if (existing.status === "completed") return { error: "You've already completed this course." };
    // status === "dropped" — reactivate it.
    const { error } = await supabase.from("enrollments").update({ status: "active" }).eq("id", existing.id);
    if (error) return { error: error.message };
    revalidatePath(`/student/courses/${courseSlug}`);
    return { error: null };
  }

  const { error } = await supabase.from("enrollments").insert({
    student_id: profile.id,
    course_id: courseId,
  });

  if (error) return { error: error.message };

  revalidatePath(`/student/courses/${courseSlug}`);
  return { error: null };
}

/**
 * Lets a student voluntarily drop a course they're actively enrolled in,
 * freeing them up to enroll in a different one under the one-course-at-a-time
 * rule above. This is the essential companion to that rule — without an
 * escape hatch like this, a student who started the wrong course (or simply
 * changed their mind) would be permanently locked out of enrolling in
 * anything else. Dropping does NOT claw back any W3TR the student already
 * earned from lessons/quizzes completed before dropping — that history is
 * theirs regardless of whether they finish the course.
 */
export async function dropCourseAction(courseId: string, courseSlug: string) {
  const profile = await getCurrentProfile();
  if (!profile) return { error: "You must be logged in." };

  const supabase = await createClient();
  const { data: enrollment } = await supabase
    .from("enrollments")
    .select("id, status")
    .eq("student_id", profile.id)
    .eq("course_id", courseId)
    .maybeSingle();

  if (!enrollment) return { error: "You're not enrolled in this course." };
  if (enrollment.status === "completed") return { error: "You've already completed this course." };

  const { error } = await supabase
    .from("enrollments")
    .update({ status: "dropped" })
    .eq("id", enrollment.id);

  if (error) return { error: error.message };

  revalidatePath(`/student/courses/${courseSlug}`);
  revalidatePath("/student/dashboard");
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