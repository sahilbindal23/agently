import { NextResponse } from "next/server";
import { runWorkflowAutomations } from "@/lib/workflow/automation";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export async function POST() {
  const auth = await createClient();
  const { data: authData } = await auth.auth.getUser();
  if (!authData.user) return NextResponse.json({ error: "Login required." }, { status: 401 });

  const admin = createAdminClient();
  if (!admin) return NextResponse.json({ error: "Supabase service role key is not configured." }, { status: 500 });

  const { data: profile } = await admin.from("profiles").select("role").eq("id", authData.user.id).single();
  if (profile?.role !== "admin") {
    return NextResponse.json({ error: "Only admins can run workflow automations." }, { status: 403 });
  }

  const result = await runWorkflowAutomations(admin);
  return NextResponse.json(result);
}
