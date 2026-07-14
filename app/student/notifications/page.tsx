import { getCurrentProfile } from "@/lib/rbac";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Bell } from "lucide-react";
import { formatRelativeTime } from "@/lib/utils";
import { markNotificationRead, markAllNotificationsRead } from "@/lib/actions/notifications";
import { NotificationLink } from "@/components/notifications/notification-link";

export const metadata = { title: "Notifications" };

export default async function NotificationsPage() {
  const profile = await getCurrentProfile();
  const supabase = await createClient();

  const { data: notifications } = await supabase
    .from("notifications")
    .select("*")
    .eq("profile_id", profile!.id)
    .order("created_at", { ascending: false })
    .limit(50);

  const unreadCount = (notifications ?? []).filter((n) => !n.is_read).length;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Notifications</h1>
          <p className="text-muted-foreground">{unreadCount} unread</p>
        </div>
        {unreadCount > 0 && (
          <form action={markAllNotificationsRead}>
            <Button type="submit" variant="outline" size="sm">
              Mark all as read
            </Button>
          </form>
        )}
      </div>

      <div className="space-y-2">
        {(notifications ?? []).length === 0 && (
          <Card>
            <CardContent className="p-12 text-center">
              <Bell className="mx-auto mb-4 h-10 w-10 text-muted-foreground" />
              <p className="text-muted-foreground">You&apos;re all caught up.</p>
            </CardContent>
          </Card>
        )}
        {(notifications ?? []).map((n) => {
          const content = (
            <div className="flex items-start gap-3 p-4">
              <div className={`mt-1 h-2 w-2 shrink-0 rounded-full ${n.is_read ? "bg-transparent" : "bg-primary"}`} />
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <p className="font-medium">{n.title}</p>
                  {!n.is_read && <Badge variant="secondary">New</Badge>}
                </div>
                {n.body && <p className="text-sm text-muted-foreground">{n.body}</p>}
                <p className="mt-1 text-xs text-muted-foreground">{formatRelativeTime(n.created_at)}</p>
              </div>
            </div>
          );
          return (
            <Card key={n.id} className={n.is_read ? "opacity-70" : ""}>
              {n.link_url ? (
                <NotificationLink href={n.link_url} notificationId={n.id}>
                  {content}
                </NotificationLink>
              ) : (
                <form action={markNotificationRead.bind(null, n.id)}>
                  <button type="submit" className="w-full text-left">
                    {content}
                  </button>
                </form>
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
}