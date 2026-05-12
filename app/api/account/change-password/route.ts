import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { writeAuditLog } from "@/lib/security/audit";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

// Authenticated change-password endpoint.
//
// Different from /api/auth/reset-password: that one assumes the user got
// here via a recovery email and proves identity through the recovery JWT.
// THIS endpoint is for a user who is already logged in and wants to rotate
// their password from /profile. We MUST verify their current password —
// otherwise a stolen session cookie (eg laptop left open) could be used
// to lock the legitimate owner out by changing the password.
//
// Verification approach: spin up a fresh anon-key Supabase client (not
// bound to the user's session) and call signInWithPassword. If it
// succeeds, the supplied current password matched. We never persist
// that side-session — it dies when the function returns.

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const currentPassword = String(body.current_password ?? "");
  const newPassword = String(body.new_password ?? "");

  if (!currentPassword || !newPassword) {
    return NextResponse.json({ error: "Current and new password are required." }, { status: 400 });
  }
  if (newPassword.length < 8) {
    return NextResponse.json({ error: "New password must be at least 8 characters." }, { status: 400 });
  }
  if (newPassword === currentPassword) {
    return NextResponse.json({ error: "New password must differ from the current one." }, { status: 400 });
  }

  const supabase = await createClient();
  const { data: authData } = await supabase.auth.getUser();
  if (!authData.user?.email) {
    return NextResponse.json({ error: "Login required." }, { status: 401 });
  }

  // Verify the supplied current password by attempting a fresh sign-in on
  // a throwaway client. Anon key + persistSession:false means this never
  // touches the user's real cookie session.
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    return NextResponse.json({ error: "Supabase is not configured." }, { status: 500 });
  }
  const verifier = createSupabaseClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false }
  });
  const { error: verifyError } = await verifier.auth.signInWithPassword({
    email: authData.user.email,
    password: currentPassword
  });

  const admin = createAdminClient();

  if (verifyError) {
    if (admin) {
      await writeAuditLog(admin, {
        actorProfileId: authData.user.id,
        actorRole: authData.user.user_metadata?.role ?? null,
        action: "password_change_rejected_wrong_current",
        entityType: "profile",
        entityId: authData.user.id,
        request,
        metadata: { email: authData.user.email }
      });
    }
    return NextResponse.json({ error: "Current password is incorrect." }, { status: 401 });
  }

  // Verified — update via the user's own session client. updateUser uses
  // the JWT in cookies so the change is tied to the authenticated user
  // and respects whatever auth hooks Supabase has configured.
  const { error: updateError } = await supabase.auth.updateUser({ password: newPassword });
  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 400 });
  }

  if (admin) {
    await writeAuditLog(admin, {
      actorProfileId: authData.user.id,
      actorRole: authData.user.user_metadata?.role ?? null,
      action: "password_changed",
      entityType: "profile",
      entityId: authData.user.id,
      request,
      metadata: { email: authData.user.email }
    });
  }

  return NextResponse.json({ status: "ok" });
}
