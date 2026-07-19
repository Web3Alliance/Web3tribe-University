"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Heart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { enrollInCourse, toggleWishlist, dropCourseAction } from "@/lib/actions/enrollment";

export function EnrollButton({
  courseId,
  courseSlug,
  isEnrolled,
  isActive,
  firstLessonId,
}: {
  courseId: string;
  courseSlug: string;
  isEnrolled: boolean;
  /** True only when the enrollment is still in progress (not completed) —
   * that's the only state a student can drop out of. */
  isActive?: boolean;
  firstLessonId?: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = React.useTransition();
  const [isDropping, setIsDropping] = React.useState(false);

  function handleDrop() {
    setIsDropping(true);
    startTransition(async () => {
      const res = await dropCourseAction(courseId, courseSlug);
      if (res.error) {
        toast.error(res.error);
        setIsDropping(false);
      } else {
        toast.success("Course dropped — you're free to enroll in a different one now.");
        router.refresh();
      }
    });
  }

  if (isEnrolled) {
    return (
      <div className="space-y-2">
        <Button
          size="lg"
          className="w-full"
          onClick={() => firstLessonId && router.push(`/student/learn/${firstLessonId}`)}
        >
          Continue Learning
        </Button>
        {isActive && !isDropping && (
          <button
            type="button"
            onClick={() => {
              if (confirm("Drop this course? Your progress on it will stop counting, but any W3TR you've already earned stays yours. You can re-enroll later if you change your mind.")) {
                handleDrop();
              }
            }}
            disabled={isPending}
            className="w-full text-center text-xs text-muted-foreground underline hover:text-destructive"
          >
            Drop this course
          </button>
        )}
      </div>
    );
  }

  return (
    <Button
      size="lg"
      className="w-full"
      disabled={isPending}
      onClick={() =>
        startTransition(async () => {
          const res = await enrollInCourse(courseId, courseSlug);
          if ("requiresBiodata" in res && res.requiresBiodata) {
            router.push(`/student/biodata?redirectTo=/student/courses/${courseSlug}`);
          } else if ("insufficientBalance" in res && res.insufficientBalance) {
            toast.error(
              `You need ${res.shortfall} more W3TR to enroll in this course (you have ${res.has}, it costs ${res.needed}).`,
              {
                action: {
                  label: "Buy W3TR",
                  onClick: () => router.push("/student/wallet"),
                },
              }
            );
          } else if (res.error) {
            toast.error(res.error);
          } else {
            toast.success("Enrolled! Let's start learning.");
          }
        })
      }
    >
      {isPending ? "Enrolling…" : "Enroll Now"}
    </Button>
  );
}

export function WishlistButton({
  courseId,
  courseSlug,
  isWishlisted,
}: {
  courseId: string;
  courseSlug: string;
  isWishlisted: boolean;
}) {
  const [isPending, startTransition] = React.useTransition();
  const [wishlisted, setWishlisted] = React.useState(isWishlisted);

  return (
    <Button
      variant="outline"
      size="lg"
      disabled={isPending}
      onClick={() =>
        startTransition(async () => {
          setWishlisted(!wishlisted);
          const res = await toggleWishlist(courseId, courseSlug, wishlisted);
          if (res.error) {
            toast.error(res.error);
            setWishlisted(wishlisted);
          }
        })
      }
    >
      <Heart className={wishlisted ? "fill-destructive text-destructive" : ""} />
    </Button>
  );
}