import { NextResponse } from "next/server";
import {
  anonymizeOrDeleteAccountData,
  getAccountBundle,
  getDeletionBlockers
} from "@/lib/account/deletion";
import { writeAuditLog } from "@/lib/security/audit";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const confirmation = String(body.confirmation ?? "").trim();
  const reason = String(body.reason ?? "").trim();

  if (confirmation !== "DELETE") {
    return NextResponse.json({ error: "Type DELETE to confirm account deletion." }, { status: 400 });
  }

  const auth = await createClient();
  const { data: authData } = await auth.auth.getUser();
  if (!authData.user) return NextResponse.json({ error: "Login required." }, { status: 401 });

  const admin = createAdminClient();
  if (!admin) return NextResponse.json({ error: "Supabase service role key is not configured." }, { status: 500 });

  const { data: profile } = await admin.from("profiles").select("*").eq("id", authData.user.id).maybeSingle();
  if (!profile) return NextResponse.json({ error: "Profile not found." }, { status: 404 });

  const role = String(profile.role ?? authData.user.user_metadata?.role ?? "");
  const email = String(profile.email ?? authData.user.email ?? "");

  // Reject a second submission if a review is already in flight. Keeps
  // the admin queue clean and stops users from spamming the table.
  if (profile.deletion_status === "pending_review") {
    return NextResponse.json({
      error: "Your deletion request is already under review. Contact support@agently.in if you need to cancel or expedite it."
    }, { status: 409 });
  }

  const bundle = await getAccountBundle(admin, authData.user.id, email);
  const blockers = await getDeletionBlockers(admin, bundle);

  if (blockers.length) {
    const { data: requestRow, error } = await admin
      .from("account_deletion_requests")
      .insert({
        profile_id: authData.user.id,
        email,
        role,
        reason: reason || "User requested account deletion from profile settings.",
        blockers,
        metadata: { source: "self_service", active_blocker_count: blockers.length }
      })
      .select("id")
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    await admin.from("profiles").update({
      deletion_status: "pending_review",
      deletion_requested_at: new Date().toISOString()
    }).eq("id", authData.user.id);

    await writeAuditLog(admin, {
      actorProfileId: authData.user.id,
      actorRole: role,
      action: "account_deletion_pending_review",
      entityType: "profile",
      entityId: authData.user.id,
      request,
      metadata: { request_id: requestRow.id, blockers }
    });

    return NextResponse.json({
      status: "pending_review",
      request_id: requestRow.id,
      blockers,
      message: "Deletion request created. Agently must review active workflows before deleting this account."
    }, { status: 202 });
  }

  await anonymizeOrDeleteAccountData(admin, bundle, authData.user.id, email, "self_service");
  await writeAuditLog(admin, {
    actorProfileId: authData.user.id,
    actorRole: role,
    action: "account_deleted_self_service",
    entityType: "profile",
    entityId: authData.user.id,
    request,
    metadata: { email, role }
  });
  await admin.auth.admin.deleteUser(authData.user.id);

  return NextResponse.json({
    status: "deleted",
    next_url: "/",
    message: "Account deleted."
  });
}
