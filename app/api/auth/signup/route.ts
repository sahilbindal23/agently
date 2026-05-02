import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

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

  const supabase = createAdminClient();
  if (!supabase) {
    return NextResponse.json({ error: "Supabase service role key is not configured." }, { status: 500 });
  }

  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: {
      full_name: fullName,
      role,
      intake_completed: false
    }
  });

  if (error || !data.user) {
    return NextResponse.json({ error: error?.message ?? "Could not create account." }, { status: 400 });
  }

  const { error: profileError } = await supabase.from("profiles").insert({
    id: data.user.id,
    email,
    full_name: fullName,
    role
  });

  if (profileError) {
    return NextResponse.json({ error: profileError.message }, { status: 500 });
  }

  return NextResponse.json({ user_id: data.user.id, role, next_url: "/intake" }, { status: 201 });
}
