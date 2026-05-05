"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Bell } from "lucide-react";
import { NotificationActions } from "@/components/notifications/notification-actions";
import { Badge } from "@/components/ui/badge";

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
  const [visibleNotifications, setVisibleNotifications] = useState(notifications);
  const [visibleUnreadCount, setVisibleUnreadCount] = useState(unreadCount);

  useEffect(() => {
    setVisibleNotifications(notifications);
    setVisibleUnreadCount(unreadCount);
  }, [notifications, unreadCount]);

  function handleAction(action: "read" | "dismiss" | "read_all", notificationId?: string) {
    if (action === "read_all") {
      setVisibleNotifications([]);
      setVisibleUnreadCount(0);
      return;
    }
    if (notificationId) {
      setVisibleNotifications((current) => {
        const target = current.find((notification) => notification.id === notificationId);
        if (target?.status === "unread") {
          setVisibleUnreadCount((count) => Math.max(0, count - 1));
        }
        return current.filter((notification) => notification.id !== notificationId);
      });
    }
  }

  return (
    <div className="flex items-center justify-end">
      <details className="group relative">
        <summary className="flex h-10 cursor-pointer list-none items-center gap-2 rounded-full border bg-white px-3 text-sm font-semibold shadow-sm transition hover:bg-muted dark:border-white/10 dark:bg-card dark:hover:bg-muted">
            <span className="relative inline-flex">
              <Bell className="h-4 w-4" />
              {visibleUnreadCount > 0 ? <span className="absolute -right-2 -top-2 h-4 min-w-4 rounded-full bg-red-600 px-1 text-center text-[10px] leading-4 text-white">{visibleUnreadCount}</span> : null}
            </span>
            Notifications
        </summary>
        <div className="absolute right-0 z-30 mt-2 w-[min(420px,calc(100vw-2rem))] rounded-lg border bg-white p-3 shadow-xl dark:border-white/10 dark:bg-card">
          <div className="mb-3 flex items-center justify-between gap-3">
            <Badge tone={visibleUnreadCount ? "amber" : "green"}>{visibleUnreadCount ? `${visibleUnreadCount} unread` : "clear"}</Badge>
            {visibleUnreadCount ? <NotificationActions onAction={handleAction} /> : null}
          </div>
          {visibleNotifications.length ? (
            <div className="grid max-h-[480px] gap-2 overflow-y-auto pr-1">
              {visibleNotifications.map((notification) => (
                <div className={`rounded-md border p-3 ${notification.status === "unread" ? "bg-amber-50/60 dark:bg-amber-950/30 dark:border-amber-900/50" : "bg-white dark:bg-card/50 dark:border-white/8"}`} key={notification.id}>
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
                    <NotificationActions notificationId={notification.id} onAction={handleAction} />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No notifications yet. Agently will add reminders here when a workflow needs attention.</p>
          )}
        </div>
      </details>
    </div>
  );
}
