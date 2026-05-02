import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const allowedStatuses = ["accepted", "changes_requested", "declined"] as const;

export async function POST(request: Request) {
  const body = await request.json();
  const projectId = String(body.project_id ?? "").trim();
  const status = String(body.status ?? "").trim() as typeof allowedStatuses[number];
  const response = String(body.response ?? "").trim();

  if (!projectId || !allowedStatuses.includes(status)) {
    return NextResponse.json({ error: "Project and valid response status are required." }, { status: 400 });
  }

  const auth = await createClient();
  const { data: authData } = await auth.auth.getUser();
  if (!authData.user) return NextResponse.json({ error: "Login required." }, { status: 401 });

  const admin = createAdminClient();
  if (!admin) return NextResponse.json({ error: "Supabase service role key is not configured." }, { status: 500 });

  const { data: project } = await admin.from("freelancer_projects").select("*").eq("id", projectId).single();
  if (!project) return NextResponse.json({ error: "Project not found." }, { status: 404 });

  const { data: freelancer } = await admin.from("freelancers").select("profile_id").eq("id", project.freelancer_id).single();
  const { data: profile } = await admin.from("profiles").select("role").eq("id", authData.user.id).single();
  if (freelancer?.profile_id !== authData.user.id && profile?.role !== "admin") {
    return NextResponse.json({ error: "Not allowed to respond to this project." }, { status: 403 });
  }

  const { data, error } = await admin
    .from("freelancer_projects")
    .update({
      status,
      talent_response: response,
      responded_at: new Date().toISOString(),
      notes: [project.notes, response ? `Talent response: ${response}` : ""].filter(Boolean).join("\n")
    })
    .eq("id", projectId)
    .select("*")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data });
}
