"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CheckCircle2, XCircle, RotateCcw, HelpCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Input } from "@/components/ui/input";
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
  // Correct answers are only ever populated after a grade comes back from the
  // server (never available before a question is attempted), so students can
  // review what they got wrong — the aim is to learn, not just get a score.
  const [correctAnswers, setCorrectAnswers] = React.useState<Record<string, unknown> | null>(null);
  const [perQuestionResults, setPerQuestionResults] = React.useState<Record<string, boolean> | null>(null);

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
      setCorrectAnswers(json.data.correctAnswers ?? null);
      setPerQuestionResults(
        (json.data.perQuestionResults ?? []).reduce(
          (acc: Record<string, boolean>, r: { questionId: string; correct: boolean }) => {
            acc[r.questionId] = r.correct;
            return acc;
          },
          {}
        )
      );
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
    setCorrectAnswers(null);
    setPerQuestionResults(null);
    setState("in_progress");
  }

  function handleNext() {
    if (nextLessonId) router.push(`/student/learn/${nextLessonId}`);
  }

  if (questions.length === 0) return null;

  const questionWeight = Math.round(100 / questions.length);

  return (
    <Card className="border-primary/30">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <HelpCircle className="h-4 w-4 text-primary" />
          {quiz.title}
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          {questions.length} question{questions.length === 1 ? "" : "s"} ({questionWeight}% each) · pass at{" "}
          {quiz.passing_score_percent}% · reward {quiz.w3tr_reward} W3TR · you can retake as many times as you need
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
              const isSubjective = q.question_type === "short_answer";
              return (
                <div key={q.id} className="space-y-2">
                  <p className="font-medium">
                    {i + 1}. {q.question_text}
                  </p>
                  {isSubjective ? (
                    <Input
                      value={answers[q.id] ?? ""}
                      onChange={(e) => setAnswers((prev) => ({ ...prev, [q.id]: e.target.value }))}
                      placeholder="Type your answer"
                    />
                  ) : (
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
                  )}
                </div>
              );
            })}
            <Button onClick={handleSubmit} disabled={isSubmitting} className="w-full">
              {isSubmitting ? "Submitting…" : "Submit quiz"}
            </Button>
          </div>
        )}

        {state === "result" && result && (
          <div className="space-y-4">
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

            {/* Review: only shown on a PASS. Withholding it on a failed
                attempt is deliberate — with unlimited retakes, showing the
                correct answers on every attempt turned "learn from a wrong
                answer" into "guess once, then paste the revealed answers
                back in." A failed attempt still shows which questions were
                wrong (via perQuestionResults below), just not what the
                right answer was, so there's still useful signal without
                being an answer key. */}
            {correctAnswers && perQuestionResults && (
              <div className="space-y-3 border-t border-border pt-4">
                <p className="text-sm font-medium">Review your answers</p>
                {questions.map((q, i) => {
                  const wasCorrect = perQuestionResults[q.id];
                  const options = (q.options as { id: string; text: string }[]) ?? [];
                  const correctLabel =
                    q.question_type === "short_answer"
                      ? String(correctAnswers[q.id])
                      : options.find((o) => o.id === correctAnswers[q.id])?.text ?? String(correctAnswers[q.id]);
                  const yourAnswerLabel =
                    q.question_type === "short_answer"
                      ? answers[q.id]
                      : options.find((o) => o.id === answers[q.id])?.text ?? answers[q.id];
                  return (
                    <div key={q.id} className="rounded-md border border-border p-3 text-sm">
                      <p className="flex items-start gap-2 font-medium">
                        {wasCorrect ? (
                          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" />
                        ) : (
                          <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
                        )}
                        {i + 1}. {q.question_text}
                      </p>
                      {!wasCorrect && (
                        <div className="mt-1.5 space-y-0.5 pl-6 text-xs">
                          <p className="text-muted-foreground">
                            Your answer: <span className="text-destructive">{yourAnswerLabel || "(no answer)"}</span>
                          </p>
                          <p className="text-muted-foreground">
                            Correct answer: <span className="font-medium text-success">{correctLabel}</span>
                          </p>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}