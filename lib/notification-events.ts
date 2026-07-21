/**
 * A tiny same-tab event bus so the topbar NotificationBell can refresh its
 * unread count the instant a notification is marked read — even when the
 * user never navigates away from /student/notifications (where "Mark all
 * as read" previously left the bell showing a stale count until the next
 * 60-second poll or a tab focus/blur cycle).
 *
 * Client-only. Do not import from server components/actions.
 */
export const NOTIFICATIONS_CHANGED_EVENT = "w3u:notifications-changed";

export function broadcastNotificationsChanged() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(NOTIFICATIONS_CHANGED_EVENT));
  }
}
