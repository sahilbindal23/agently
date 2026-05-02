import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const { email, password } = await request.json();
  const normalizedEmail = String(email ?? "").trim().toLowerCase();

  if (!normalizedEmail || !password) {
    return NextResponse.json({ error: "Email and password are required." }, { status: 400 });
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
    ? await admin.from("profiles").select("role").eq("id", data.user.id).single()
    : { data: null };
  const role = profileResult.data?.role ?? "admin";
  if (admin) {
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
    next_url: role === "creator" ? "/creator-home" : role === "brand" ? "/brand-home" : role === "freelancer" ? "/freelancer-home" : "/dashboard"
  });
}
