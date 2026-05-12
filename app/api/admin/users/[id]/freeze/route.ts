import { NextResponse } from "next/server";
import { writeAuditLog } from "@/lib/security/audit";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

// Freeze / unfreeze a user account. Admin-only.
//
// Body: { action: "freeze" | "unfreeze", reason?: string }
//
// Freezing flips profiles.account_status to 'frozen', stamps who+when+why,
// and writes an audit log entry. Future login attempts get a 403 from the
// login route. Existing sessions persist until cookie expiry (Supabase
// JWT TTL is ~1h by default, so freeze-then-wait is fast enough for
// most incidents).

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await createClient();
  const { data: authData } = await auth.auth.getUser();
  if (!authData.user) return NextResponse.json({ error: "Login required." }, { status: 401 });

  const admin = createAdminClient();
  if (!admin) return NextResponse.json({ error: "Supabase service role key is not configured." }, { status: 500 });

  const { data: actor } = await admin.from("profiles").select("role").eq("id", authData.user.id).maybeSingle();
  if (actor?.role !== "admin") {
    return NextResponse.json({ error: "Admin role required." }, { status: 403 });
  }

  const params = await context.params;
  const targetId = String(params.id ?? "").trim();
  if (!targetId) return NextResponse.json({ error: "Target user id missing." }, { status: 400 });
  if (targetId === authData.user.id) {
    return NextResponse.json({ error: "You cannot freeze your own account." }, { status: 400 });
  }

  const body = await request.json().catch(() => ({}));
  const action = String(body.action ?? "").toLowerCase();
  const reason = String(body.reason ?? "").trim();
  if (action !== "freeze" && action !== "unfreeze") {
    return NextResponse.json({ error: "Action must be 'freeze' or 'unfreeze'." }, { status: 400 });
  }
  if (action === "freeze" && reason.length < 5) {
    return NextResponse.json({ error: "Reason is required for freezing (min 5 characters)." }, { status: 400 });
  }

  const { data: target } = await admin
    .from("profiles")
    .select("id, email, role, account_status")
    .eq("id", targetId)
    .maybeSingle();
  if (!target) return NextResponse.json({ error: "User not found." }, { status: 404 });

  // Prevent freezing another admin from the UI — admin-on-admin freezes
  // need a manual SQL run to avoid lockout chains.
  if (target.role === "admin") {
    return NextResponse.json({ error: "Cannot freeze another admin from this endpoint." }, { status: 403 });
  }

  if (action === "freeze") {
    if (target.account_status === "frozen") {
      return NextResponse.json({ error: "Account is already frozen." }, { status: 409 });
    }
    const { error } = await admin.from("profiles").update({
      account_status: "frozen",
      frozen_at: new Date().toISOString(),
      frozen_reason: reason,
      frozen_by_profile_id: authData.user.id
    }).eq("id", targetId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    await writeAuditLog(admin, {
      actorProfileId: authData.user.id,
      actorRole: "admin",
      action: "account_frozen",
      entityType: "profile",
      entityId: targetId,
      request,
      metadata: { target_email: target.email, target_role: target.role, reason }
    });

    return NextResponse.json({ status: "frozen" });
  }

  // unfreeze
  if (target.account_status !== "frozen") {
    return NextResponse.json({ error: "Account is not frozen." }, { status: 409 });
  }
  const { error } = await admin.from("profiles").update({
    account_status: "active",
    frozen_at: null,
    frozen_reason: null,
    frozen_by_profile_id: null
  }).eq("id", targetId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await writeAuditLog(admin, {
    actorProfileId: authData.user.id,
    actorRole: "admin",
    action: "account_unfrozen",
    entityType: "profile",
    entityId: targetId,
    request,
    metadata: { target_email: target.email, target_role: target.role, reason }
  });

  return NextResponse.json({ status: "active" });
}
