import { NextResponse } from "next/server";
import { trackEvent } from "@/lib/analytics/track";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const allowedKinds = ["deal", "project"] as const;
const allowedActions = ["accept", "decline"] as const;

export async function POST(request: Request) {
  const body = await request.json();
  const kind = String(body.kind ?? "").trim() as typeof allowedKinds[number];
  const id = String(body.id ?? "").trim();
  const action = String(body.action ?? "").trim() as typeof allowedActions[number];

  if (!id || !allowedKinds.includes(kind) || !allowedActions.includes(action)) {
    return NextResponse.json({ error: "Valid counter target and action are required." }, { status: 400 });
  }

  const auth = await createClient();
  const { data: authData } = await auth.auth.getUser();
  if (!authData.user) return NextResponse.json({ error: "Login required." }, { status: 401 });

  const admin = createAdminClient();
  if (!admin) return NextResponse.json({ error: "Supabase service role key is not configured." }, { status: 500 });

  if (kind === "deal") return respondToDealCounter(admin, authData.user.id, authData.user.email ?? "", id, action);
  return respondToProjectCounter(admin, authData.user.id, authData.user.email ?? "", id, action);
}

async function respondToDealCounter(
  admin: NonNullable<ReturnType<typeof createAdminClient>>,
  profileId: string,
  email: string,
  dealId: string,
  action: "accept" | "decline"
) {
  const { data: deal } = await admin.from("deals").select("*").eq("id", dealId).single();
  if (!deal) return NextResponse.json({ error: "Offer not found." }, { status: 404 });
  if (!await canManageBrand(admin, profileId, email, String(deal.brand_id))) return NextResponse.json({ error: "Not allowed to manage this counter." }, { status: 403 });

  const accepted = action === "accept";
  const updates = accepted ? {
    amount_cents: deal.counter_amount_cents ?? deal.amount_cents,
    deliverables: deal.counter_deliverables || deal.deliverables,
    due_date: deal.counter_due_date || deal.due_date,
    offer_status: "accepted",
    stage: "negotiating",
    counter_status: "accepted",
    counter_responded_at: new Date().toISOString(),
    notes: [deal.notes, "Brand accepted the structured counter. Offer terms were updated from the counter proposal."].filter(Boolean).join("\n")
  } : {
    counter_status: "declined",
    counter_responded_at: new Date().toISOString(),
    notes: [deal.notes, "Brand declined the structured counter. Original offer remains unchanged unless a revised offer is sent."].filter(Boolean).join("\n")
  };

  const { data, error } = await admin.from("deals").update(updates).eq("id", dealId).select("*").single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  await trackEvent(admin, {
    profileId,
    role: "brand",
    eventName: accepted ? "counter_accepted" : "counter_declined",
    entityType: "deal",
    entityId: dealId,
    metadata: { brand_id: deal.brand_id, creator_id: deal.creator_id, amount_cents: data.amount_cents }
  });
  return NextResponse.json({ data });
}

async function respondToProjectCounter(
  admin: NonNullable<ReturnType<typeof createAdminClient>>,
  profileId: string,
  email: string,
  projectId: string,
  action: "accept" | "decline"
) {
  const { data: project } = await admin.from("freelancer_projects").select("*").eq("id", projectId).single();
  if (!project) return NextResponse.json({ error: "Project not found." }, { status: 404 });
  if (!await canManageBrand(admin, profileId, email, String(project.brand_id))) return NextResponse.json({ error: "Not allowed to manage this counter." }, { status: 403 });

  const accepted = action === "accept";
  const updates = accepted ? {
    amount_cents: project.counter_amount_cents ?? project.amount_cents,
    scope: project.counter_scope || project.scope,
    due_date: project.counter_due_date || project.due_date,
    usage_context: project.counter_usage_rights || project.usage_context,
    approval_terms: project.counter_approval_terms || project.approval_terms,
    status: "accepted",
    counter_status: "accepted",
    counter_responded_at: new Date().toISOString(),
    notes: [project.notes, "Brand accepted the structured counter. Project terms were updated from the counter proposal."].filter(Boolean).join("\n")
  } : {
    counter_status: "declined",
    counter_responded_at: new Date().toISOString(),
    notes: [project.notes, "Brand declined the structured counter. Original project offer remains unchanged unless revised."].filter(Boolean).join("\n")
  };

  const { data, error } = await admin.from("freelancer_projects").update(updates).eq("id", projectId).select("*").single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  await trackEvent(admin, {
    profileId,
    role: "brand",
    eventName: accepted ? "counter_accepted" : "counter_declined",
    entityType: "freelancer_project",
    entityId: projectId,
    metadata: { brand_id: project.brand_id, freelancer_id: project.freelancer_id, amount_cents: data.amount_cents }
  });
  return NextResponse.json({ data });
}

async function canManageBrand(admin: NonNullable<ReturnType<typeof createAdminClient>>, profileId: string, email: string, brandId: string) {
  const [{ data: profile }, { data: brand }, { data: audit }, { data: campaign }] = await Promise.all([
    admin.from("profiles").select("role").eq("id", profileId).single(),
    admin.from("brands").select("contact_email").eq("id", brandId).single(),
    admin.from("brand_audits").select("id").eq("profile_id", profileId).eq("brand_id", brandId).maybeSingle(),
    admin.from("campaigns").select("id").eq("profile_id", profileId).eq("brand_id", brandId).limit(1).maybeSingle()
  ]);
  if (profile?.role === "admin") return true;
  if (brand?.contact_email && String(brand.contact_email).toLowerCase() === email.toLowerCase()) return true;
  return Boolean(audit || campaign);
}
