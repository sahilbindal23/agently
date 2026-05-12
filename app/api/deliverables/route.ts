import { NextResponse } from "next/server";
import { z } from "zod";
import { trackEvent, userEventBase } from "@/lib/analytics/track";
import { notifyDeliverableSubmitted } from "@/lib/email/workflow";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const schema = z.object({
  entity_type: z.enum(["deal", "freelancer_project"]).default("deal"),
  entity_id: z.string().trim().min(1, "Work item ID is required."),
  content_url: z.string().trim().url("A valid deliverable URL is required."),
  platform: z.string().trim().max(80).optional().default(""),
  title: z.string().trim().max(200).optional().default(""),
  notes: z.string().trim().max(2000).optional().default("")
});

export async function POST(request: Request) {
  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid request." }, { status: 400 });
  }
  const { entity_type: entityType, entity_id: entityId, content_url: contentUrl, platform, title, notes } = parsed.data;

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

  await trackEvent(admin, {
    ...userEventBase(authData.user),
    eventName: "deliverable_submitted",
    entityType,
    entityId,
    metadata: { deliverable_id: data.id, platform, has_notes: Boolean(notes) }
  });
  await notifyDeliverableSubmitted(admin, String(data.id));

  return NextResponse.json({ data }, { status: 201 });
}

async function canSubmitDeal(admin: NonNullable<ReturnType<typeof createAdminClient>>, dealId: string, userId: string) {
  const { data: deal } = await admin.from("deals").select("creator_id, offer_status, payment_status").eq("id", dealId).single();
  if (!deal) return false;
  if (String(deal.offer_status ?? "") !== "accepted" || !["funded", "release_ready"].includes(String(deal.payment_status ?? ""))) return false;
  const { data: creator } = await admin.from("creators").select("profile_id").eq("id", deal.creator_id).single();
  const { data: profile } = await admin.from("profiles").select("role").eq("id", userId).single();
  return creator?.profile_id === userId || profile?.role === "admin";
}

async function canSubmitProject(admin: NonNullable<ReturnType<typeof createAdminClient>>, projectId: string, userId: string) {
  const { data: project } = await admin.from("freelancer_projects").select("freelancer_id, status, payment_status").eq("id", projectId).single();
  if (!project) return false;
  if (String(project.status ?? "") !== "accepted" || !["funded", "release_ready"].includes(String(project.payment_status ?? ""))) return false;
  const { data: freelancer } = await admin.from("freelancers").select("profile_id").eq("id", project.freelancer_id).single();
  const { data: profile } = await admin.from("profiles").select("role").eq("id", userId).single();
  return freelancer?.profile_id === userId || profile?.role === "admin";
}
