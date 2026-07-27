"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { submitCourseReview } from "@/lib/actions/enrollment";

export function CourseReviewForm({
  courseId,
  courseSlug,
  existingReview,
}: {
  courseId: string;
  courseSlug: string;
  existingReview: { rating: number; review_text: string | null } | null;
}) {
  const router = useRouter();
  const [isPending, startTransition] = React.useTransition();
  const [rating, setRating] = React.useState(existingReview?.rating ?? 0);
  const [hoverRating, setHoverRating] = React.useState(0);
  const [reviewText, setReviewText] = React.useState(existingReview?.review_text ?? "");

  function handleSubmit() {
    if (rating === 0) {
      toast.error("Pick a star rating first.");
      return;
    }
    startTransition(async () => {
      const res = await submitCourseReview(courseId, courseSlug, rating, reviewText.trim());
      if (res.error) toast.error(res.error);
      else {
        toast.success(existingReview ? "Review updated." : "Thanks for your review!");
        router.refresh();
      }
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{existingReview ? "Update your review" : "Leave a review"}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center gap-1">
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => setRating(n)}
              onMouseEnter={() => setHoverRating(n)}
              onMouseLeave={() => setHoverRating(0)}
              aria-label={`Rate ${n} star${n === 1 ? "" : "s"}`}
              className="p-0.5"
            >
              <Star
                className={`h-6 w-6 ${
                  n <= (hoverRating || rating) ? "fill-accent text-accent" : "text-muted-foreground"
                }`}
              />
            </button>
          ))}
        </div>
        <Textarea
          placeholder="What did you think of this course? (optional)"
          value={reviewText}
          onChange={(e) => setReviewText(e.target.value)}
          rows={3}
        />
        <Button onClick={handleSubmit} disabled={isPending} size="sm">
          {isPending ? "Saving…" : existingReview ? "Update review" : "Submit review"}
        </Button>
      </CardContent>
    </Card>
  );
}
