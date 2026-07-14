"use client";
import * as React from "react";
import Link from "next/link";
import { markNotificationRead } from "@/lib/actions/notifications";

export function NotificationLink({
  href,
  notificationId,
  children,
}: {
  href: string;
  notificationId: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      onClick={() => {
        // Fire-and-forget: don't block navigation on this completing.
        markNotificationRead(notificationId);
      }}
    >
      {children}
    </Link>
  );
}