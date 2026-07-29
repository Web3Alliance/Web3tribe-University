"use client";
import * as React from "react";
import { toast } from "sonner";
import { UploadCloud, Loader2, Trash2, FileText, Video, File as FileIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { addLessonResourceAction, deleteLessonResourceAction } from "@/lib/actions/courses";
import type { LessonResource } from "@/lib/types";

function formatFileSize(bytes: number | null): string {
  if (!bytes) return "";
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function iconForType(fileType: string | null) {
  if (fileType?.startsWith("video/")) return Video;
  if (fileType === "application/pdf" || fileType?.startsWith("text/")) return FileText;
  return FileIcon;
}

/**
 * The lesson_resources table (and its RLS) existed in the schema from very
 * early on, but had never been connected to any action or UI — instructors
 * had no way to attach a slide deck, worksheet, or dataset to a lesson at
 * all. Routes the upload to course-videos or course-documents automatically
 * based on the file's MIME type, matching the existing bucket split used
 * elsewhere for lesson content itself.
 */
export function LessonResourceManager({
  courseId,
  lessonId,
  resources,
}: {
  courseId: string;
  lessonId: string;
  resources: LessonResource[];
}) {
  const [isPending, startTransition] = React.useTransition();
  const [uploading, setUploading] = React.useState(false);
  const [title, setTitle] = React.useState("");
  const [showAddForm, setShowAddForm] = React.useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  async function handleFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!title.trim()) {
      toast.error("Give this resource a title first.");
      return;
    }

    const bucket = file.type.startsWith("video/") || file.type.startsWith("audio/") ? "course-videos" : "course-documents";

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("bucket", bucket);
      const res = await fetch("/api/upload", { method: "POST", body: formData });
      const json = await res.json();
      if (!res.ok || json.error) {
        toast.error(json.error ?? "Upload failed.");
        return;
      }

      const result = await addLessonResourceAction(courseId, lessonId, {
        title: title.trim(),
        fileUrl: json.data.publicUrl,
        fileType: file.type,
        fileSizeBytes: file.size,
      });
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success(`"${title.trim()}" attached to this lesson.`);
      setTitle("");
      setShowAddForm(false);
    } catch {
      toast.error("Upload failed. Check your connection and try again.");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="mt-2 space-y-2 border-t border-border pt-2">
      <p className="text-xs font-medium text-muted-foreground">Lesson resources</p>
      {resources.length > 0 && (
        <ul className="space-y-1.5">
          {resources.map((r) => {
            const Icon = iconForType(r.file_type);
            return (
              <li key={r.id} className="flex items-center justify-between gap-2 rounded-md bg-secondary/40 px-2.5 py-1.5 text-xs">
                <a href={r.file_url} target="_blank" rel="noopener noreferrer" className="flex min-w-0 items-center gap-1.5 hover:underline">
                  <Icon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  <span className="truncate">{r.title}</span>
                  {r.file_size_bytes && <span className="shrink-0 text-muted-foreground">({formatFileSize(r.file_size_bytes)})</span>}
                </a>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-5 w-5 shrink-0"
                  disabled={isPending}
                  onClick={() =>
                    startTransition(async () => {
                      await deleteLessonResourceAction(courseId, r.id, lessonId);
                    })
                  }
                >
                  <Trash2 className="h-3 w-3 text-destructive" />
                </Button>
              </li>
            );
          })}
        </ul>
      )}

      {showAddForm ? (
        <div className="flex items-center gap-1.5">
          <Input
            placeholder="Resource title, e.g. Lecture slides"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="h-7 text-xs"
          />
          <Button size="sm" variant="outline" className="h-7 shrink-0 text-xs" disabled={uploading} onClick={() => fileInputRef.current?.click()}>
            {uploading ? <Loader2 className="h-3 w-3 animate-spin" /> : <UploadCloud className="h-3 w-3" />}
            {uploading ? "Uploading…" : "Choose file"}
          </Button>
          <input ref={fileInputRef} type="file" className="hidden" onChange={handleFileSelected} />
          <Button size="sm" variant="ghost" className="h-7 shrink-0 text-xs" onClick={() => setShowAddForm(false)}>
            Cancel
          </Button>
        </div>
      ) : (
        <Button size="sm" variant="ghost" className="h-6 text-xs text-muted-foreground" onClick={() => setShowAddForm(true)}>
          <UploadCloud className="h-3 w-3" /> Add resource
        </Button>
      )}
    </div>
  );
}
