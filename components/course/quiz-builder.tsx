"use client";
import * as React from "react";
import { toast } from "sonner";
import { Plus, Trash2, CheckCircle2, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  addQuizQuestionAction,
  updateQuizQuestionAction,
  deleteQuizQuestionAction,
  deleteQuizAction,
} from "@/lib/actions/quiz-builder";
import { ImportQuestionsButton } from "@/components/course/import-questions-button";
import { TOKENOMICS } from "@/lib/tokenomics";
import type { QuizQuestion } from "@/lib/types";

interface QuizBuilderProps {
  courseId: string;
  quizId: string;
  quizTitle: string;
  isFinalExam: boolean;
  questions: QuizQuestion[];
}

export function QuizBuilder({ courseId, quizId, quizTitle, isFinalExam, questions }: QuizBuilderProps) {
  const [isPending, startTransition] = React.useTransition();
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const belowFinalExamMinimum = isFinalExam && questions.length < 50;

  function handleDeleteQuiz() {
    if (!confirm(`Delete "${quizTitle}"? All its questions will be removed too.`)) return;
    startTransition(async () => {
      await deleteQuizAction(courseId, quizId);
    });
  }

  return (
    <Card className="border-dashed">
      <CardHeader className="flex-row items-center justify-between space-y-0 pb-3">
        <div>
          <CardTitle className="text-sm">
            {isFinalExam ? "🏁 " : "📝 "}
            {quizTitle}
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            {questions.length} question{questions.length === 1 ? "" : "s"} · each question is weighted equally
            (a {questions.length || 1}-question {isFinalExam ? "exam" : "quiz"} = {Math.round(100 / (questions.length || 1))}%
            per question) · pass at {TOKENOMICS.DEFAULT_PASSING_SCORE_PERCENT}% ·
            reward {isFinalExam ? TOKENOMICS.FINAL_EXAM_PASS_REWARD : TOKENOMICS.LESSON_QUIZ_PASS_REWARD} W3TR · unlimited retakes
          </p>
          {isFinalExam ? (
            belowFinalExamMinimum ? (
              <p className="mt-1 text-xs font-medium text-destructive">
                Final exams need at least 50 questions before the course can be submitted for review
                ({questions.length}/50 so far).
              </p>
            ) : (
              <p className="mt-1 text-xs font-medium text-success">Meets the 50-question minimum for final exams.</p>
            )
          ) : (
            <p className="mt-1 text-xs text-muted-foreground">Recommended: around 5 questions per lesson quiz.</p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <ImportQuestionsButton courseId={courseId} quizId={quizId} />
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm" variant="outline">
                <Plus className="h-3.5 w-3.5" /> Question
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add question to &quot;{quizTitle}&quot;</DialogTitle>
              </DialogHeader>
              <QuestionForm mode="add" courseId={courseId} quizId={quizId} onDone={() => setDialogOpen(false)} />
            </DialogContent>
          </Dialog>
          <Button size="icon" variant="ghost" onClick={handleDeleteQuiz} disabled={isPending}>
            <Trash2 className="h-4 w-4 text-destructive" />
          </Button>
        </div>
      </CardHeader>
      {questions.length > 0 && (
        <CardContent className="space-y-2 pt-0">
          {questions.map((q, i) => (
            <QuestionRow key={q.id} courseId={courseId} question={q} index={i + 1} />
          ))}
        </CardContent>
      )}
    </Card>
  );
}

function QuestionRow({ courseId, question, index }: { courseId: string; question: QuizQuestion; index: number }) {
  const [isPending, startTransition] = React.useTransition();
  const [editOpen, setEditOpen] = React.useState(false);
  const options = (question.options as { id: string; text: string }[]) ?? [];
  const correctId = question.correct_answer as unknown as string;
  const isShortAnswer = question.question_type === "short_answer";

  return (
    <div className="rounded-md border border-border p-3 text-sm">
      <div className="flex items-start justify-between gap-2">
        <p className="font-medium">
          {index}. {question.question_text}
          {isShortAnswer && (
            <span className="ml-2 rounded bg-secondary px-1.5 py-0.5 text-xs font-normal text-muted-foreground">
              Subjective
            </span>
          )}
        </p>
        <div className="flex shrink-0 items-center gap-1">
          <Dialog open={editOpen} onOpenChange={setEditOpen}>
            <DialogTrigger asChild>
              <Button size="icon" variant="ghost" className="h-6 w-6">
                <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Edit question</DialogTitle>
              </DialogHeader>
              <QuestionForm mode="edit" courseId={courseId} questionId={question.id} existing={question} onDone={() => setEditOpen(false)} />
            </DialogContent>
          </Dialog>
          <Button
            size="icon"
            variant="ghost"
            className="h-6 w-6"
            disabled={isPending}
            onClick={() => startTransition(async () => { await deleteQuizQuestionAction(courseId, question.id); })}
          >
            <Trash2 className="h-3.5 w-3.5 text-destructive" />
          </Button>
        </div>
      </div>
      {isShortAnswer ? (
        <p className="mt-2 flex items-center gap-1.5 pl-4 text-xs text-muted-foreground">
          <CheckCircle2 className="h-3 w-3 text-success" />
          Expected answer: <span className="font-medium text-foreground">{String(question.correct_answer)}</span>
        </p>
      ) : (
        <ul className="mt-2 space-y-1 pl-4">
          {options.map((o) => (
            <li key={o.id} className="flex items-center gap-1.5 text-xs text-muted-foreground">
              {o.id === correctId && <CheckCircle2 className="h-3 w-3 text-success" />}
              {o.text}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/**
 * Shared by both "add" and "edit" — previously edit didn't exist at all, so
 * this form only ever needed to handle a blank starting state. Now it also
 * accepts `existing` to pre-fill when editing, and calls the matching action
 * (add vs. update) based on `mode`.
 */
function QuestionForm({
  mode,
  courseId,
  quizId,
  questionId,
  existing,
  onDone,
}: {
  mode: "add" | "edit";
  courseId: string;
  quizId?: string;
  questionId?: string;
  existing?: QuizQuestion;
  onDone: () => void;
}) {
  const [isPending, startTransition] = React.useTransition();
  const existingOptions = (existing?.options as { id: string; text: string }[] | null) ?? null;
  const [questionType, setQuestionType] = React.useState<"single_choice" | "short_answer">(
    existing?.question_type === "short_answer" ? "short_answer" : "single_choice"
  );
  const [options, setOptions] = React.useState(
    existingOptions && existingOptions.length > 0
      ? existingOptions
      : [
          { id: "a", text: "" },
          { id: "b", text: "" },
          { id: "c", text: "" },
          { id: "d", text: "" },
        ]
  );
  const [correctId, setCorrectId] = React.useState(
    existing?.question_type !== "short_answer" ? (existing?.correct_answer as unknown as string) ?? "a" : "a"
  );
  const [correctTextAnswer, setCorrectTextAnswer] = React.useState(
    existing?.question_type === "short_answer" ? String(existing.correct_answer) : ""
  );

  function updateOption(id: string, text: string) {
    setOptions((prev) => prev.map((o) => (o.id === id ? { ...o, text } : o)));
  }

  function handleSubmit(formData: FormData) {
    const questionText = String(formData.get("questionText") || "");
    if (!questionText.trim()) {
      toast.error("Question text is required.");
      return;
    }

    if (questionType === "short_answer") {
      if (!correctTextAnswer.trim()) {
        toast.error("Provide the expected answer.");
        return;
      }
      startTransition(async () => {
        const input = { questionText, questionType: "short_answer" as const, correctTextAnswer };
        const res =
          mode === "add"
            ? await addQuizQuestionAction(courseId, quizId!, input)
            : await updateQuizQuestionAction(courseId, questionId!, input);
        if (res?.error) toast.error(res.error);
        else {
          toast.success(mode === "add" ? "Question added." : "Question updated.");
          onDone();
        }
      });
      return;
    }

    const filledOptions = options.filter((o) => o.text.trim().length > 0);
    if (filledOptions.length < 2) {
      toast.error("Provide at least 2 answer options.");
      return;
    }

    startTransition(async () => {
      const input = { questionText, questionType: "single_choice" as const, options: filledOptions, correctOptionId: correctId };
      const res =
        mode === "add"
          ? await addQuizQuestionAction(courseId, quizId!, input)
          : await updateQuizQuestionAction(courseId, questionId!, input);
      if (res?.error) toast.error(res.error);
      else {
        toast.success(mode === "add" ? "Question added." : "Question updated.");
        onDone();
      }
    });
  }

  return (
    <form action={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="questionText">Question</Label>
        <Input id="questionText" name="questionText" required defaultValue={existing?.question_text ?? ""} />
      </div>

      <div className="space-y-2">
        <Label>Question type</Label>
        <RadioGroup
          value={questionType}
          onValueChange={(v) => setQuestionType(v as "single_choice" | "short_answer")}
          className="flex flex-wrap gap-4"
        >
          <label className="flex cursor-pointer items-center gap-2 text-sm">
            <RadioGroupItem value="single_choice" id={`type-choice-${mode}`} />
            Multiple choice
          </label>
          <label className="flex cursor-pointer items-center gap-2 text-sm">
            <RadioGroupItem value="short_answer" id={`type-subjective-${mode}`} />
            Subjective (short answer)
          </label>
        </RadioGroup>
      </div>

      {questionType === "single_choice" ? (
        <div className="space-y-2">
          <Label>Answer options (select the correct one)</Label>
          <RadioGroup value={correctId} onValueChange={setCorrectId} className="space-y-2">
            {options.map((o) => (
              <div key={o.id} className="flex items-center gap-2">
                <RadioGroupItem value={o.id} id={`opt-${mode}-${o.id}`} />
                <Input
                  placeholder={`Option ${o.id.toUpperCase()}`}
                  value={o.text}
                  onChange={(e) => updateOption(o.id, e.target.value)}
                />
              </div>
            ))}
          </RadioGroup>
          <p className="text-xs text-muted-foreground">The selected radio button marks the correct answer.</p>
        </div>
      ) : (
        <div className="space-y-2">
          <Label htmlFor="correctTextAnswer">Expected answer</Label>
          <Input
            id="correctTextAnswer"
            value={correctTextAnswer}
            onChange={(e) => setCorrectTextAnswer(e.target.value)}
            placeholder="e.g. Lagos"
          />
          <p className="text-xs text-muted-foreground">
            Graded with a lenient match (ignores case, punctuation, and extra spacing) — good for short factual
            answers. Not suited to grading long-form essay responses.
          </p>
        </div>
      )}

      <Button type="submit" disabled={isPending} className="w-full">
        {isPending ? "Saving…" : mode === "add" ? "Add question" : "Save changes"}
      </Button>
    </form>
  );
}
