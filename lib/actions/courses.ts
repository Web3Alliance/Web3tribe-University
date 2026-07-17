"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile, isAdmin } from "@/lib/rbac";
import { slugify } from "@/lib/utils";

export interface CourseFormState {
  error: string | null;
  courseId?: string;
}

async function assertOwnsCourseOrAdmin(courseId: string) {
  const profile = await getCurrentProfile();
  if (!profile) return { profile: null, ok: false };
  const supabase = await createClient();
  const { data: course } = await supabase.from("courses").select("instructor_id").eq("id", courseId).single();
  const ok = !!course && (course.instructor_id === profile.id || isAdmin(profile));
  return { profile, ok, supabase };
}

export async function createCourseAction(_prevState: CourseFormState, formData: FormData): Promise<CourseFormState> {
  const profile = await getCurrentProfile();
  if (!profile || !["instructor", "admin", "super_admin"].includes(profile.role)) {
    return { error: "You must be an instructor to create courses." };
  }

  const title = String(formData.get("title") || "");
  const subtitle = String(formData.get("subtitle") || "");
  const description = String(formData.get("description") || "");
  const level = String(formData.get("level") || "beginner");
  const categoryId = String(formData.get("categoryId") || "") || null;
  const priceW3tr = Number(formData.get("priceW3tr") || 0);

  if (!title) return { error: "Title is required." };

  const supabase = await createClient();
  const baseSlug = slugify(title);
  const uniqueSlug = `${baseSlug}-${Math.random().toString(36).slice(2, 7)}`;

  const { data, error } = await supabase
    .from("courses")
    .insert({
      instructor_id: profile.id,
      title,
      subtitle,
      description,
      level,
      category_id: categoryId,
      price_w3tr: priceW3tr,
      slug: uniqueSlug,
      status: "draft",
    })
    .select("id")
    .single();

  if (error) return { error: error.message };

  revalidatePath("/instructor/courses");
  redirect(`/instructor/courses/${data.id}/edit`);
}

export async function updateCourseDetailsAction(courseId: string, formData: FormData): Promise<CourseFormState> {
  const { ok, supabase } = await assertOwnsCourseOrAdmin(courseId);
  if (!ok || !supabase) return { error: "Not authorized." };

  const title = String(formData.get("title") || "");
  const subtitle = String(formData.get("subtitle") || "");
  const description = String(formData.get("description") || "");
  const level = String(formData.get("level") || "beginner");
  const categoryId = String(formData.get("categoryId") || "") || null;
  const priceW3tr = Number(formData.get("priceW3tr") || 0);
  const estimatedHours = formData.get("estimatedHours") ? Number(formData.get("estimatedHours")) : null;
  const thumbnailUrl = String(formData.get("thumbnailUrl") || "") || null;
  const requirements = String(formData.get("requirements") || "")
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);
  const learningOutcomes = String(formData.get("learningOutcomes") || "")
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);

  const { error } = await supabase
    .from("courses")
    .update({
      title,
      subtitle,
      description,
      level,
      category_id: categoryId,
      price_w3tr: priceW3tr,
      estimated_hours: estimatedHours,
      thumbnail_url: thumbnailUrl,
      requirements,
      learning_outcomes: learningOutcomes,
    })
    .eq("id", courseId);

  if (error) return { error: error.message };
  revalidatePath(`/instructor/courses/${courseId}/edit`);
  return { error: null };
}

export async function addSectionAction(courseId: string, title: string) {
  const { ok, supabase } = await assertOwnsCourseOrAdmin(courseId);
  if (!ok || !supabase) return { error: "Not authorized." };

  const { count } = await supabase
    .from("course_sections")
    .select("*", { count: "exact", head: true })
    .eq("course_id", courseId);

  const { error } = await supabase.from("course_sections").insert({
    course_id: courseId,
    title,
    display_order: (count ?? 0) + 1,
  });
  if (error) return { error: error.message };
  revalidatePath(`/instructor/courses/${courseId}/edit`);
  return { error: null };
}

export async function deleteSectionAction(courseId: string, sectionId: string) {
  const { ok, supabase } = await assertOwnsCourseOrAdmin(courseId);
  if (!ok || !supabase) return { error: "Not authorized." };
  await supabase.from("course_sections").delete().eq("id", sectionId);
  revalidatePath(`/instructor/courses/${courseId}/edit`);
}

export async function addLessonAction(
  courseId: string,
  sectionId: string,
  data: { title: string; contentType: string; contentUrl?: string; contentText?: string; isPreview: boolean }
) {
  const { ok, supabase } = await assertOwnsCourseOrAdmin(courseId);
  if (!ok || !supabase) return { error: "Not authorized." };

  const { count } = await supabase
    .from("lessons")
    .select("*", { count: "exact", head: true })
    .eq("section_id", sectionId);

  // W3TR reward is intentionally NOT set here — it uses the fixed platform-wide
  // default enforced in supabase/migrations/0003_tokenomics_and_resources.sql
  // (see lib/tokenomics.ts for the mirrored display value). Instructors cannot
  // configure this amount.
  const { error } = await supabase.from("lessons").insert({
    section_id: sectionId,
    course_id: courseId,
    title: data.title,
    content_type: data.contentType,
    content_url: data.contentUrl || null,
    content_text: data.contentText || null,
    is_preview: data.isPreview,
    display_order: (count ?? 0) + 1,
  });
  if (error) return { error: error.message };
  revalidatePath(`/instructor/courses/${courseId}/edit`);
  return { error: null };
}

export async function deleteLessonAction(courseId: string, lessonId: string) {
  const { ok, supabase } = await assertOwnsCourseOrAdmin(courseId);
  if (!ok || !supabase) return { error: "Not authorized." };
  await supabase.from("lessons").delete().eq("id", lessonId);
  revalidatePath(`/instructor/courses/${courseId}/edit`);
}

export async function submitCourseForReviewAction(courseId: string) {
  const { ok, supabase, profile } = await assertOwnsCourseOrAdmin(courseId);
  if (!ok || !supabase) return { error: "Not authorized." };

  const { data: courseCheck } = await supabase.from("courses").select("thumbnail_url").eq("id", courseId).single();
  if (!courseCheck?.thumbnail_url) {
    return { error: "Add a cover image before submitting this course for review." };
  }

  const { data: sections } = await supabase
    .from("course_sections")
    .select("id, lessons(id, title)")
    .eq("course_id", courseId);

  const allLessons = (sections ?? []).flatMap((s) => s.lessons ?? []);
  if (allLessons.length === 0) {
    return { error: "Add at least one lesson before submitting for review." };
  }

  // Platform rule: every lesson must have a quiz with at least one question,
  // since lesson completion (and its W3TR reward) requires passing that quiz.
  const { data: quizzes } = await supabase
    .from("quizzes")
    .select("id, lesson_id, is_final_exam, quiz_questions(id)")
    .eq("course_id", courseId);

  const lessonQuizzes = (quizzes ?? []).filter((q) => !q.is_final_exam);
  const finalExam = (quizzes ?? []).find((q) => q.is_final_exam);

  if (finalExam && (finalExam.quiz_questions?.length ?? 0) < 50) {
    return {
      error: `The final exam needs at least 50 questions before this course can be submitted (currently has ${finalExam.quiz_questions?.length ?? 0}).`,
    };
  }

  const quizByLessonId = new Map(lessonQuizzes.map((q) => [q.lesson_id, q]));
  const lessonsMissingQuiz = allLessons.filter((l) => {
    const quiz = quizByLessonId.get(l.id);
    return !quiz || !quiz.quiz_questions || quiz.quiz_questions.length === 0;
  });

  if (lessonsMissingQuiz.length > 0) {
    const names = lessonsMissingQuiz.map((l) => `"${l.title}"`).join(", ");
    return {
      error: `Every lesson needs a quiz with at least one question before you can submit. Missing quiz questions on: ${names}.`,
    };
  }

  const { error } = await supabase
    .from("courses")
    .update({ status: "pending_review", submitted_for_review_at: new Date().toISOString() })
    .eq("id", courseId);
  if (error) return { error: error.message };

  await supabase.from("course_moderation_log").insert({
    course_id: courseId,
    actor_profile_id: profile!.id,
    action: "submit",
  });

  revalidatePath(`/instructor/courses/${courseId}/edit`);
  revalidatePath("/instructor/courses");
  return { error: null };
}