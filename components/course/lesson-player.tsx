"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CheckCircle2, PlayCircle, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { completeLessonAction } from "@/lib/actions/lessons";
import type { Lesson } from "@/lib/types";

export function LessonPlayer({
  lesson,
  enrollmentId,
  courseSlug,
  isCompleted,
  nextLessonId,
  hasQuiz,
}: {
  lesson: Lesson;
  enrollmentId: string;
  courseSlug: string;
  isCompleted: boolean;
  nextLessonId?: string;
  hasQuiz: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = React.useTransition();
  const [completed, setCompleted] = React.useState(isCompleted);

  function handleComplete() {
    startTransition(async () => {
      const res = await completeLessonAction(enrollmentId, lesson.id, courseSlug);
      if (res.error) {
        toast.error(res.error);
      } else {
        setCompleted(true);
        toast.success(`+${lesson.w3tr_reward} W3TR earned!`);
        if (nextLessonId) {
          setTimeout(() => router.push(`/student/learn/${nextLessonId}`), 800);
        }
      }
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex aspect-video w-full items-center justify-center rounded-xl bg-black/90 text-white">
        {lesson.content_type === "video" ? (
          <PlayCircle className="h-16 w-16 opacity-70" />
        ) : (
          <FileText className="h-16 w-16 opacity-70" />
        )}
      </div>

      {lesson.content_text && (
        <div className="prose prose-sm dark:prose-invert max-w-none">
          <p>{lesson.content_text}</p>
        </div>
      )}

      <div className="flex items-center justify-between rounded-lg border border-border bg-card p-4">
        <div>
          <p className="font-medium">{lesson.title}</p>
          <p className="text-sm text-muted-foreground">Reward: {lesson.w3tr_reward} W3TR</p>
        </div>
        {completed ? (
          <span className="flex items-center gap-2 text-sm font-medium text-success">
            <CheckCircle2 className="h-5 w-5" /> Completed
          </span>
        ) : hasQuiz ? (
          <span className="text-sm text-muted-foreground">Pass the quiz below to complete this lesson ↓</span>
        ) : (
          <Button onClick={handleComplete} disabled={isPending}>
            {isPending ? "Marking complete…" : "Mark as complete"}
          </Button>
        )}
      </div>
    </div>
  );
}
