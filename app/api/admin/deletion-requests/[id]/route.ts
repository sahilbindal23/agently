import { NextResponse } from "next/server";
import {
  anonymizeOrDeleteAccountData,
  getAccountBundle
} from "@/lib/account/deletion";
import { writeAuditLog } from "@/lib/security/audit";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

// Admins review pending self-service deletion requests here. Two outcomes:
//
//   - approve: force-anonymize the account even if active workflows remain.
//     The deletion lib preserves transactional rows (deals, payments,
//     contracts) by anonymizing parent records, so legal/tax history stays.
//
//   - reject: mark the request rejected, restore the user's deletion_status
//     to 'active'. The user can then resubmit after the blocker resolves.
//
// Both outcomes write an audit log entry so we have a defensible trail.

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
  const requestId = String(params.id ?? "");
  if (!requestId) return NextResponse.json({ error: "Request id missing." }, { status: 400 });

  const body = await request.json().catch(() => ({}));
  const action = String(body.action ?? "").toLowerCase();
  const note = String(body.note ?? "").trim();
  if (action !== "approve" && action !== "reject") {
    return NextResponse.json({ error: "Action must be 'approve' or 'reject'." }, { status: 400 });
  }

  const { data: requestRow } = await admin
    .from("account_deletion_requests")
    .select("*")
    .eq("id", requestId)
    .maybeSingle();

  if (!requestRow) return NextResponse.json({ error: "Deletion request not found." }, { status: 404 });
  if (requestRow.status !== "pending_review") {
    return NextResponse.json({ error: `Request is already ${requestRow.status}.` }, { status: 409 });
  }

  if (action === "reject") {
    await admin.from("account_deletion_requests").update({
      status: "rejected",
      processed_at: new Date().toISOString(),
      processed_by: authData.user.id,
      metadata: { ...(requestRow.metadata ?? {}), admin_note: note || null }
    }).eq("id", requestId);

    if (requestRow.profile_id) {
      await admin.from("profiles").update({
        deletion_status: "active",
        deletion_requested_at: null
      }).eq("id", requestRow.profile_id);
    }

    await writeAuditLog(admin, {
      actorProfileId: authData.user.id,
      actorRole: "admin",
      action: "account_deletion_rejected",
      entityType: "account_deletion_request",
      entityId: requestId,
      request,
      metadata: { profile_id: requestRow.profile_id, note }
    });

    return NextResponse.json({ status: "rejected" });
  }

  // approve → run the same anonymize/delete the user route uses
  if (!requestRow.profile_id) {
    return NextResponse.json({ error: "Profile already removed." }, { status: 410 });
  }

  const email = String(requestRow.email ?? "");
  const bundle = await getAccountBundle(admin, requestRow.profile_id, email);
  await anonymizeOrDeleteAccountData(admin, bundle, requestRow.profile_id, email, "admin_approved");

  await admin.from("account_deletion_requests").update({
    status: "completed",
    processed_at: new Date().toISOString(),
    processed_by: authData.user.id,
    metadata: { ...(requestRow.metadata ?? {}), admin_note: note || null, approved: true }
  }).eq("id", requestId);

  try {
    await admin.auth.admin.deleteUser(requestRow.profile_id);
  } catch {
    // Auth row may already be gone if the profile cascade fired - non-fatal.
  }

  await writeAuditLog(admin, {
    actorProfileId: authData.user.id,
    actorRole: "admin",
    action: "account_deletion_approved",
    entityType: "account_deletion_request",
    entityId: requestId,
    request,
    metadata: { profile_id: requestRow.profile_id, email, note }
  });

  return NextResponse.json({ status: "completed" });
}
