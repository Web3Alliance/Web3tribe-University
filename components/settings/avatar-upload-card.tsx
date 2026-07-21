"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { initials } from "@/lib/utils";
import { updateAvatarAction } from "@/lib/actions/settings";

export function AvatarUploadCard({ avatarUrl, fullName }: { avatarUrl: string | null; fullName: string | null }) {
  const router = useRouter();
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = React.useState(false);

  async function handleFile(file: File) {
    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("bucket", "avatars");

      const res = await fetch("/api/upload", { method: "POST", body: formData });
      const json = (await res.json()) as { data: { publicUrl: string } | null; error: string | null };
      if (!res.ok || !json.data) {
        toast.error(json.error ?? "Upload failed.");
        return;
      }

      const saved = await updateAvatarAction(json.data.publicUrl);
      if (saved.error) toast.error(saved.error);
      else {
        toast.success("Profile photo updated.");
        router.refresh();
      }
    } finally {
      setIsUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Profile photo</CardTitle>
        <CardDescription>
          Your photo appears to organizations when they review your application for an opportunity — a photo is
          required before you can express interest.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex items-center gap-4">
        <Avatar className="h-16 w-16">
          <AvatarImage src={avatarUrl ?? undefined} alt={fullName ?? "Profile photo"} />
          <AvatarFallback className="text-lg">{initials(fullName)}</AvatarFallback>
        </Avatar>
        <div className="space-y-1">
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleFile(file);
            }}
          />
          <Button variant="outline" size="sm" disabled={isUploading} onClick={() => inputRef.current?.click()}>
            {isUploading ? "Uploading…" : avatarUrl ? "Change photo" : "Upload photo"}
          </Button>
          <p className="text-xs text-muted-foreground">JPG, PNG, or WebP · up to 5MB</p>
        </div>
      </CardContent>
    </Card>
  );
}
