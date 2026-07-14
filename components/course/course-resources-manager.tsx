"use client";
import * as React from "react";
import { toast } from "sonner";
import { Trash2, FileText, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { FileUploadField } from "@/components/course/file-upload-field";
import { addCourseResourceAction, deleteCourseResourceAction } from "@/lib/actions/resources";
import type { Course } from "@/lib/types";

interface ResourceItem {
  id: string;
  title: string;
  description: string | null;
  file_url: string;
  file_type: string | null;
}

export function CourseResourcesManager({ course, resources }: { course: Course; resources: ResourceItem[] }) {
  const [isPending, startTransition] = React.useTransition();
  const [title, setTitle] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [fileUrl, setFileUrl] = React.useState("");
  const [fileType, setFileType] = React.useState("");

  function handleSubmit() {
    if (!title.trim() || !fileUrl) {
      toast.error("A title and an uploaded file are required.");
      return;
    }
    startTransition(async () => {
      const res = await addCourseResourceAction(course.id, { title, description, fileUrl, fileType });
      if (res?.error) toast.error(res.error);
      else {
        toast.success("Resource added.");
        setTitle("");
        setDescription("");
        setFileUrl("");
      }
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Course Resources</CardTitle>
        <CardDescription>
          Upload textbooks, reference PDFs, slide decks, or other downloadable material for enrolled students.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-3 rounded-lg border border-dashed border-border p-4">
          <div className="space-y-2">
            <Label htmlFor="resourceTitle">Title</Label>
            <Input
              id="resourceTitle"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Introduction to AI — Course Textbook"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="resourceDescription">Description (optional)</Label>
            <Textarea
              id="resourceDescription"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
            />
          </div>
          <div className="space-y-2">
            <Label>File</Label>
            <FileUploadField
              bucket="course-documents"
              accept=".pdf,.doc,.docx,.txt,.zip"
              label="Choose a document to upload"
              onUploaded={(url, name) => {
                setFileUrl(url);
                setFileType(name.split(".").pop() ?? "");
              }}
            />
          </div>
          <Button onClick={handleSubmit} disabled={isPending} className="w-full">
            {isPending ? "Adding…" : "Add resource"}
          </Button>
        </div>

        <div className="space-y-2">
          {resources.length === 0 && <p className="text-sm text-muted-foreground">No resources uploaded yet.</p>}
          {resources.map((r) => (
            <ResourceRow key={r.id} courseId={course.id} resource={r} />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function ResourceRow({ courseId, resource }: { courseId: string; resource: ResourceItem }) {
  const [isPending, startTransition] = React.useTransition();

  return (
    <div className="flex items-center justify-between rounded-md border border-border p-3 text-sm">
      <div className="flex items-center gap-2">
        <FileText className="h-4 w-4 text-muted-foreground" />
        <div>
          <p className="font-medium">{resource.title}</p>
          {resource.description && <p className="text-xs text-muted-foreground">{resource.description}</p>}
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Button size="icon" variant="ghost" asChild>
          <a href={resource.file_url} target="_blank" rel="noreferrer">
            <Download className="h-3.5 w-3.5" />
          </a>
        </Button>
        <Button
          size="icon"
          variant="ghost"
          disabled={isPending}
          onClick={() => startTransition(async () => { await deleteCourseResourceAction(courseId, resource.id); })}
        >
          <Trash2 className="h-3.5 w-3.5 text-destructive" />
        </Button>
      </div>
    </div>
  );
}
