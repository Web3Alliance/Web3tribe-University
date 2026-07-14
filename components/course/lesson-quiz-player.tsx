"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CheckCircle2, XCircle, RotateCcw, HelpCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Badge } from "@/components/ui/badge";
import { completeLessonAction } from "@/lib/actions/lessons";
import type { Quiz, QuizQuestion } from "@/lib/types";

interface LessonQuizPlayerProps {
  quiz: Quiz;
  questions: QuizQuestion[];
  /** Result of the student's most recent attempt, if any, fetched server-side. */
  lastAttempt?: { score_percent: number; passed: boolean } | null;
  /** Needed so a passing attempt can actually mark the lesson complete and award
   * the lesson-completion W3TR, not just the quiz-pass W3TR. */
  enrollmentId: string;
  lessonId: string;
  courseSlug: string;
  nextLessonId?: string;
}

type QuizState = "idle" | "in_progress" | "result";

export function LessonQuizPlayer({
  quiz,
  questions,
  lastAttempt,
  enrollmentId,
  lessonId,
  courseSlug,
  nextLessonId,
}: LessonQuizPlayerProps) {
  const router = useRouter();
  const [state, setState] = React.useState<QuizState>(lastAttempt?.passed ? "result" : "idle");
  const [answers, setAnswers] = React.useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [result, setResult] = React.useState<{ scorePercent: number; passed: boolean } | null>(
    lastAttempt ? { scorePercent: lastAttempt.score_percent, passed: lastAttempt.passed } : null
  );

  async function handleSubmit() {
    if (Object.keys(answers).length < questions.length) {
      toast.error("Please answer every question before submitting.");
      return;
    }
    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/quizzes/${quiz.id}/attempt`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answers }),
      });
      const json = await res.json();
      if (!res.ok || json.error) {
        toast.error(json.error ?? "Failed to submit quiz.");
        return;
      }
      setResult({ scorePercent: json.data.scorePercent, passed: json.data.passed });
      setState("result");

      if (json.data.passed) {
        // Passing the quiz is what completes the lesson on this platform — this
        // also awards the separate, fixed lesson-completion W3TR (on top of the
        // quiz-pass W3TR already awarded by the attempt endpoint above), and
        // rolls the enrollment's overall progress forward.
        const completion = await completeLessonAction(enrollmentId, lessonId, courseSlug);
        if (completion.error) {
          toast.error(`Quiz passed, but there was an issue recording lesson progress: ${completion.error}`);
        } else {
          toast.success(`Passed with ${json.data.scorePercent}%! Lesson complete — W3TR credited.`);
        }
        router.refresh();
      } else {
        toast.error(`Scored ${json.data.scorePercent}% — you need ${quiz.passing_score_percent}% to pass. Try again!`);
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  function handleRetake() {
    setAnswers({});
    setResult(null);
    setState("in_progress");
  }

  function handleNext() {
    if (nextLessonId) router.push(`/student/learn/${nextLessonId}`);
  }

  if (questions.length === 0) return null;

  return (
    <Card className="border-primary/30">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <HelpCircle className="h-4 w-4 text-primary" />
          {quiz.title}
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          {questions.length} question{questions.length === 1 ? "" : "s"} · pass at {quiz.passing_score_percent}% ·
          reward {quiz.w3tr_reward} W3TR · you can retake as many times as you need
        </p>
      </CardHeader>
      <CardContent>
        {state === "idle" && (
          <Button onClick={() => setState("in_progress")}>Start quiz</Button>
        )}

        {state === "in_progress" && (
          <div className="space-y-6">
            {questions.map((q, i) => {
              const options = (q.options as { id: string; text: string }[]) ?? [];
              return (
                <div key={q.id} className="space-y-2">
                  <p className="font-medium">
                    {i + 1}. {q.question_text}
                  </p>
                  <RadioGroup
                    value={answers[q.id] ?? ""}
                    onValueChange={(v) => setAnswers((prev) => ({ ...prev, [q.id]: v }))}
                    className="space-y-1"
                  >
                    {options.map((o) => (
                      <label
                        key={o.id}
                        className="flex cursor-pointer items-center gap-2 rounded-md border border-input px-3 py-2 text-sm has-[[data-state=checked]]:border-primary has-[[data-state=checked]]:bg-secondary"
                      >
                        <RadioGroupItem value={o.id} id={`${q.id}-${o.id}`} />
                        {o.text}
                      </label>
                    ))}
                  </RadioGroup>
                </div>
              );
            })}
            <Button onClick={handleSubmit} disabled={isSubmitting} className="w-full">
              {isSubmitting ? "Submitting…" : "Submit quiz"}
            </Button>
          </div>
        )}

        {state === "result" && result && (
          <div className="space-y-4 text-center">
            {result.passed ? (
              <>
                <CheckCircle2 className="mx-auto h-10 w-10 text-success" />
                <p className="font-semibold">You passed with {result.scorePercent}%!</p>
                <Badge variant="success">Lesson complete — W3TR credited</Badge>
                {nextLessonId && (
                  <Button onClick={handleNext} className="w-full">
                    Next lesson →
                  </Button>
                )}
              </>
            ) : (
              <>
                <XCircle className="mx-auto h-10 w-10 text-destructive" />
                <p className="font-semibold">You scored {result.scorePercent}%</p>
                <p className="text-sm text-muted-foreground">
                  You need {quiz.passing_score_percent}% to pass. No limit on attempts — try again!
                </p>
                <Button onClick={handleRetake} variant="outline">
                  <RotateCcw className="h-4 w-4" /> Retake quiz
                </Button>
              </>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
