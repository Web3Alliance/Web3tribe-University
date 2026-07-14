"use client";
import * as React from "react";
import { toast } from "sonner";
import { UploadCloud, CheckCircle2, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export type UploadBucket = "course-videos" | "course-documents" | "course-images" | "avatars" | "assignments";

interface FileUploadFieldProps {
  bucket: UploadBucket;
  accept?: string;
  label?: string;
  onUploaded: (publicUrl: string, fileName: string) => void;
  className?: string;
}

/**
 * Uploads a file to Supabase Storage via POST /api/upload and reports back the
 * resulting public URL. Used anywhere an instructor needs to attach an actual
 * file (video, PDF, image, audio, resource document) rather than only pasting
 * an external link.
 */
export function FileUploadField({ bucket, accept, label = "Upload a file", onUploaded, className }: FileUploadFieldProps) {
  const [uploading, setUploading] = React.useState(false);
  const [uploadedName, setUploadedName] = React.useState<string | null>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);

  async function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

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

      setUploadedName(file.name);
      onUploaded(json.data.publicUrl, file.name);
      toast.success(`"${file.name}" uploaded.`);
    } catch {
      toast.error("Upload failed. Check your connection and try again.");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div className={cn("space-y-2", className)}>
      <label className="flex cursor-pointer items-center gap-2 rounded-md border border-dashed border-input bg-secondary/30 px-3 py-2 text-sm text-muted-foreground hover:bg-secondary/60">
        {uploading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : uploadedName ? (
          <CheckCircle2 className="h-4 w-4 text-success" />
        ) : (
          <UploadCloud className="h-4 w-4" />
        )}
        <span>{uploading ? "Uploading…" : uploadedName ? `Uploaded: ${uploadedName}` : label}</span>
        <input ref={inputRef} type="file" accept={accept} onChange={handleChange} disabled={uploading} className="hidden" />
      </label>
    </div>
  );
}
