import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth/session";
import { getNotificationPreferences, updateNotificationPreferences } from "@/lib/notifications/workflow-notifications";
import { createAdminClient } from "@/lib/supabase/admin";

const allowedCategories = ["offer", "payment", "contract", "delivery", "message", "verification", "campaign", "workflow"];

const preferencesSchema = z.object({
  delivery_mode: z.enum(["in_app_only", "important_only", "daily_digest", "paused"]),
  enabled_categories: z.array(z.string()).default([]),
  digest_hour: z.coerce.number().int().min(0).max(23).default(9),
  email_enabled: z.boolean().default(false)
});

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Login required." }, { status: 401 });

  const admin = createAdminClient();
  if (!admin) return NextResponse.json({ error: "Supabase service role key is not configured." }, { status: 500 });

  return NextResponse.json({ data: await getNotificationPreferences(admin, user.id) });
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Login required." }, { status: 401 });

  const admin = createAdminClient();
  if (!admin) return NextResponse.json({ error: "Supabase service role key is not configured." }, { status: 500 });

  const parsed = preferencesSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid notification preferences." }, { status: 400 });
  }

  const enabledCategories = parsed.data.enabled_categories.filter((category) => allowedCategories.includes(category));
  const { data, error } = await updateNotificationPreferences(admin, user.id, {
    ...parsed.data,
    enabled_categories: enabledCategories.length ? enabledCategories : allowedCategories
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data });
}
