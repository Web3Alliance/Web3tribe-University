"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { markAllNotificationsRead } from "@/lib/actions/notifications";
import { broadcastNotificationsChanged } from "@/lib/notification-events";

export function MarkAllReadButton() {
  const router = useRouter();
  const [isPending, startTransition] = React.useTransition();

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      disabled={isPending}
      onClick={() =>
        startTransition(async () => {
          await markAllNotificationsRead();
          broadcastNotificationsChanged();
          router.refresh();
        })
      }
    >
      {isPending ? "Marking…" : "Mark all as read"}
    </Button>
  );
}
