import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const BLOCKED_LOGIN_EMAILS = new Set([
  "admin@agently.demo",
  "brand@agently.demo",
  "creator@agently.demo",
  "freelancer@agently.demo"
]);

export async function POST(request: Request) {
  const { email, password } = await request.json();
  const normalizedEmail = String(email ?? "").trim().toLowerCase();

  if (!normalizedEmail || !password) {
    return NextResponse.json({ error: "Email and password are required." }, { status: 400 });
  }

  if (BLOCKED_LOGIN_EMAILS.has(normalizedEmail)) {
    return NextResponse.json({ error: "This test login has been retired." }, { status: 403 });
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({
    email: normalizedEmail,
    password: String(password)
  });

  if (error || !data.user) {
    return NextResponse.json({ error: error?.message ?? "Could not sign in." }, { status: 401 });
  }

  const admin = createAdminClient();
  const profileResult = admin
    ? await admin.from("profiles").select("role, account_status").eq("id", data.user.id).single()
    : { data: null };

  // Frozen accounts cannot log in. Sign them out of the session we just
  // created and return a friendly 403 — generic enough that we don't tell
  // an attacker exactly why their password worked but login was denied.
  if (profileResult.data?.account_status === "frozen") {
    await supabase.auth.signOut();
    return NextResponse.json({
      error: "This account is currently suspended. Contact support@agently.in for help."
    }, { status: 403 });
  }

  // Fail closed: never default a missing-profile login to "admin".
  const role = profileResult.data?.role ?? "";
  if (admin && role) {
    await admin.auth.admin.updateUserById(data.user.id, {
      user_metadata: {
        ...data.user.user_metadata,
        role
      }
    });
  }

  return NextResponse.json({
    user_id: data.user.id,
    role,
    next_url:
      role === "creator" ? "/creator-home" :
      role === "brand" ? "/brand-home" :
      role === "freelancer" ? "/freelancer-home" :
      role === "admin" ? "/dashboard" :
      "/"
  });
}
