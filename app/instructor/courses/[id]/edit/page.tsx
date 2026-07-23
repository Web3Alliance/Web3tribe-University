import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile, isAdmin } from "@/lib/rbac";
import { CourseDetailsForm } from "@/components/course/course-details-form";
import { CurriculumBuilder } from "@/components/course/curriculum-builder";
import { CourseResourcesManager } from "@/components/course/course-resources-manager";
import { SubmitForReviewButton } from "@/components/course/submit-for-review-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Users } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { Course, Quiz, QuizQuestion } from "@/lib/types";

const STATUS_VARIANTS: Record<string, "secondary" | "warning" | "success" | "destructive" | "outline"> = {
  draft: "outline",
  pending_review: "warning",
  changes_requested: "destructive",
  approved: "secondary",
  published: "success",
  rejected: "destructive",
  archived: "outline",
};

type QuizWithQuestions = Quiz & { quiz_questions: QuizQuestion[] };

export default async function EditCoursePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const profile = await getCurrentProfile();
  const supabase = await createClient();

  const { data: course } = await supabase.from("courses").select("*").eq("id", id).single();
  if (!course) notFound();
  if (course.instructor_id !== profile!.id && !isAdmin(profile)) {
    redirect("/instructor/courses");
  }

  const [{ data: categories }, { data: sections }, { data: moderationLog }, { data: quizzes }, { data: resources }] =
    await Promise.all([
      supabase.from("categories").select("*").eq("is_active", true).order("display_order"),
      supabase
        .from("course_sections")
        .select("*, lessons(*)")
        .eq("course_id", id)
        .order("display_order"),
      supabase
        .from("course_moderation_log")
        .select("*, actor:profiles(full_name)")
        .eq("course_id", id)
        .order("created_at", { ascending: false })
        .limit(5),
      supabase
        .from("quizzes")
        .select("*, quiz_questions(*)")
        .eq("course_id", id),
      supabase
        .from("course_resources")
        .select("*")
        .eq("course_id", id)
        .order("display_order"),
    ]);

  const canSubmit = course.status === "draft" || course.status === "changes_requested";

  const quizzesByLessonId: Record<string, QuizWithQuestions> = {};
  let finalExam: QuizWithQuestions | null = null;
  for (const q of (quizzes as QuizWithQuestions[]) ?? []) {
    if (q.is_final_exam) finalExam = q;
    else if (q.lesson_id) quizzesByLessonId[q.lesson_id] = q;
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{course.title}</h1>
          <div className="mt-1 flex items-center gap-2">
            <Badge variant={STATUS_VARIANTS[course.status] ?? "outline"} className="capitalize">
              {course.status.replace("_", " ")}
            </Badge>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" asChild>
            <Link href={`/instructor/courses/${course.id}/students`}>
              <Users className="h-4 w-4" /> Students
            </Link>
          </Button>
          {canSubmit && <SubmitForReviewButton courseId={course.id} />}
        </div>
      </div>

      {course.review_notes && (
        <Card className="border-warning">
          <CardHeader>
            <CardTitle className="text-base">Admin feedback</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm">{course.review_notes}</p>
          </CardContent>
        </Card>
      )}

      <CourseDetailsForm course={course as Course} categories={categories ?? []} />
      <CurriculumBuilder
        courseId={course.id}
        sections={(sections as never) ?? []}
        quizzesByLessonId={quizzesByLessonId}
        finalExam={finalExam}
      />
      <CourseResourcesManager course={course as Course} resources={resources ?? []} />

      {(moderationLog ?? []).length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Moderation history</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            {(moderationLog ?? []).map((log) => (
              <p key={log.id}>
                <span className="capitalize">{log.action.replace("_", " ")}</span> by {log.actor?.full_name ?? "System"}
                {log.notes ? ` — ${log.notes}` : ""}
              </p>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
