import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { ensureNotificationsForUser, getUnreadNotificationCount, getUserNotifications } from "@/lib/notifications/workflow-notifications";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Login required." }, { status: 401 });

  const admin = createAdminClient();
  if (!admin) return NextResponse.json({ error: "Supabase service role key is not configured." }, { status: 500 });

  await ensureNotificationsForUser(admin, user);
  const [notifications, unreadCount] = await Promise.all([
    getUserNotifications(admin, user, 20),
    getUnreadNotificationCount(admin, user.id)
  ]);

  return NextResponse.json({ data: notifications, unread_count: unreadCount });
}
