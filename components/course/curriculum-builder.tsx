"use client";
import * as React from "react";
import { toast } from "sonner";
import { Plus, Trash2, GripVertical, PlayCircle, FileText, Link2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { addSectionAction, deleteSectionAction, addLessonAction, deleteLessonAction } from "@/lib/actions/courses";
import { addLessonQuizAction, addFinalExamAction } from "@/lib/actions/quiz-builder";
import { FileUploadField, type UploadBucket } from "@/components/course/file-upload-field";
import { QuizBuilder } from "@/components/course/quiz-builder";
import { TOKENOMICS } from "@/lib/tokenomics";
import type { CourseSection, Lesson, Quiz, QuizQuestion } from "@/lib/types";

type SectionWithLessons = CourseSection & { lessons: Lesson[] };
type QuizWithQuestions = Quiz & { quiz_questions: QuizQuestion[] };

interface CurriculumBuilderProps {
  courseId: string;
  sections: SectionWithLessons[];
  quizzesByLessonId: Record<string, QuizWithQuestions>;
  finalExam: QuizWithQuestions | null;
}

const BUCKET_BY_CONTENT_TYPE: Record<string, UploadBucket> = {
  video: "course-videos",
  audio: "course-videos",
  pdf: "course-documents",
  download: "course-documents",
  image: "course-images",
};
const ACCEPT_BY_CONTENT_TYPE: Record<string, string> = {
  video: "video/mp4,video/webm,video/quicktime",
  audio: "audio/mpeg,audio/mp3,audio/wav,audio/ogg",
  pdf: "application/pdf",
  download: ".pdf,.doc,.docx,.zip,.txt",
  image: "image/png,image/jpeg,image/webp,image/gif",
};

export function CurriculumBuilder({ courseId, sections, quizzesByLessonId, finalExam }: CurriculumBuilderProps) {
  const [isPending, startTransition] = React.useTransition();
  const [newSectionTitle, setNewSectionTitle] = React.useState("");

  function handleAddSection() {
    if (!newSectionTitle.trim()) return;
    startTransition(async () => {
      const res = await addSectionAction(courseId, newSectionTitle.trim());
      if (res?.error) toast.error(res.error);
      else setNewSectionTitle("");
    });
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Curriculum</CardTitle>
          <p className="text-xs text-muted-foreground">
            Every lesson awards a fixed {TOKENOMICS.LESSON_COMPLETE_REWARD} W3TR on completion. Lesson quizzes award{" "}
            {TOKENOMICS.LESSON_QUIZ_PASS_REWARD} W3TR when passed, with unlimited retakes. These amounts are fixed
            platform-wide and cannot be changed per course.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          {sections.map((section) => (
            <SectionBlock
              key={section.id}
              courseId={courseId}
              section={section}
              quizzesByLessonId={quizzesByLessonId}
            />
          ))}

          <div className="flex flex-col gap-2 rounded-lg border border-dashed border-border p-3 sm:flex-row">
            <Input
              placeholder="New section title (e.g. Getting Started)"
              value={newSectionTitle}
              onChange={(e) => setNewSectionTitle(e.target.value)}
            />
            <Button onClick={handleAddSection} disabled={isPending}>
              <Plus className="h-4 w-4" /> Add Section
            </Button>
          </div>
        </CardContent>
      </Card>

      <FinalExamBlock courseId={courseId} finalExam={finalExam} />
    </div>
  );
}

function SectionBlock({
  courseId,
  section,
  quizzesByLessonId,
}: {
  courseId: string;
  section: SectionWithLessons;
  quizzesByLessonId: Record<string, QuizWithQuestions>;
}) {
  const [isPending, startTransition] = React.useTransition();
  const [dialogOpen, setDialogOpen] = React.useState(false);

  function handleDeleteSection() {
    startTransition(async () => {
      await deleteSectionAction(courseId, section.id);
    });
  }

  return (
    <div className="rounded-lg border border-border">
      <div className="flex items-center justify-between border-b border-border bg-secondary/40 p-3">
        <div className="flex items-center gap-2 font-medium">
          <GripVertical className="h-4 w-4 text-muted-foreground" />
          {section.title}
        </div>
        <div className="flex items-center gap-2">
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm" variant="outline">
                <Plus className="h-3.5 w-3.5" /> Lesson
              </Button>
            </DialogTrigger>
            <DialogContent className="max-h-[85vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Add lesson to &quot;{section.title}&quot;</DialogTitle>
              </DialogHeader>
              <AddLessonForm courseId={courseId} sectionId={section.id} onDone={() => setDialogOpen(false)} />
            </DialogContent>
          </Dialog>
          <Button size="icon" variant="ghost" onClick={handleDeleteSection} disabled={isPending}>
            <Trash2 className="h-4 w-4 text-destructive" />
          </Button>
        </div>
      </div>
      <ul className="divide-y divide-border">
        {section.lessons
          ?.sort((a, b) => a.display_order - b.display_order)
          .map((lesson) => (
            <LessonRow
              key={lesson.id}
              courseId={courseId}
              lesson={lesson}
              quiz={quizzesByLessonId[lesson.id]}
            />
          ))}
        {(!section.lessons || section.lessons.length === 0) && (
          <li className="p-4 text-sm text-muted-foreground">No lessons yet.</li>
        )}
      </ul>
    </div>
  );
}

function LessonRow({ courseId, lesson, quiz }: { courseId: string; lesson: Lesson; quiz?: QuizWithQuestions }) {
  const [isPending, startTransition] = React.useTransition();
  const [quizDialogOpen, setQuizDialogOpen] = React.useState(false);
  const [quizTitle, setQuizTitle] = React.useState(`${lesson.title} — Quiz`);
  const [quizPending, startQuizTransition] = React.useTransition();

  function handleAddQuiz() {
    startQuizTransition(async () => {
      const res = await addLessonQuizAction(courseId, lesson.id, quizTitle.trim() || `${lesson.title} — Quiz`);
      if (res?.error) toast.error(res.error);
      else {
        toast.success("Quiz added. Now add some questions.");
        setQuizDialogOpen(false);
      }
    });
  }

  return (
    <li className="p-3 text-sm">
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-2">
          {lesson.content_type === "video" ? <PlayCircle className="h-4 w-4" /> : <FileText className="h-4 w-4" />}
          {lesson.title}
          <span className="text-xs text-muted-foreground">
            ({TOKENOMICS.LESSON_COMPLETE_REWARD} W3TR fixed reward)
          </span>
        </span>
        <div className="flex items-center gap-2">
          {!quiz && (
            <Dialog open={quizDialogOpen} onOpenChange={setQuizDialogOpen}>
              <DialogTrigger asChild>
                <Button size="sm" variant="outline">
                  <Plus className="h-3.5 w-3.5" /> Quiz
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Add a quiz to &quot;{lesson.title}&quot;</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="quizTitle">Quiz title</Label>
                    <Input id="quizTitle" value={quizTitle} onChange={(e) => setQuizTitle(e.target.value)} />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Passing score is fixed at {TOKENOMICS.DEFAULT_PASSING_SCORE_PERCENT}%, reward is fixed at{" "}
                    {TOKENOMICS.LESSON_QUIZ_PASS_REWARD} W3TR, and students get unlimited retakes.
                  </p>
                  <Button onClick={handleAddQuiz} disabled={quizPending} className="w-full">
                    {quizPending ? "Adding…" : "Create quiz"}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          )}
          <Button
            size="icon"
            variant="ghost"
            disabled={isPending}
            onClick={() => startTransition(async () => { await deleteLessonAction(courseId, lesson.id); })}
          >
            <Trash2 className="h-3.5 w-3.5 text-destructive" />
          </Button>
        </div>
      </div>

      {quiz && (
        <div className="mt-2">
          <QuizBuilder
            courseId={courseId}
            quizId={quiz.id}
            quizTitle={quiz.title}
            isFinalExam={false}
            questions={quiz.quiz_questions ?? []}
          />
          {(!quiz.quiz_questions || quiz.quiz_questions.length === 0) && (
            <Badge variant="warning" className="mt-2">
              Add at least one question before students can take this quiz
            </Badge>
          )}
        </div>
      )}
    </li>
  );
}

function FinalExamBlock({ courseId, finalExam }: { courseId: string; finalExam: QuizWithQuestions | null }) {
  const [title, setTitle] = React.useState("Final Exam");
  const [isPending, startTransition] = React.useTransition();
  const [dialogOpen, setDialogOpen] = React.useState(false);

  function handleAdd() {
    startTransition(async () => {
      const res = await addFinalExamAction(courseId, title.trim() || "Final Exam");
      if (res?.error) toast.error(res.error);
      else {
        toast.success("Final exam created. Add some questions.");
        setDialogOpen(false);
      }
    });
  }

  if (finalExam) {
    return (
      <QuizBuilder
        courseId={courseId}
        quizId={finalExam.id}
        quizTitle={finalExam.title}
        isFinalExam={true}
        questions={finalExam.quiz_questions ?? []}
      />
    );
  }

  return (
    <Card className="border-dashed">
      <CardContent className="flex items-center justify-between p-4">
        <div>
          <p className="font-medium">Final Exam</p>
          <p className="text-xs text-muted-foreground">
            Optional course-wide final exam, rewarding {TOKENOMICS.FINAL_EXAM_PASS_REWARD} W3TR when passed.
          </p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm" variant="outline">
              <Plus className="h-3.5 w-3.5" /> Add Final Exam
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create the final exam</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="examTitle">Title</Label>
                <Input id="examTitle" value={title} onChange={(e) => setTitle(e.target.value)} />
              </div>
              <Button onClick={handleAdd} disabled={isPending} className="w-full">
                {isPending ? "Creating…" : "Create final exam"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}

function AddLessonForm({ courseId, sectionId, onDone }: { courseId: string; sectionId: string; onDone: () => void }) {
  const [isPending, startTransition] = React.useTransition();
  const [contentType, setContentType] = React.useState("video");
  const [contentUrl, setContentUrl] = React.useState("");
  const [contentText, setContentText] = React.useState("");

  const uploadBucket = BUCKET_BY_CONTENT_TYPE[contentType];
  const showUpload = !!uploadBucket;
  const showUrlInput = ["video", "audio", "pdf", "download", "image", "external_link", "embed"].includes(contentType);
  const showTextArea = contentType === "text" || contentType === "code";

  async function handleTextFileLoad(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    setContentText(text);
    toast.success(`Loaded contents of "${file.name}" into the editor below.`);
  }

  function handleSubmit(formData: FormData) {
    startTransition(async () => {
      const res = await addLessonAction(courseId, sectionId, {
        title: String(formData.get("title") || ""),
        contentType,
        contentUrl: contentUrl || undefined,
        contentText: contentText || undefined,
        isPreview: formData.get("isPreview") === "on",
      });
      if (res?.error) toast.error(res.error);
      else {
        toast.success(`Lesson added (fixed reward: ${TOKENOMICS.LESSON_COMPLETE_REWARD} W3TR).`);
        onDone();
      }
    });
  }

  return (
    <form action={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="title">Lesson title</Label>
        <Input id="title" name="title" required />
      </div>

      <div className="space-y-2">
        <Label>Content type</Label>
        <Select
          value={contentType}
          onValueChange={(v) => {
            setContentType(v);
            setContentUrl("");
            setContentText("");
          }}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="video">Video</SelectItem>
            <SelectItem value="pdf">PDF</SelectItem>
            <SelectItem value="text">Text</SelectItem>
            <SelectItem value="image">Image</SelectItem>
            <SelectItem value="audio">Audio</SelectItem>
            <SelectItem value="code">Code snippet</SelectItem>
            <SelectItem value="external_link">External link</SelectItem>
            <SelectItem value="download">Download</SelectItem>
            <SelectItem value="embed">Embed</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {showTextArea && (
        <div className="space-y-2">
          <Label htmlFor="contentText">Content</Label>
          <Textarea
            id="contentText"
            value={contentText}
            onChange={(e) => setContentText(e.target.value)}
            rows={6}
          />
          <label className="flex cursor-pointer items-center gap-2 text-xs text-muted-foreground hover:text-foreground">
            <FileText className="h-3.5 w-3.5" />
            Or load contents from a text/code file
            <input type="file" accept=".txt,.md,.js,.ts,.py,.json,.csv" onChange={handleTextFileLoad} className="hidden" />
          </label>
        </div>
      )}

      {showUpload && (
        <div className="space-y-2">
          <Label>Upload {contentType === "download" ? "a file" : contentType}</Label>
          <FileUploadField
            bucket={uploadBucket}
            accept={ACCEPT_BY_CONTENT_TYPE[contentType]}
            label={`Choose a ${contentType} file to upload`}
            onUploaded={(url) => setContentUrl(url)}
          />
        </div>
      )}

      {showUrlInput && (
        <div className="space-y-2">
          <Label htmlFor="contentUrl" className="flex items-center gap-1.5">
            <Link2 className="h-3.5 w-3.5" />
            {showUpload ? "…or paste a link instead (e.g. YouTube, Google Drive)" : "Link"}
          </Label>
          <Input
            id="contentUrl"
            value={contentUrl}
            onChange={(e) => setContentUrl(e.target.value)}
            placeholder="https://…"
          />
          {contentType === "video" && (
            <p className="text-xs text-muted-foreground">
              Google Drive videos play inline automatically — just make sure the file&apos;s sharing setting is
              &quot;Anyone with the link&quot; (Viewer), or students will see an access-denied screen instead of
              the video.
            </p>
          )}
        </div>
      )}

      <p className="rounded-md bg-secondary/50 px-3 py-2 text-xs text-muted-foreground">
        Completion reward for this lesson is fixed at {TOKENOMICS.LESSON_COMPLETE_REWARD} W3TR platform-wide.
      </p>

      <label className="flex items-center gap-2 text-sm">
        <Checkbox name="isPreview" />
        Allow free preview (visible to non-enrolled visitors)
      </label>
      <Button type="submit" disabled={isPending} className="w-full">
        {isPending ? "Adding…" : "Add lesson"}
      </Button>
    </form>
  );
}