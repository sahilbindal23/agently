import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const body = await request.json();
  const auth = await createClient();
  const { data: authData } = await auth.auth.getUser();
  if (!authData.user) return NextResponse.json({ error: "Login required." }, { status: 401 });

  const admin = createAdminClient();
  if (!admin) return NextResponse.json({ error: "Supabase service role key is not configured." }, { status: 500 });

  const { data: profile } = await admin.from("profiles").select("role").eq("id", authData.user.id).single();
  const rating = Number(body.rating ?? 0);
  if (rating < 1 || rating > 5) {
    return NextResponse.json({ error: "Rating must be between 1 and 5." }, { status: 400 });
  }

  const { data, error } = await admin
    .from("tester_feedback")
    .insert({
      profile_id: authData.user.id,
      role: profile?.role ?? authData.user.user_metadata?.role ?? "tester",
      page_path: String(body.page_path ?? "").trim(),
      workflow: String(body.workflow ?? "").trim(),
      rating,
      what_worked: String(body.what_worked ?? "").trim(),
      what_was_confusing: String(body.what_was_confusing ?? "").trim(),
      missing_feature: String(body.missing_feature ?? "").trim(),
      would_use: String(body.would_use ?? "").trim()
    })
    .select("*")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data }, { status: 201 });
}
