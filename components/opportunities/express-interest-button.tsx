"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { expressInterestAction } from "@/lib/actions/opportunities";

export function ExpressInterestButton({
  opportunityId,
  alreadyApplied,
  visibilityOn,
}: {
  opportunityId: string;
  alreadyApplied: boolean;
  visibilityOn: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = React.useTransition();

  if (alreadyApplied) {
    return (
      <Button size="sm" disabled className="w-full sm:w-auto">
        Interest expressed
      </Button>
    );
  }

  return (
    <Button
      size="sm"
      disabled={isPending || !visibilityOn}
      className="w-full sm:w-auto"
      onClick={() =>
        startTransition(async () => {
          const res = await expressInterestAction(opportunityId);
          if (res.error) toast.error(res.error);
          else {
            toast.success("Interest expressed — the organization can now see your application.");
            router.refresh();
          }
        })
      }
    >
      {isPending ? "Sending…" : "Express interest"}
    </Button>
  );
}