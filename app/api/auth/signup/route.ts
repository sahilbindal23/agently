import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkFreeText, sanityErrorMessage } from "@/lib/validators/sanity";

type Role = "creator" | "brand" | "freelancer";

export async function POST(request: Request) {
  const body = await request.json();
  const role = String(body.role ?? "creator") as Role;
  const email = String(body.email ?? "").trim().toLowerCase();
  const password = String(body.password ?? "");
  const fullName = String(body.full_name ?? "").trim();

  if (!email || !password || !fullName) {
    return NextResponse.json({ error: "Full name, email, and password are required." }, { status: 400 });
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

  // Create the user. email_confirm: false sends a verification email - the
  // user can't log in until they click the link. Configure the email
  // template in Supabase Dashboard -> Auth -> Email Templates.
  // (Set NEXT_PUBLIC_SKIP_EMAIL_VERIFICATION=true in dev to bypass.)
  const skipVerification = process.env.NEXT_PUBLIC_SKIP_EMAIL_VERIFICATION === "true";
  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: skipVerification,
    user_metadata: {
      full_name: nameCheck.cleaned,
      role,
      intake_completed: false
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

  const { error: profileError } = await supabase.from("profiles").insert({
    id: data.user.id,
    email,
    full_name: nameCheck.cleaned,
    role
  });

  if (profileError) {
    // Roll back auth user so we don't leak orphan accounts
    await supabase.auth.admin.deleteUser(data.user.id).catch(() => null);
    return NextResponse.json({ error: profileError.message }, { status: 500 });
  }

  // When email verification is required, the user must check their inbox
  // and click the link before they can log in. The signup form should show
  // a "check your email" success state rather than redirecting straight in.
  if (!skipVerification) {
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
