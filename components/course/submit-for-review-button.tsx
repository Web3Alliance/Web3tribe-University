"use client";
import * as React from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { submitCourseForReviewAction } from "@/lib/actions/courses";
import { Send } from "lucide-react";

export function SubmitForReviewButton({ courseId, disabled }: { courseId: string; disabled?: boolean }) {
  const [isPending, startTransition] = React.useTransition();

  return (
    <Button
      disabled={disabled || isPending}
      onClick={() =>
        startTransition(async () => {
          const res = await submitCourseForReviewAction(courseId);
          if (res?.error) toast.error(res.error);
          else toast.success("Course submitted for admin review.");
        })
      }
    >
      <Send className="h-4 w-4" /> {isPending ? "Submitting…" : "Submit for Review"}
    </Button>
  );
}
