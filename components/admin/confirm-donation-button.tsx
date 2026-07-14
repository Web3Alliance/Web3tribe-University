"use client";
import * as React from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { confirmDonationAction } from "@/lib/actions/admin";

export function ConfirmDonationButton({ donationId }: { donationId: string }) {
  const [isPending, startTransition] = React.useTransition();

  return (
    <Button
      size="sm"
      variant="outline"
      disabled={isPending}
      onClick={() =>
        startTransition(async () => {
          const res = await confirmDonationAction(donationId);
          if (res?.error) toast.error(res.error);
          else toast.success("Donation confirmed.");
        })
      }
    >
      Confirm
    </Button>
  );
}
