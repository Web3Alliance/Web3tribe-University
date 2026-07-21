"use client";
import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { NOTIFICATIONS_CHANGED_EVENT } from "@/lib/notification-events";

/**
 * Topbar bell with a live unread badge. The bell previously gave no visual
 * cue at all that new notifications had arrived — users only discovered them
 * by clicking through. This polls the existing /api/notifications endpoint
 * (mount, every 60s, on tab refocus, and on route change), AND listens for
 * an in-tab "notifications-changed" event so the badge updates instantly
 * when something is marked read on the Notifications page itself — that
 * page doesn't change the URL, so route-change alone wouldn't catch it.
 */
export function NotificationBell() {
  const pathname = usePathname();
  const [unreadCount, setUnreadCount] = React.useState(0);

  const refresh = React.useCallback(async () => {
    try {
      const res = await fetch("/api/notifications?unread=true", { cache: "no-store" });
      if (!res.ok) return;
      const json = (await res.json()) as { data: unknown[] | null };
      setUnreadCount(json.data?.length ?? 0);
    } catch {
      // Network hiccup — keep the last known count rather than flashing to 0.
    }
  }, []);

  React.useEffect(() => {
    // Initial fetch is deferred a tick — setState happens in the fetch
    // callback, never synchronously inside the effect body.
    const initial = setTimeout(refresh, 0);
    const interval = setInterval(refresh, 60_000);
    const onFocus = () => refresh();
    const onNotificationsChanged = () => refresh();
    window.addEventListener("focus", onFocus);
    window.addEventListener(NOTIFICATIONS_CHANGED_EVENT, onNotificationsChanged);
    return () => {
      clearTimeout(initial);
      clearInterval(interval);
      window.removeEventListener("focus", onFocus);
      window.removeEventListener(NOTIFICATIONS_CHANGED_EVENT, onNotificationsChanged);
    };
  }, [refresh, pathname]);

  return (
    <Button variant="ghost" size="icon" asChild className="relative">
      <Link href="/student/notifications" aria-label={unreadCount > 0 ? `Notifications (${unreadCount} unread)` : "Notifications"}>
        <Bell className="h-4 w-4" />
        {unreadCount > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold leading-none text-destructive-foreground">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </Link>
    </Button>
  );
}
