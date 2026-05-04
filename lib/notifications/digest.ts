import type { createAdminClient } from "@/lib/supabase/admin";
import { getNotificationPreferences } from "@/lib/notifications/workflow-notifications";

type AdminClient = NonNullable<ReturnType<typeof createAdminClient>>;

export type DigestPreview = {
  profile_id: string;
  email: string;
  full_name: string;
  role: string;
  delivery_mode: string;
  email_enabled: boolean;
  subject: string;
  preview: string;
  notifications: Array<{
    id: string;
    title: string;
    body: string;
    category: string;
    severity: string;
    href: string;
  }>;
};

export async function buildDigestPreviews(admin: AdminClient, profileId?: string): Promise<DigestPreview[]> {
  let query = admin.from("profiles").select("id, email, full_name, role").order("created_at", { ascending: false });
  if (profileId) query = query.eq("id", profileId);

  const { data: profiles, error } = await query;
  if (error) return [];

  const previews: DigestPreview[] = [];
  for (const profile of profiles ?? []) {
    const preferences = await getNotificationPreferences(admin, String(profile.id));
    const { data: notifications } = await admin
      .from("app_notifications")
      .select("id, title, body, category, severity, href")
      .eq("profile_id", profile.id)
      .eq("status", "unread")
      .order("created_at", { ascending: false })
      .limit(12);

    const rows = (notifications ?? []).map((notification) => ({
      id: String(notification.id),
      title: String(notification.title ?? ""),
      body: String(notification.body ?? ""),
      category: String(notification.category ?? "workflow"),
      severity: String(notification.severity ?? "info"),
      href: String(notification.href ?? "")
    }));

    previews.push({
      profile_id: String(profile.id),
      email: String(profile.email ?? ""),
      full_name: String(profile.full_name ?? "Agently user"),
      role: String(profile.role ?? "user"),
      delivery_mode: preferences.delivery_mode,
      email_enabled: preferences.email_enabled,
      subject: `Agently digest: ${rows.length} workflow update${rows.length === 1 ? "" : "s"}`,
      preview: rows.length
        ? rows.slice(0, 3).map((row) => row.title).join(" | ")
        : "No unread workflow updates right now.",
      notifications: rows
    });
  }

  return previews;
}

export function renderDigestEmail(preview: DigestPreview) {
  const rows = preview.notifications.map((notification) => (
    `- [${notification.severity}] ${notification.title}: ${notification.body}${notification.href ? ` (${notification.href})` : ""}`
  )).join("\n");

  return {
    subject: preview.subject,
    text: [
      `Hi ${preview.full_name},`,
      "",
      "Here is your Agently workflow digest:",
      "",
      rows || "No unread workflow updates right now.",
      "",
      "Agently keeps offers, contracts, deliverables, and payout workflows moving from one operating system."
    ].join("\n")
  };
}

export async function sendDigestEmail(preview: DigestPreview) {
  const email = renderDigestEmail(preview);
  if (!process.env.RESEND_API_KEY) {
    return { sent: false, reason: "RESEND_API_KEY missing", email };
  }

  // Email sending is intentionally stubbed until production sender/domain setup is complete.
  return { sent: false, reason: "Resend transport not enabled yet", email };
}
