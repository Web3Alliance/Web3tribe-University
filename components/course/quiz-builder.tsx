"use client";
import * as React from "react";
import { toast } from "sonner";
import { Plus, Trash2, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { addQuizQuestionAction, deleteQuizQuestionAction, deleteQuizAction } from "@/lib/actions/quiz-builder";
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
            {questions.length} question{questions.length === 1 ? "" : "s"} · pass at {TOKENOMICS.DEFAULT_PASSING_SCORE_PERCENT}% ·
            reward {isFinalExam ? TOKENOMICS.FINAL_EXAM_PASS_REWARD : TOKENOMICS.LESSON_QUIZ_PASS_REWARD} W3TR · unlimited retakes
          </p>
        </div>
        <div className="flex items-center gap-2">
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
              <AddQuestionForm courseId={courseId} quizId={quizId} onDone={() => setDialogOpen(false)} />
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
  const options = (question.options as { id: string; text: string }[]) ?? [];
  const correctId = question.correct_answer as unknown as string;

  return (
    <div className="rounded-md border border-border p-3 text-sm">
      <div className="flex items-start justify-between gap-2">
        <p className="font-medium">
          {index}. {question.question_text}
        </p>
        <Button
          size="icon"
          variant="ghost"
          className="h-6 w-6 shrink-0"
          disabled={isPending}
          onClick={() => startTransition(async () => { await deleteQuizQuestionAction(courseId, question.id); })}
        >
          <Trash2 className="h-3.5 w-3.5 text-destructive" />
        </Button>
      </div>
      <ul className="mt-2 space-y-1 pl-4">
        {options.map((o) => (
          <li key={o.id} className="flex items-center gap-1.5 text-xs text-muted-foreground">
            {o.id === correctId && <CheckCircle2 className="h-3 w-3 text-success" />}
            {o.text}
          </li>
        ))}
      </ul>
    </div>
  );
}

function AddQuestionForm({ courseId, quizId, onDone }: { courseId: string; quizId: string; onDone: () => void }) {
  const [isPending, startTransition] = React.useTransition();
  const [options, setOptions] = React.useState([
    { id: "a", text: "" },
    { id: "b", text: "" },
    { id: "c", text: "" },
    { id: "d", text: "" },
  ]);
  const [correctId, setCorrectId] = React.useState("a");

  function updateOption(id: string, text: string) {
    setOptions((prev) => prev.map((o) => (o.id === id ? { ...o, text } : o)));
  }

  function handleSubmit(formData: FormData) {
    const questionText = String(formData.get("questionText") || "");
    const filledOptions = options.filter((o) => o.text.trim().length > 0);

    if (!questionText.trim()) {
      toast.error("Question text is required.");
      return;
    }
    if (filledOptions.length < 2) {
      toast.error("Provide at least 2 answer options.");
      return;
    }

    startTransition(async () => {
      const res = await addQuizQuestionAction(courseId, quizId, {
        questionText,
        options: filledOptions,
        correctOptionId: correctId,
      });
      if (res?.error) toast.error(res.error);
      else {
        toast.success("Question added.");
        onDone();
      }
    });
  }

  return (
    <form action={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="questionText">Question</Label>
        <Input id="questionText" name="questionText" required />
      </div>

      <div className="space-y-2">
        <Label>Answer options (select the correct one)</Label>
        <RadioGroup value={correctId} onValueChange={setCorrectId} className="space-y-2">
          {options.map((o) => (
            <div key={o.id} className="flex items-center gap-2">
              <RadioGroupItem value={o.id} id={`opt-${o.id}`} />
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

      <Button type="submit" disabled={isPending} className="w-full">
        {isPending ? "Adding…" : "Add question"}
      </Button>
    </form>
  );
}
