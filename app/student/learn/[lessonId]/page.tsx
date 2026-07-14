import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/rbac";
import { LessonPlayer } from "@/components/course/lesson-player";
import { LessonQuizPlayer } from "@/components/course/lesson-quiz-player";
import { CheckCircle2, Circle, PlayCircle } from "lucide-react";
import { cn } from "@/lib/utils";

export default async function LearnLessonPage({ params }: { params: Promise<{ lessonId: string }> }) {
  const { lessonId } = await params;
  const profile = await getCurrentProfile();
  if (!profile) redirect(`/login?redirectTo=/student/learn/${lessonId}`);

  const supabase = await createClient();

  const { data: lesson } = await supabase.from("lessons").select("*, course:courses(id,title,slug)").eq("id", lessonId).single();
  if (!lesson) notFound();

  const { data: enrollment } = await supabase
    .from("enrollments")
    .select("id")
    .eq("student_id", profile.id)
    .eq("course_id", lesson.course_id)
    .maybeSingle();

  if (!enrollment) redirect(`/student/courses/${lesson.course?.slug}`);

  const [{ data: sections }, { data: progressRows }, { data: lessonQuiz }] = await Promise.all([
    supabase
      .from("course_sections")
      .select("*, lessons(id,title,display_order,content_type)")
      .eq("course_id", lesson.course_id)
      .order("display_order"),
    supabase.from("lesson_progress").select("lesson_id,is_completed").eq("enrollment_id", enrollment.id),
    supabase.from("quizzes").select("*, quiz_questions(*)").eq("lesson_id", lessonId).maybeSingle(),
  ]);

  let lastAttempt: { score_percent: number; passed: boolean } | null = null;
  if (lessonQuiz) {
    const { data: attempt } = await supabase
      .from("quiz_attempts")
      .select("score_percent,passed")
      .eq("quiz_id", lessonQuiz.id)
      .eq("student_id", profile.id)
      .order("attempt_number", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (attempt) lastAttempt = { score_percent: Number(attempt.score_percent), passed: attempt.passed };
  }

  const completedSet = new Set((progressRows ?? []).filter((p) => p.is_completed).map((p) => p.lesson_id));

  const flatLessons = (sections ?? [])
    .flatMap((s) => s.lessons ?? [])
    .sort((a: { display_order: number }, b: { display_order: number }) => a.display_order - b.display_order);
  const currentIndex = flatLessons.findIndex((l: { id: string }) => l.id === lessonId);
  const nextLesson = flatLessons[currentIndex + 1];

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
      <div className="space-y-6">
        <Link href={`/student/courses/${lesson.course?.slug}`} className="mb-4 inline-block text-sm text-primary hover:underline">
          ← Back to {lesson.course?.title}
        </Link>
        <LessonPlayer
          lesson={lesson}
          enrollmentId={enrollment.id}
          courseSlug={lesson.course?.slug}
          isCompleted={completedSet.has(lessonId)}
          nextLessonId={nextLesson?.id}
          hasQuiz={!!lessonQuiz && (lessonQuiz.quiz_questions?.length ?? 0) > 0}
        />

        {lessonQuiz && lessonQuiz.quiz_questions && lessonQuiz.quiz_questions.length > 0 && (
          <LessonQuizPlayer
            quiz={lessonQuiz}
            questions={lessonQuiz.quiz_questions}
            lastAttempt={lastAttempt}
            enrollmentId={enrollment.id}
            lessonId={lessonId}
            courseSlug={lesson.course?.slug}
            nextLessonId={nextLesson?.id}
          />
        )}
      </div>

      <aside className="space-y-4">
        <h2 className="font-semibold">Course content</h2>
        <div className="space-y-3">
          {(sections ?? []).map((section) => (
            <div key={section.id}>
              <p className="mb-1 text-xs font-semibold uppercase text-muted-foreground">{section.title}</p>
              <ul className="space-y-1">
                {(section.lessons ?? [])
                  .sort((a: { display_order: number }, b: { display_order: number }) => a.display_order - b.display_order)
                  .map((l: { id: string; title: string }) => (
                    <li key={l.id}>
                      <Link
                        href={`/student/learn/${l.id}`}
                        className={cn(
                          "flex items-center gap-2 rounded-md px-2 py-1.5 text-sm",
                          l.id === lessonId ? "bg-secondary font-medium" : "text-muted-foreground hover:bg-secondary/50"
                        )}
                      >
                        {completedSet.has(l.id) ? (
                          <CheckCircle2 className="h-4 w-4 shrink-0 text-success" />
                        ) : l.id === lessonId ? (
                          <PlayCircle className="h-4 w-4 shrink-0 text-primary" />
                        ) : (
                          <Circle className="h-4 w-4 shrink-0" />
                        )}
                        <span className="line-clamp-1">{l.title}</span>
                      </Link>
                    </li>
                  ))}
              </ul>
            </div>
          ))}
        </div>
      </aside>
    </div>
  );
}
