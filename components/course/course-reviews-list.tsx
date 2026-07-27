"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Star } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { initials, formatRelativeTime } from "@/lib/utils";
import { respondToReviewAction } from "@/lib/actions/enrollment";

export interface CourseReviewItem {
  id: string;
  rating: number;
  review_text: string | null;
  instructor_response: string | null;
  created_at: string;
  student: { full_name: string | null; avatar_url: string | null } | null;
}

export function CourseReviewsList({
  reviews,
  courseSlug,
  canRespond = false,
}: {
  reviews: CourseReviewItem[];
  courseSlug?: string;
  canRespond?: boolean;
}) {
  if (reviews.length === 0) {
    return (
      <p className="py-6 text-center text-sm text-muted-foreground">
        No reviews yet — be the first to complete this course and share what you thought.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {reviews.map((r) => (
        <div key={r.id} className="border-b border-border pb-4 last:border-0">
          <div className="flex items-start gap-3">
            <Avatar className="h-9 w-9 shrink-0">
              <AvatarImage src={r.student?.avatar_url ?? undefined} alt={r.student?.full_name ?? "Student"} />
              <AvatarFallback>{initials(r.student?.full_name)}</AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center justify-between gap-1">
                <p className="font-medium">{r.student?.full_name ?? "Anonymous student"}</p>
                <span className="text-xs text-muted-foreground">{formatRelativeTime(r.created_at)}</span>
              </div>
              <div className="mt-0.5 flex items-center gap-0.5">
                {[1, 2, 3, 4, 5].map((n) => (
                  <Star
                    key={n}
                    className={`h-3.5 w-3.5 ${n <= r.rating ? "fill-accent text-accent" : "text-muted-foreground"}`}
                  />
                ))}
              </div>
              {r.review_text && <p className="mt-2 text-sm">{r.review_text}</p>}
              {r.instructor_response && !canRespond && (
                <div className="mt-2 rounded-md bg-secondary/50 p-3 text-sm">
                  <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Instructor response
                  </p>
                  <p>{r.instructor_response}</p>
                </div>
              )}
              {canRespond && courseSlug && (
                <InstructorResponseControl
                  reviewId={r.id}
                  courseSlug={courseSlug}
                  existingResponse={r.instructor_response}
                />
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function InstructorResponseControl({
  reviewId,
  courseSlug,
  existingResponse,
}: {
  reviewId: string;
  courseSlug: string;
  existingResponse: string | null;
}) {
  const router = useRouter();
  const [isEditing, setIsEditing] = React.useState(false);
  const [text, setText] = React.useState(existingResponse ?? "");
  const [isPending, startTransition] = React.useTransition();

  if (!isEditing) {
    return (
      <div className="mt-2">
        {existingResponse && (
          <div className="rounded-md bg-secondary/50 p-3 text-sm">
            <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Your response
            </p>
            <p>{existingResponse}</p>
          </div>
        )}
        <Button size="sm" variant="ghost" className="mt-1 h-7 px-2 text-xs" onClick={() => setIsEditing(true)}>
          {existingResponse ? "Edit response" : "Respond as instructor"}
        </Button>
      </div>
    );
  }

  return (
    <div className="mt-2 space-y-2">
      <Textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Write a response students will see publicly…"
        rows={2}
      />
      <div className="flex gap-2">
        <Button
          size="sm"
          disabled={isPending}
          onClick={() =>
            startTransition(async () => {
              const res = await respondToReviewAction(reviewId, courseSlug, text);
              if (res.error) toast.error(res.error);
              else {
                toast.success("Response saved.");
                setIsEditing(false);
                router.refresh();
              }
            })
          }
        >
          {isPending ? "Saving…" : "Save"}
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setIsEditing(false)}>
          Cancel
        </Button>
      </div>
    </div>
  );
}
