import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { ensureNotificationsForUser } from "@/lib/notifications/workflow-notifications";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Login required." }, { status: 401 });

  const admin = createAdminClient();
  if (!admin) return NextResponse.json({ error: "Supabase service role key is not configured." }, { status: 500 });

  if (user.role !== "admin") {
    const generated = await ensureNotificationsForUser(admin, user);
    return NextResponse.json({ generated: generated.length, scope: "self" });
  }

  const { data: profiles, error } = await admin.from("profiles").select("id, email, full_name, role");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  let generatedCount = 0;
  for (const profile of profiles ?? []) {
    if (!["admin", "creator", "brand", "freelancer"].includes(String(profile.role))) continue;
    const generated = await ensureNotificationsForUser(admin, {
      id: String(profile.id),
      email: String(profile.email ?? ""),
      full_name: String(profile.full_name ?? "Agently user"),
      role: String(profile.role) as "admin" | "creator" | "brand" | "freelancer"
    });
    generatedCount += generated.length;
  }

  return NextResponse.json({ generated: generatedCount, scope: "all_profiles" });
}
