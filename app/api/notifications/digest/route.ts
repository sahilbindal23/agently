import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { buildDigestPreviews, sendDigestEmail } from "@/lib/notifications/digest";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Login required." }, { status: 401 });

  const admin = createAdminClient();
  if (!admin) return NextResponse.json({ error: "Supabase service role key is not configured." }, { status: 500 });

  const previews = await buildDigestPreviews(admin, user.role === "admin" ? undefined : user.id);
  return NextResponse.json({ data: previews });
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Login required." }, { status: 401 });
  if (user.role !== "admin") return NextResponse.json({ error: "Only admins can preview digest sends." }, { status: 403 });

  const admin = createAdminClient();
  if (!admin) return NextResponse.json({ error: "Supabase service role key is not configured." }, { status: 500 });

  const body = await request.json().catch(() => ({}));
  const profileId = String(body.profile_id ?? "").trim() || undefined;
  const previews = await buildDigestPreviews(admin, profileId);
  const results = await Promise.all(previews.map(sendDigestEmail));

  return NextResponse.json({ data: results });
}
