"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile, isAdmin } from "@/lib/rbac";
import { slugify } from "@/lib/utils";
import { flagCourseForReReviewIfPublished } from "@/lib/actions/course-review-flag";
import { notifyAdmins } from "@/lib/notify";

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
  const { ok, profile, supabase } = await assertOwnsCourseOrAdmin(courseId);
  if (!ok || !supabase) return { error: "Not authorized." };

  const title = String(formData.get("title") || "");
  const subtitle = String(formData.get("subtitle") || "");
  const description = String(formData.get("description") || "");
  const level = String(formData.get("level") || "beginner");
  const categoryId = String(formData.get("categoryId") || "") || null;
  const priceW3tr = Number(formData.get("priceW3tr") || 0);
  const estimatedHours = formData.get("estimatedHours") ? Number(formData.get("estimatedHours")) : null;
  const thumbnailUrl = String(formData.get("thumbnailUrl") || "") || null;
  // Delivery mode is decided once here, by the course's original author (this
  // action is already gated to them via assertOwnsCourseOrAdmin above), and
  // every cohort later started for this course inherits it — a cohort
  // instructor cannot pick a different mode. Enforced at the database level
  // too (see 0006_delivery_mode_on_course.sql) as the real source of truth.
  const deliveryMode = String(formData.get("deliveryMode") || "online");
  const requirements = String(formData.get("requirements") || "")
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);
  const learningOutcomes = String(formData.get("learningOutcomes") || "")
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);

  // Fetch the current stored values first — this form always resubmits the
  // FULL set of fields on every save, even when the instructor opened it and
  // changed nothing at all. Without this comparison, that harmless no-op save
  // was pulling a live, published course back into review every single time,
  // which is a real cost to an instructor (and to admins reviewing a queue
  // full of resubmissions with no actual content change behind them).
  const { data: before } = await supabase
    .from("courses")
    .select("title, subtitle, description, level, category_id, price_w3tr, estimated_hours, thumbnail_url, delivery_mode, requirements, learning_outcomes")
    .eq("id", courseId)
    .single();

  const after = {
    title,
    subtitle,
    description,
    level,
    category_id: categoryId,
    price_w3tr: priceW3tr,
    estimated_hours: estimatedHours,
    thumbnail_url: thumbnailUrl,
    delivery_mode: deliveryMode,
    requirements,
    learning_outcomes: learningOutcomes,
  };
  const somethingActuallyChanged = !before || JSON.stringify(before) !== JSON.stringify(after);

  const { error } = await supabase
    .from("courses")
    .update({
      ...after,
      // Any cover saved through this instructor-facing form is a deliberate
      // choice — course approval must respect it and skip auto-generation.
      cover_is_custom: !!thumbnailUrl,
    })
    .eq("id", courseId);

  if (error) return { error: error.message };
  if (somethingActuallyChanged) {
    await flagCourseForReReviewIfPublished(supabase, courseId, isAdmin(profile!));
  }
  revalidatePath(`/instructor/courses/${courseId}/edit`);
  return { error: null };
}

export async function addSectionAction(courseId: string, title: string) {
  const { ok, profile, supabase } = await assertOwnsCourseOrAdmin(courseId);
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
  await flagCourseForReReviewIfPublished(supabase, courseId, isAdmin(profile!));
  revalidatePath(`/instructor/courses/${courseId}/edit`);
  return { error: null };
}

export async function deleteSectionAction(courseId: string, sectionId: string) {
  const { ok, profile, supabase } = await assertOwnsCourseOrAdmin(courseId);
  if (!ok || !supabase) return { error: "Not authorized." };
  await supabase.from("course_sections").delete().eq("id", sectionId);
  await flagCourseForReReviewIfPublished(supabase, courseId, isAdmin(profile!));
  revalidatePath(`/instructor/courses/${courseId}/edit`);
}

export async function addLessonAction(
  courseId: string,
  sectionId: string,
  data: { title: string; contentType: string; contentUrl?: string; contentText?: string; isPreview: boolean }
) {
  const { ok, profile, supabase } = await assertOwnsCourseOrAdmin(courseId);
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
  await flagCourseForReReviewIfPublished(supabase, courseId, isAdmin(profile!));
  revalidatePath(`/instructor/courses/${courseId}/edit`);
  return { error: null };
}

export async function deleteLessonAction(courseId: string, lessonId: string) {
  const { ok, profile, supabase } = await assertOwnsCourseOrAdmin(courseId);
  if (!ok || !supabase) return { error: "Not authorized." };
  await supabase.from("lessons").delete().eq("id", lessonId);
  await flagCourseForReReviewIfPublished(supabase, courseId, isAdmin(profile!));
  revalidatePath(`/instructor/courses/${courseId}/edit`);
}

export async function submitCourseForReviewAction(courseId: string) {
  const { ok, supabase, profile } = await assertOwnsCourseOrAdmin(courseId);
  if (!ok || !supabase) return { error: "Not authorized." };

  // A cover image is no longer required to submit for review — instructors
  // may upload their own (preserved permanently, see cover_is_custom) or
  // leave it unset entirely and receive an official auto-generated cover
  // once the course is approved.

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

  const { data: submittedCourse } = await supabase.from("courses").select("title").eq("id", courseId).maybeSingle();
  await notifyAdmins({
    title: "New course submitted for review",
    body: `"${submittedCourse?.title ?? "A course"}" was submitted and is waiting for your review.`,
    linkUrl: "/admin/courses",
  });

  revalidatePath(`/instructor/courses/${courseId}/edit`);
  revalidatePath("/instructor/courses");
  return { error: null };
}

/**
 * Attaches a downloadable resource (slides, worksheet, dataset, etc.) to a
 * lesson. The lesson_resources table and its RLS policies (instructor
 * manage, enrolled-student read) already existed in the schema — this is
 * the first action that actually writes to it. Upload itself happens via
 * the shared /api/upload route before this is called; this action just
 * records the resulting URL against the lesson.
 */
export async function addLessonResourceAction(
  courseId: string,
  lessonId: string,
  data: { title: string; fileUrl: string; fileType: string; fileSizeBytes: number }
) {
  const { ok, profile, supabase } = await assertOwnsCourseOrAdmin(courseId);
  if (!ok || !supabase) return { error: "Not authorized." };

  const { error } = await supabase.from("lesson_resources").insert({
    lesson_id: lessonId,
    title: data.title,
    file_url: data.fileUrl,
    file_type: data.fileType,
    file_size_bytes: data.fileSizeBytes,
  });
  if (error) return { error: error.message };
  await flagCourseForReReviewIfPublished(supabase, courseId, isAdmin(profile!));

  const { data: lesson } = await supabase.from("lessons").select("course_id, courses(slug)").eq("id", lessonId).maybeSingle();
  const courseSlug = (lesson?.courses as { slug: string } | { slug: string }[] | null | undefined) instanceof Array
    ? (lesson?.courses as { slug: string }[])[0]?.slug
    : (lesson?.courses as { slug: string } | null | undefined)?.slug;

  revalidatePath(`/instructor/courses/${courseId}/edit`);
  revalidatePath(`/student/learn/${lessonId}`);
  if (courseSlug) revalidatePath(`/student/courses/${courseSlug}`);
  return { error: null };
}

export async function deleteLessonResourceAction(courseId: string, resourceId: string, lessonId: string) {
  const { ok, profile, supabase } = await assertOwnsCourseOrAdmin(courseId);
  if (!ok || !supabase) return { error: "Not authorized." };

  await supabase.from("lesson_resources").delete().eq("id", resourceId);
  await flagCourseForReReviewIfPublished(supabase, courseId, isAdmin(profile!));

  revalidatePath(`/instructor/courses/${courseId}/edit`);
  revalidatePath(`/student/learn/${lessonId}`);
  return { error: null };
}