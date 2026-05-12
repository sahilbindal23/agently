import { NextResponse } from "next/server";
import { writeAuditLog } from "@/lib/security/audit";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

// Reset password endpoint.
//
// Auth model: the user lands here from /reset-password, which is protected
// by getUser(). That means Supabase already gave us a valid session via the
// /auth/callback recovery exchange. We use the server client to call
// updateUser({ password }) under that session, which is the safe path —
// it requires the recovery JWT, not the user's old password.
//
// After the update, we sign the user out so they have to log in cleanly
// with the new password. Without this, an attacker who briefly had access
// (eg via shared device) could keep an active session via the reset flow.

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const password = String(body.password ?? "");

  if (password.length < 8) {
    return NextResponse.json({ error: "Password must be at least 8 characters." }, { status: 400 });
  }

  const supabase = await createClient();
  const { data: authData } = await supabase.auth.getUser();
  if (!authData.user) {
    return NextResponse.json({
      error: "Recovery session expired. Request a fresh password reset link."
    }, { status: 401 });
  }

  const { error } = await supabase.auth.updateUser({ password });
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  const admin = createAdminClient();
  if (admin) {
    await writeAuditLog(admin, {
      actorProfileId: authData.user.id,
      actorRole: authData.user.user_metadata?.role ?? null,
      action: "password_reset_completed",
      entityType: "profile",
      entityId: authData.user.id,
      request,
      metadata: { email: authData.user.email }
    });
  }

  // Sign out the recovery session so the user has to authenticate with
  // the new password.
  await supabase.auth.signOut();

  return NextResponse.json({ status: "ok" });
}
