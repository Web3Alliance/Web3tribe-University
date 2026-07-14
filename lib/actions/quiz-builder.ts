"use server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile, isAdmin } from "@/lib/rbac";
import { TOKENOMICS } from "@/lib/tokenomics";

async function assertOwnsCourseOrAdmin(courseId: string) {
  const profile = await getCurrentProfile();
  if (!profile) return { profile: null, ok: false, supabase: null };
  const supabase = await createClient();
  const { data: course } = await supabase.from("courses").select("instructor_id").eq("id", courseId).single();
  const ok = !!course && (course.instructor_id === profile.id || isAdmin(profile));
  return { profile, ok, supabase };
}

/**
 * Creates a quiz tied to a specific lesson. Passing score and reward are fixed
 * platform-wide (see lib/tokenomics.ts) — instructors only supply the title.
 * Retakes are effectively unlimited (TOKENOMICS.MAX_QUIZ_ATTEMPTS) so a failed
 * quiz can always be retried.
 */
export async function addLessonQuizAction(courseId: string, lessonId: string, title: string) {
  const { ok, supabase } = await assertOwnsCourseOrAdmin(courseId);
  if (!ok || !supabase) return { error: "Not authorized." };

  const { data: existing } = await supabase.from("quizzes").select("id").eq("lesson_id", lessonId).maybeSingle();
  if (existing) return { error: "This lesson already has a quiz." };

  const { error } = await supabase.from("quizzes").insert({
    course_id: courseId,
    lesson_id: lessonId,
    is_final_exam: false,
    title,
    passing_score_percent: TOKENOMICS.DEFAULT_PASSING_SCORE_PERCENT,
    w3tr_reward: TOKENOMICS.LESSON_QUIZ_PASS_REWARD,
    max_attempts: TOKENOMICS.MAX_QUIZ_ATTEMPTS,
  });
  if (error) return { error: error.message };

  revalidatePath(`/instructor/courses/${courseId}/edit`);
  return { error: null };
}

/**
 * Creates (or ensures) the single course-wide final exam. Only one final exam
 * is allowed per course.
 */
export async function addFinalExamAction(courseId: string, title: string) {
  const { ok, supabase } = await assertOwnsCourseOrAdmin(courseId);
  if (!ok || !supabase) return { error: "Not authorized." };

  const { data: existing } = await supabase
    .from("quizzes")
    .select("id")
    .eq("course_id", courseId)
    .eq("is_final_exam", true)
    .maybeSingle();
  if (existing) return { error: "This course already has a final exam." };

  const { error } = await supabase.from("quizzes").insert({
    course_id: courseId,
    is_final_exam: true,
    title,
    passing_score_percent: TOKENOMICS.DEFAULT_PASSING_SCORE_PERCENT,
    w3tr_reward: TOKENOMICS.FINAL_EXAM_PASS_REWARD,
    max_attempts: TOKENOMICS.MAX_QUIZ_ATTEMPTS,
  });
  if (error) return { error: error.message };

  revalidatePath(`/instructor/courses/${courseId}/edit`);
  return { error: null };
}

export async function deleteQuizAction(courseId: string, quizId: string) {
  const { ok, supabase } = await assertOwnsCourseOrAdmin(courseId);
  if (!ok || !supabase) return { error: "Not authorized." };
  await supabase.from("quizzes").delete().eq("id", quizId);
  revalidatePath(`/instructor/courses/${courseId}/edit`);
  return { error: null };
}

interface AddQuestionInput {
  questionText: string;
  options: { id: string; text: string }[];
  correctOptionId: string;
}

export async function addQuizQuestionAction(courseId: string, quizId: string, input: AddQuestionInput) {
  const { ok, supabase } = await assertOwnsCourseOrAdmin(courseId);
  if (!ok || !supabase) return { error: "Not authorized." };

  if (input.options.length < 2) return { error: "A question needs at least 2 options." };
  if (!input.options.some((o) => o.id === input.correctOptionId)) {
    return { error: "Correct answer must match one of the provided options." };
  }

  const { count } = await supabase.from("quiz_questions").select("*", { count: "exact", head: true }).eq("quiz_id", quizId);

  const { error } = await supabase.from("quiz_questions").insert({
    quiz_id: quizId,
    question_text: input.questionText,
    question_type: "single_choice",
    options: input.options,
    correct_answer: input.correctOptionId,
    points: 1,
    display_order: (count ?? 0) + 1,
  });
  if (error) return { error: error.message };

  revalidatePath(`/instructor/courses/${courseId}/edit`);
  return { error: null };
}

export async function deleteQuizQuestionAction(courseId: string, questionId: string) {
  const { ok, supabase } = await assertOwnsCourseOrAdmin(courseId);
  if (!ok || !supabase) return { error: "Not authorized." };
  await supabase.from("quiz_questions").delete().eq("id", questionId);
  revalidatePath(`/instructor/courses/${courseId}/edit`);
  return { error: null };
}
