"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { enrollInCohortAction } from "@/lib/actions/cohorts";

export function CohortJoinButton({ cohortId, courseSlug }: { cohortId: string; courseSlug: string }) {
  const router = useRouter();
  const [isPending, startTransition] = React.useTransition();

  return (
    <Button
      size="sm"
      disabled={isPending}
      onClick={() =>
        startTransition(async () => {
          const res = await enrollInCohortAction(cohortId, courseSlug);
          if (res.error) toast.error(res.error);
          else {
            toast.success("Joined the cohort!");
            router.refresh();
          }
        })
      }
    >
      {isPending ? "Joining…" : "Join cohort"}
    </Button>
  );
}