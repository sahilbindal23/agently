import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

type EntityType = "deal" | "freelancer_project";

export async function POST(request: Request) {
  const body = await request.json();
  const entityType = String(body.entity_type ?? "deal") as EntityType;
  const entityId = String(body.entity_id ?? "").trim();
  const contentUrl = String(body.content_url ?? "").trim();
  const platform = String(body.platform ?? "").trim();
  const title = String(body.title ?? "").trim();
  const notes = String(body.notes ?? "").trim();

  if (!entityId || !contentUrl || (entityType !== "deal" && entityType !== "freelancer_project")) {
    return NextResponse.json({ error: "Work item and deliverable URL are required." }, { status: 400 });
  }

  const auth = await createClient();
  const { data: authData } = await auth.auth.getUser();
  if (!authData.user) return NextResponse.json({ error: "Login required." }, { status: 401 });

  const admin = createAdminClient();
  if (!admin) return NextResponse.json({ error: "Supabase service role key is not configured." }, { status: 500 });

  const allowed = entityType === "deal"
    ? await canSubmitDeal(admin, entityId, authData.user.id)
    : await canSubmitProject(admin, entityId, authData.user.id);

  if (!allowed) {
    return NextResponse.json({ error: "Not allowed to submit deliverables for this item." }, { status: 403 });
  }

  const payload = {
    deal_id: entityType === "deal" ? entityId : null,
    freelancer_project_id: entityType === "freelancer_project" ? entityId : null,
    title: title || "Submitted deliverable",
    platform,
    content_url: contentUrl,
    notes,
    submitted_at: new Date().toISOString(),
    status: "submitted"
  };

  const { data, error } = await admin.from("deliverables").insert(payload).select("*").single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  if (entityType === "deal") {
    await admin.from("deals").update({ deliverable_status: "submitted", stage: "delivered" }).eq("id", entityId);
  } else {
    await admin.from("freelancer_projects").update({ deliverable_status: "submitted" }).eq("id", entityId);
  }

  return NextResponse.json({ data }, { status: 201 });
}

async function canSubmitDeal(admin: NonNullable<ReturnType<typeof createAdminClient>>, dealId: string, userId: string) {
  const { data: deal } = await admin.from("deals").select("creator_id").eq("id", dealId).single();
  if (!deal) return false;
  const { data: creator } = await admin.from("creators").select("profile_id").eq("id", deal.creator_id).single();
  const { data: profile } = await admin.from("profiles").select("role").eq("id", userId).single();
  return creator?.profile_id === userId || profile?.role === "admin";
}

async function canSubmitProject(admin: NonNullable<ReturnType<typeof createAdminClient>>, projectId: string, userId: string) {
  const { data: project } = await admin.from("freelancer_projects").select("freelancer_id").eq("id", projectId).single();
  if (!project) return false;
  const { data: freelancer } = await admin.from("freelancers").select("profile_id").eq("id", project.freelancer_id).single();
  const { data: profile } = await admin.from("profiles").select("role").eq("id", userId).single();
  return freelancer?.profile_id === userId || profile?.role === "admin";
}
