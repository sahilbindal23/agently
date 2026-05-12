import { NextResponse } from "next/server";
import { passwordResetEmail, sendEmail } from "@/lib/email/send";
import { writeAuditLog } from "@/lib/security/audit";
import { createAdminClient } from "@/lib/supabase/admin";

// Forgot password endpoint.
//
// Security notes:
//   - We ALWAYS return 200 with the same message regardless of whether the
//     email exists. Returning 404 (or different copy) on unknown emails is
//     an email-enumeration vulnerability — attackers can probe which addresses
//     have accounts.
//   - The recovery link is generated via Supabase admin.generateLink with
//     type: "recovery" so Supabase signs it with its JWT secret and bakes
//     in a short TTL. We send via Resend (consistent with signup) instead
//     of relying on Supabase's built-in email so the template matches our
//     brand and uses our verified sending domain.
//   - We audit-log the request keyed on email (not profile_id, since the
//     account may not exist). Useful for spotting credential-stuffing waves.

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const email = String(body.email ?? "").trim().toLowerCase();

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: "Please enter a valid email address." }, { status: 400 });
  }

  const admin = createAdminClient();
  if (!admin) {
    return NextResponse.json({ error: "Supabase service role key is not configured." }, { status: 500 });
  }

  const { data: profile } = await admin
    .from("profiles")
    .select("id, full_name")
    .eq("email", email)
    .maybeSingle();

  // Always log the attempt regardless of whether the email exists, so
  // spikes in failed attempts surface in audit logs.
  await writeAuditLog(admin, {
    actorProfileId: profile?.id ?? null,
    actorRole: null,
    action: profile ? "password_reset_requested" : "password_reset_requested_unknown_email",
    entityType: "profile",
    entityId: profile?.id ?? null,
    request,
    metadata: { email }
  });

  // No account? Pretend we sent it and bail. This avoids leaking which
  // emails are registered.
  if (!profile) {
    return NextResponse.json({ status: "ok", message: "If an account exists for that email, a reset link has been sent." });
  }

  const appUrl = process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const { data, error } = await admin.auth.admin.generateLink({
    type: "recovery",
    email,
    options: {
      redirectTo: `${appUrl}/auth/callback?next=/reset-password`
    }
  });

  if (error || !data) {
    // Same opaque response so callers can't distinguish "no account" from
    // "internal error" — but we surface the issue to our own monitoring.
    console.error("forgot-password: generateLink failed", error);
    return NextResponse.json({ status: "ok", message: "If an account exists for that email, a reset link has been sent." });
  }

  const resetUrl = (data as { properties?: { action_link?: string } }).properties?.action_link;
  if (!resetUrl) {
    console.error("forgot-password: missing action_link on Supabase response");
    return NextResponse.json({ status: "ok", message: "If an account exists for that email, a reset link has been sent." });
  }

  const sendResult = await sendEmail({
    to: email,
    subject: "Reset your Agently password",
    html: passwordResetEmail({
      fullName: profile.full_name ?? null,
      resetUrl
    })
  });

  if (!sendResult.sent) {
    console.error("forgot-password: email send failed", sendResult.error);
  }

  return NextResponse.json({ status: "ok", message: "If an account exists for that email, a reset link has been sent." });
}
