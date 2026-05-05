import { redirect } from "next/navigation";
import { BellRing, Mail } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/layout/page-header";
import { NotificationActions } from "@/components/notifications/notification-actions";
import { NotificationPreferencesForm } from "@/components/notifications/notification-preferences-form";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { getCurrentUser } from "@/lib/auth/session";
import { buildDigestPreviews } from "@/lib/notifications/digest";
import { getNotificationPreferences, getUserNotifications } from "@/lib/notifications/workflow-notifications";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export default async function NotificationsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const admin = createAdminClient();
  if (!admin) redirect("/app");

  const [preferences, notifications, digestPreviews] = await Promise.all([
    getNotificationPreferences(admin, user.id),
    getUserNotifications(admin, user, 30),
    buildDigestPreviews(admin, user.role === "admin" ? undefined : user.id)
  ]);

  return (
    <AppShell>
      <PageHeader
        eyebrow="Workflow reminders"
        title="Notifications"
        description="Control how Agently reminds you about offers, payments, contracts, deliverables, messages, verification, and campaign actions."
      />

      <section className="grid gap-5 xl:grid-cols-[0.9fr_1.1fr]">
        <Card>
          <CardHeader><CardTitle>Notification Preferences</CardTitle><Badge tone="blue">{preferences.delivery_mode.replaceAll("_", " ")}</Badge></CardHeader>
          <NotificationPreferencesForm initial={preferences} />
        </Card>

        <Card>
          <CardHeader><CardTitle>Digest Preview</CardTitle><Mail className="h-5 w-5 text-primary" /></CardHeader>
          <div className="grid gap-3">
            {digestPreviews.slice(0, user.role === "admin" ? 8 : 1).map((preview) => (
              <div className="rounded-md border bg-white p-3" key={preview.profile_id}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold">{preview.subject}</p>
                    <p className="mt-1 text-sm text-muted-foreground">{preview.full_name} - {preview.email} - {preview.role}</p>
                  </div>
                  <Badge tone={preview.email_enabled ? "green" : "neutral"}>{preview.email_enabled ? "email ready" : "in-app"}</Badge>
                </div>
                <p className="mt-2 text-sm leading-6">{preview.preview}</p>
              </div>
            ))}
          </div>
        </Card>
      </section>

      <section className="mt-5">
        <Card>
          <CardHeader>
            <CardTitle>Notification History</CardTitle>
            <NotificationActions />
          </CardHeader>
          <div className="grid gap-2">
            {notifications.map((notification) => (
              <div
                className={`rounded-md border p-3 dark:border-white/10 ${
                  notification.status === "unread"
                    ? "bg-amber-50/60 text-amber-950 dark:bg-amber-950/35 dark:text-amber-100"
                    : "bg-white dark:bg-card dark:text-card-foreground"
                }`}
                key={notification.id}
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <BellRing className="h-4 w-4 text-primary" />
                      <p className="font-semibold">{notification.title}</p>
                      <Badge tone="blue">{notification.category ?? "workflow"}</Badge>
                      <Badge tone={notification.status === "unread" ? "amber" : "neutral"}>{notification.status}</Badge>
                    </div>
                    {notification.body ? <p className="mt-1 text-sm leading-6 text-muted-foreground">{notification.body}</p> : null}
                  </div>
                  <NotificationActions notificationId={notification.id} />
                </div>
              </div>
            ))}
            {!notifications.length ? <p className="rounded-md border bg-muted p-3 text-sm text-muted-foreground">No notifications yet.</p> : null}
          </div>
        </Card>
      </section>
    </AppShell>
  );
}
