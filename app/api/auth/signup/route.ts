import { NextResponse } from "next/server";
import { sendEmail, signupConfirmationEmail } from "@/lib/email/send";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkFreeText, sanityErrorMessage } from "@/lib/validators/sanity";

type Role = "creator" | "brand" | "freelancer";

export async function POST(request: Request) {
  const body = await request.json();
  const role = String(body.role ?? "creator") as Role;
  const email = String(body.email ?? "").trim().toLowerCase();
  const password = String(body.password ?? "");
  const fullName = String(body.full_name ?? "").trim();
  const consent = body.consent as { accepted?: boolean; accepted_at?: string; privacy_version?: string; terms_version?: string } | undefined;

  if (!email || !password || !fullName) {
    return NextResponse.json({ error: "Full name, email, and password are required." }, { status: 400 });
  }

  // DPDP Act 2023 (India) and good practice everywhere: do not create an
  // account without an explicit, recorded consent to Privacy + Terms.
  if (!consent?.accepted) {
    return NextResponse.json({
      error: "You must agree to the Privacy Policy and Terms of Service to create an account."
    }, { status: 400 });
  }

  if (role !== "creator" && role !== "brand" && role !== "freelancer") {
    return NextResponse.json({ error: "Choose creator, brand, or freelancer." }, { status: 400 });
  }

  // Sanity check the name. Rejects "fucker", "asdf", "TEST TEST", etc.
  const nameCheck = checkFreeText(fullName, { fieldLabel: "Full name", minLength: 2, maxLength: 120 });
  if (!nameCheck.ok) {
    return NextResponse.json({ error: sanityErrorMessage(nameCheck, "Full name") }, { status: 400 });
  }

  // Basic email format check (Supabase will validate again, but a clear
  // upfront message beats a generic auth error)
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: "Please enter a valid email address." }, { status: 400 });
  }

  if (password.length < 8) {
    return NextResponse.json({ error: "Password must be at least 8 characters." }, { status: 400 });
  }

  const supabase = createAdminClient();
  if (!supabase) {
    return NextResponse.json({ error: "Supabase service role key is not configured." }, { status: 500 });
  }

  // Pre-check email uniqueness for a clearer error than Supabase's generic
  // "User already registered". The auth.users table is unique on email; if a
  // matching profile row already exists we know the address is taken.
  const { data: existingProfile } = await supabase
    .from("profiles")
    .select("id, role")
    .eq("email", email)
    .maybeSingle();
  if (existingProfile) {
    return NextResponse.json({
      error: "An account with this email already exists. Try logging in instead, or use a different email."
    }, { status: 409 });
  }

  const skipVerification = process.env.NEXT_PUBLIC_SKIP_EMAIL_VERIFICATION === "true";
  const appUrl = process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const metadata = {
    full_name: nameCheck.cleaned,
    role,
    intake_completed: false
  };

  const { data, error } = skipVerification
    ? await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: metadata
    })
    : await supabase.auth.admin.generateLink({
      type: "signup",
      email,
      password,
      options: {
        data: metadata,
        redirectTo: `${appUrl}/login?verified=1`
      }
    });

  if (error || !data.user) {
    const message = String(error?.message ?? "");
    // Supabase responds with various forms of "already exists" - normalise
    if (/already.*registered|already.*exists|email.*taken/i.test(message)) {
      return NextResponse.json({
        error: "An account with this email already exists. Try logging in instead."
      }, { status: 409 });
    }
    return NextResponse.json({ error: error?.message ?? "Could not create account." }, { status: 400 });
  }

  // Capture IP + UA server-side so the consent record can't be faked by a
  // client that just sets accepted=true in the JSON payload.
  const signupConsent = {
    accepted: true,
    accepted_at: consent.accepted_at ?? new Date().toISOString(),
    privacy_version: consent.privacy_version ?? "unknown",
    terms_version: consent.terms_version ?? "unknown",
    ip_address: request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? request.headers.get("x-real-ip") ?? null,
    user_agent: request.headers.get("user-agent") ?? null
  };

  const { error: profileError } = await supabase.from("profiles").insert({
    id: data.user.id,
    email,
    full_name: nameCheck.cleaned,
    role,
    signup_consent: signupConsent
  });

  if (profileError) {
    // Roll back auth user so we don't leak orphan accounts
    await supabase.auth.admin.deleteUser(data.user.id).catch(() => null);
    return NextResponse.json({ error: profileError.message }, { status: 500 });
  }

  if (!skipVerification) {
    const confirmationUrl = (data as { properties?: { action_link?: string } }).properties?.action_link;
    if (!confirmationUrl) {
      await supabase.from("profiles").delete().eq("id", data.user.id);
      await supabase.auth.admin.deleteUser(data.user.id).catch(() => null);
      return NextResponse.json({ error: "Could not generate verification link." }, { status: 500 });
    }

    const confirmationTemplate = signupConfirmationEmail({
      fullName: nameCheck.cleaned,
      confirmationUrl
    });
    const emailResult = await sendEmail({
      to: email,
      subject: "Verify your Agently account",
      html: confirmationTemplate.html,
      text: confirmationTemplate.text
    });

    if (!emailResult.sent) {
      await supabase.from("profiles").delete().eq("id", data.user.id);
      await supabase.auth.admin.deleteUser(data.user.id).catch(() => null);
      return NextResponse.json({
        error: `Account was not created because the verification email could not be sent: ${emailResult.error ?? "email provider error"}`
      }, { status: 500 });
    }

    return NextResponse.json({
      user_id: data.user.id,
      role,
      requires_email_verification: true,
      message: "Account created. Check your email to verify your address before logging in.",
      next_url: "/login"
    }, { status: 201 });
  }

  return NextResponse.json({ user_id: data.user.id, role, next_url: "/intake" }, { status: 201 });
}
