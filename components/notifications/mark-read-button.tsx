"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { markNotificationRead } from "@/lib/actions/notifications";
import { broadcastNotificationsChanged } from "@/lib/notification-events";

export function MarkReadButton({ notificationId, children }: { notificationId: string; children: React.ReactNode }) {
  const router = useRouter();
  const [isPending, startTransition] = React.useTransition();

  return (
    <button
      type="button"
      className="w-full text-left"
      disabled={isPending}
      onClick={() =>
        startTransition(async () => {
          await markNotificationRead(notificationId);
          broadcastNotificationsChanged();
          router.refresh();
        })
      }
    >
      {children}
    </button>
  );
}
