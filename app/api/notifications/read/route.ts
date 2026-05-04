import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { markNotificationRead } from "@/lib/notifications/workflow-notifications";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Login required." }, { status: 401 });

  const admin = createAdminClient();
  if (!admin) return NextResponse.json({ error: "Supabase service role key is not configured." }, { status: 500 });

  const body = await request.json();
  const action = String(body.action ?? "read");
  const notificationId = String(body.notification_id ?? "").trim() || undefined;

  if (!["read", "dismiss", "read_all"].includes(action)) {
    return NextResponse.json({ error: "Invalid notification action." }, { status: 400 });
  }

  const ok = await markNotificationRead(admin, user.id, action === "read_all" ? undefined : notificationId, action === "dismiss");
  if (!ok) return NextResponse.json({ error: "Could not update notification." }, { status: 500 });
  return NextResponse.json({ ok: true });
}
