"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CheckCircle2, PlayCircle, FileText, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { completeLessonAction } from "@/lib/actions/lessons";
import { resolveVideoEmbed } from "@/lib/media-embed";
import type { Lesson } from "@/lib/types";

function LessonMedia({ lesson }: { lesson: Lesson }) {
  if (lesson.content_type === "video" || lesson.content_type === "embed") {
    const { type, embedUrl } = resolveVideoEmbed(lesson.content_url);

    if (type === "direct" && embedUrl) {
      return (
        <video
          key={embedUrl}
          src={embedUrl}
          controls
          className="aspect-video w-full rounded-xl bg-black"
        />
      );
    }

    if ((type === "google-drive" || type === "youtube" || type === "vimeo") && embedUrl) {
      return (
        <iframe
          key={embedUrl}
          src={embedUrl}
          className="aspect-video w-full rounded-xl border-0 bg-black"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
        />
      );
    }

    // Unknown/unresolvable link — don't render a broken iframe, offer a
    // plain "open in new tab" fallback instead.
    if (embedUrl) {
      return (
        <div className="flex aspect-video w-full flex-col items-center justify-center gap-3 rounded-xl bg-black/90 text-white">
          <PlayCircle className="h-16 w-16 opacity-70" />
          <a
            href={embedUrl}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-1.5 text-sm text-white/80 underline hover:text-white"
          >
            <ExternalLink className="h-4 w-4" /> Open video in a new tab
          </a>
        </div>
      );
    }
  }

  return (
    <div className="flex aspect-video w-full items-center justify-center rounded-xl bg-black/90 text-white">
      <FileText className="h-16 w-16 opacity-70" />
    </div>
  );
}

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
      <LessonMedia lesson={lesson} />

      {lesson.content_text && (
        <div className="prose prose-sm dark:prose-invert max-w-none">
          <p>{lesson.content_text}</p>
        </div>
      )}

      {lesson.lesson_resources && lesson.lesson_resources.length > 0 && (
        <div className="rounded-lg border border-border bg-card p-4">
          <p className="mb-2 text-sm font-medium">Lesson resources</p>
          <ul className="space-y-1.5">
            {lesson.lesson_resources.map((r) => (
              <li key={r.id}>
                <a
                  href={r.file_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-sm text-primary hover:underline"
                >
                  <FileText className="h-4 w-4 shrink-0" />
                  <span className="truncate">{r.title}</span>
                  {r.file_size_bytes != null && (
                    <span className="shrink-0 text-xs text-muted-foreground">
                      ({r.file_size_bytes < 1024 * 1024
                        ? `${Math.round(r.file_size_bytes / 1024)} KB`
                        : `${(r.file_size_bytes / (1024 * 1024)).toFixed(1)} MB`})
                    </span>
                  )}
                  <ExternalLink className="h-3 w-3 shrink-0 text-muted-foreground" />
                </a>
              </li>
            ))}
          </ul>
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
