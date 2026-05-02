import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const tableByType = {
  creator: "creators",
  freelancer: "freelancers",
  brand: "brands"
} as const;

const allowedStatuses = new Set(["unverified", "reviewing", "verified", "rejected"]);
const allowedTiers = new Set(["unverified", "reviewing", "profile", "social", "performance", "rejected"]);

export async function PATCH(request: Request) {
  const auth = await createClient();
  const { data: authData } = await auth.auth.getUser();
  if (!authData.user) return NextResponse.json({ error: "Login required." }, { status: 401 });

  const admin = createAdminClient();
  if (!admin) return NextResponse.json({ error: "Supabase service role key is not configured." }, { status: 500 });

  const { data: profile } = await admin.from("profiles").select("role").eq("id", authData.user.id).single();
  if (profile?.role !== "admin") {
    return NextResponse.json({ error: "Only admins can change verification status." }, { status: 403 });
  }

  const body = await request.json();
  const entityType = String(body.entity_type ?? "") as keyof typeof tableByType;
  const entityId = String(body.entity_id ?? "");
  const status = String(body.status ?? "");
  const tier = String(body.tier ?? "unverified");
  const notes = String(body.notes ?? "").trim();
  const checks = isRecord(body.checks) ? body.checks : {};

  if (!tableByType[entityType] || !entityId || !allowedStatuses.has(status) || !allowedTiers.has(tier)) {
    return NextResponse.json({ error: "Invalid verification request." }, { status: 400 });
  }

  const verified = ["profile", "social", "performance"].includes(tier);
  const payload = {
    verification_status: verified ? "verified" : status,
    verification_tier: tier,
    verification_checks: checks,
    verified_at: verified ? new Date().toISOString() : null,
    verified_by: verified ? authData.user.id : null,
    verification_notes: notes || null
  };

  const { data, error } = await admin
    .from(tableByType[entityType])
    .update(payload)
    .eq("id", entityId)
    .select("*")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
