"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Heart } from "lucide-react";
import { enrollInCourse, toggleWishlist } from "@/lib/actions/enrollment";

export function EnrollButton({
  courseId,
  courseSlug,
  isEnrolled,
  firstLessonId,
}: {
  courseId: string;
  courseSlug: string;
  isEnrolled: boolean;
  firstLessonId?: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = React.useTransition();

  if (isEnrolled) {
    return (
      <Button
        size="lg"
        className="w-full"
        onClick={() => firstLessonId && router.push(`/student/learn/${firstLessonId}`)}
      >
        Continue Learning
      </Button>
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
          if (res.error) toast.error(res.error);
          else toast.success("Enrolled! Let's start learning.");
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
