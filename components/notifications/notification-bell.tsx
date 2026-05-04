import Link from "next/link";
import { Bell } from "lucide-react";
import { NotificationActions } from "@/components/notifications/notification-actions";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";

type Notification = {
  id: string;
  title: string;
  body: string | null;
  href: string | null;
  cta: string | null;
  severity: "high" | "medium" | "low" | "info";
  group_name: string | null;
  status: "unread" | "read" | "dismissed";
  created_at: string;
};

const toneBySeverity = {
  high: "red",
  medium: "amber",
  low: "green",
  info: "blue"
} as const;

export function NotificationBell({ notifications, unreadCount }: { notifications: Notification[]; unreadCount: number }) {
  return (
    <Card className="mb-4 p-0">
      <details className="group">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3">
          <span className="flex items-center gap-2 text-sm font-semibold">
            <span className="relative inline-flex">
              <Bell className="h-4 w-4" />
              {unreadCount > 0 ? <span className="absolute -right-2 -top-2 h-4 min-w-4 rounded-full bg-red-600 px-1 text-center text-[10px] leading-4 text-white">{unreadCount}</span> : null}
            </span>
            Notifications
          </span>
          <div className="flex items-center gap-2">
            <Badge tone={unreadCount ? "amber" : "green"}>{unreadCount ? `${unreadCount} unread` : "clear"}</Badge>
            {unreadCount ? <NotificationActions /> : null}
          </div>
        </summary>
        <div className="border-t px-4 py-3">
          {notifications.length ? (
            <div className="grid gap-2">
              {notifications.map((notification) => (
                <div className={`rounded-md border p-3 ${notification.status === "unread" ? "bg-amber-50/60" : "bg-white"}`} key={notification.id}>
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-semibold">{notification.title}</p>
                        <Badge tone={toneBySeverity[notification.severity]}>{notification.severity}</Badge>
                        {notification.group_name ? <Badge tone="neutral">{notification.group_name}</Badge> : null}
                      </div>
                      {notification.body ? <p className="mt-1 text-sm leading-6 text-muted-foreground">{notification.body}</p> : null}
                      {notification.href ? (
                        <Link className="mt-2 inline-flex text-sm font-semibold text-primary" href={notification.href}>
                          {notification.cta || "Open"}
                        </Link>
                      ) : null}
                    </div>
                    <NotificationActions notificationId={notification.id} />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No notifications yet. Agently will add reminders here when a workflow needs attention.</p>
          )}
        </div>
      </details>
    </Card>
  );
}
