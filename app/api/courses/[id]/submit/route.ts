import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile, isAdmin } from "@/lib/rbac";

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: courseId } = await params;
  const profile = await getCurrentProfile();
  if (!profile) return NextResponse.json({ data: null, error: "Unauthorized" }, { status: 401 });

  const supabase = await createClient();
  const { data: course } = await supabase.from("courses").select("instructor_id").eq("id", courseId).single();
  if (!course) return NextResponse.json({ data: null, error: "Course not found." }, { status: 404 });
  if (course.instructor_id !== profile.id && !isAdmin(profile)) {
    return NextResponse.json({ data: null, error: "Forbidden" }, { status: 403 });
  }

  const { data: sections } = await supabase
    .from("courses")
    .select("id, course_sections(id, lessons(id, title))")
    .eq("id", courseId)
    .single();

  const allLessons = (sections?.course_sections ?? []).flatMap((s: { lessons: { id: string; title: string }[] }) => s.lessons ?? []);
  if (allLessons.length === 0) {
    return NextResponse.json({ data: null, error: "Add at least one lesson before submitting." }, { status: 400 });
  }

  const { data: quizzes } = await supabase
    .from("quizzes")
    .select("id, lesson_id, quiz_questions(id)")
    .eq("course_id", courseId)
    .eq("is_final_exam", false);

  const quizByLessonId = new Map((quizzes ?? []).map((q) => [q.lesson_id, q]));
  const lessonsMissingQuiz = allLessons.filter((l: { id: string }) => {
    const quiz = quizByLessonId.get(l.id);
    return !quiz || !quiz.quiz_questions || quiz.quiz_questions.length === 0;
  });

  if (lessonsMissingQuiz.length > 0) {
    const names = lessonsMissingQuiz.map((l: { title: string }) => `"${l.title}"`).join(", ");
    return NextResponse.json(
      { data: null, error: `Every lesson needs a quiz with at least one question before you can submit. Missing quiz questions on: ${names}.` },
      { status: 400 }
    );
  }

  const { error } = await supabase
    .from("courses")
    .update({ status: "pending_review", submitted_for_review_at: new Date().toISOString() })
    .eq("id", courseId);
  if (error) return NextResponse.json({ data: null, error: error.message }, { status: 500 });

  await supabase.from("course_moderation_log").insert({ course_id: courseId, actor_profile_id: profile.id, action: "submit" });

  return NextResponse.json({ data: { success: true }, error: null });
}
