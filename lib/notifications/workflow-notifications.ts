import type { CurrentUser } from "@/lib/auth/session";
import type { createAdminClient } from "@/lib/supabase/admin";
import { getWorkflowNudges, type WorkflowNudge } from "@/lib/workflow/nudges";

type AdminClient = NonNullable<ReturnType<typeof createAdminClient>>;
type User = NonNullable<CurrentUser>;
type NotificationRow = {
  id: string;
  title: string;
  body: string | null;
  category: string | null;
  href: string | null;
  cta: string | null;
  severity: "high" | "medium" | "low" | "info";
  group_name: string | null;
  status: "unread" | "read" | "dismissed";
  created_at: string;
};

export async function ensureNotificationsForUser(admin: AdminClient, user: User) {
  const nudges = await getWorkflowNudges(admin, user);
  const preferences = await getNotificationPreferences(admin, user.id);
  if (preferences.delivery_mode === "paused") return nudges;

  const currentKeys = new Set(nudges.map((nudge) => nudgeKey(nudge)));

  // Pull every active workflow-derived notification this user has. We need
  // the full set (not just the ones matching the current nudges) so we can
  // auto-resolve the rows whose underlying condition no longer fires —
  // e.g. "Accepted work is not funded" once payment_status flips to funded.
  // Without this, a brand sees the stale nudge forever and has to dismiss
  // it manually, which makes the notifications bell feel broken.
  const { data: workflowRows, error } = await admin
    .from("app_notifications")
    .select("id, dedupe_key, status")
    .eq("profile_id", user.id)
    .neq("status", "dismissed")
    .like("dedupe_key", "workflow:%");

  if (error) return nudges;

  const existingKeys = new Set((workflowRows ?? []).map((row) => String(row.dedupe_key)));
  const staleIds = (workflowRows ?? [])
    .filter((row) => !currentKeys.has(String(row.dedupe_key)))
    .map((row) => String(row.id));

  if (staleIds.length) {
    await admin
      .from("app_notifications")
      .update({ status: "dismissed", dismissed_at: new Date().toISOString() })
      .in("id", staleIds);
  }

  if (!nudges.length) return nudges;

  const rowsToInsert = nudges
    .filter((nudge) => shouldCreateNotification(nudge, preferences) && !existingKeys.has(nudgeKey(nudge)))
    .map((nudge) => ({
      profile_id: user.id,
      dedupe_key: nudgeKey(nudge),
      title: nudge.title,
      body: nudge.description,
      category: categoryForNudge(nudge),
      href: nudge.href,
      cta: nudge.cta,
      severity: nudge.severity,
      group_name: nudge.group,
      entity_type: entityFromNudge(nudge).type,
      entity_id: entityFromNudge(nudge).id,
      status: "unread"
    }));

  if (rowsToInsert.length) {
    await admin.from("app_notifications").insert(rowsToInsert);
  }

  return nudges;
}

export async function getUserNotifications(admin: AdminClient, user: User, limit = 8): Promise<NotificationRow[]> {
  const { data, error } = await admin
    .from("app_notifications")
    .select("id, title, body, category, href, cta, severity, group_name, status, created_at")
    .eq("profile_id", user.id)
    .neq("status", "dismissed")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) return [];
  return (data ?? []) as NotificationRow[];
}

export async function getUnreadNotificationCount(admin: AdminClient, profileId: string) {
  const { count, error } = await admin
    .from("app_notifications")
    .select("id", { count: "exact", head: true })
    .eq("profile_id", profileId)
    .eq("status", "unread");

  if (error) return 0;
  return count ?? 0;
}

export async function markNotificationRead(admin: AdminClient, profileId: string, notificationId?: string, dismiss = false) {
  const status = dismiss ? "dismissed" : "read";
  const timestamp = new Date().toISOString();
  let query = admin
    .from("app_notifications")
    .update(dismiss
      ? { status, dismissed_at: timestamp }
      : { status, read_at: timestamp })
    .eq("profile_id", profileId);

  if (notificationId) query = query.eq("id", notificationId);
  else query = query.eq("status", "unread");

  const { error } = await query;
  return !error;
}

export async function getNotificationPreferences(admin: AdminClient, profileId: string) {
  const { data } = await admin
    .from("notification_preferences")
    .select("*")
    .eq("profile_id", profileId)
    .maybeSingle();

  return {
    delivery_mode: String(data?.delivery_mode ?? "in_app_only") as "in_app_only" | "important_only" | "daily_digest" | "paused",
    enabled_categories: Array.isArray(data?.enabled_categories) ? data.enabled_categories.map(String) : ["offer", "payment", "contract", "delivery", "message", "verification", "campaign", "workflow"],
    digest_hour: Number(data?.digest_hour ?? 9),
    email_enabled: Boolean(data?.email_enabled)
  };
}

export async function updateNotificationPreferences(
  admin: AdminClient,
  profileId: string,
  preferences: {
    delivery_mode: "in_app_only" | "important_only" | "daily_digest" | "paused";
    enabled_categories: string[];
    digest_hour: number;
    email_enabled: boolean;
  }
) {
  const { data, error } = await admin
    .from("notification_preferences")
    .upsert({
      profile_id: profileId,
      delivery_mode: preferences.delivery_mode,
      enabled_categories: preferences.enabled_categories,
      digest_hour: preferences.digest_hour,
      email_enabled: preferences.email_enabled,
      updated_at: new Date().toISOString()
    }, { onConflict: "profile_id" })
    .select("*")
    .single();
  return { data, error };
}

function nudgeKey(nudge: WorkflowNudge) {
  return `workflow:${nudge.id}`;
}

function shouldCreateNotification(nudge: WorkflowNudge, preferences: Awaited<ReturnType<typeof getNotificationPreferences>>) {
  const category = categoryForNudge(nudge);
  if (!preferences.enabled_categories.includes(category)) return false;
  if (preferences.delivery_mode === "important_only" && !["high", "medium"].includes(nudge.severity)) return false;
  return true;
}

function categoryForNudge(nudge: WorkflowNudge) {
  const text = `${nudge.id} ${nudge.group} ${nudge.title}`.toLowerCase();
  if (text.includes("payment") || text.includes("fund") || text.includes("payout")) return "payment";
  if (text.includes("contract") || text.includes("risk")) return "contract";
  if (text.includes("deliver") || text.includes("revision")) return "delivery";
  if (text.includes("campaign") || text.includes("shortlist")) return "campaign";
  if (text.includes("offer") || text.includes("pending")) return "offer";
  if (text.includes("verification")) return "verification";
  return "workflow";
}

function entityFromNudge(nudge: WorkflowNudge) {
  const id = nudge.id.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i)?.[0] ?? null;
  if (!id) return { id: null, type: null };
  if (nudge.id.includes("contract")) return { id, type: "contract" };
  if (nudge.id.includes("deliverable") || nudge.id.includes("revision")) return { id, type: "deliverable" };
  if (nudge.id.includes("campaign") || nudge.id.includes("shortlist")) return { id, type: "campaign" };
  if (nudge.id.includes("offer") || nudge.id.includes("pending") || nudge.id.includes("fund") || nudge.id.includes("deliver")) return { id, type: "work_item" };
  return { id, type: "workflow" };
}
