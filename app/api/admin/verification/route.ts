import { NextResponse } from "next/server";
import { trackEvent } from "@/lib/analytics/track";
import { getCurrentUser } from "@/lib/auth/session";
import { writeAuditLog } from "@/lib/security/audit";
import { createAdminClient } from "@/lib/supabase/admin";

const tableByType = {
  creator: "creators",
  freelancer: "freelancers",
  brand: "brands"
} as const;

const allowedStatuses = new Set(["unverified", "reviewing", "verified", "rejected"]);
// "verified" is the canonical tier in the new 2-tier model. The older
// "profile" / "social" / "performance" values are still accepted so any
// legacy clients keep working — they all collapse to verification_status
// = "verified" below.
const allowedTiers = new Set(["unverified", "reviewing", "verified", "profile", "social", "performance", "rejected"]);

export async function PATCH(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Login required." }, { status: 401 });

  const admin = createAdminClient();
  if (!admin) return NextResponse.json({ error: "Supabase service role key is not configured." }, { status: 500 });

  if (user.role !== "admin") {
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

  const verified = ["verified", "profile", "social", "performance"].includes(tier);
  const payload = {
    verification_status: verified ? "verified" : status,
    verification_tier: tier,
    verification_checks: checks,
    verified_at: verified ? new Date().toISOString() : null,
    verified_by: verified ? user.id : null,
    verification_notes: notes || null
  };

  const { data, error } = await admin
    .from(tableByType[entityType])
    .update(payload)
    .eq("id", entityId)
    .select("*")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  await trackEvent(admin, {
    eventName: "admin_verification_decision",
    profileId: user.id,
    role: user.role,
    entityType,
    entityId,
    metadata: { status: payload.verification_status, tier, notes: notes || null }
  });
  await writeAuditLog(admin, {
    actorProfileId: user.id,
    actorRole: user.role,
    action: "admin.verification.update",
    entityType,
    entityId,
    request,
    metadata: { status: payload.verification_status, tier }
  });
  return NextResponse.json({ data });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
