import { NextResponse } from "next/server";
import { trackEvent, userEventBase } from "@/lib/analytics/track";
import { applyLedgerEvent } from "@/lib/engines/outcome-ledger";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const allowedStatuses = ["approved", "revision_requested"] as const;

export async function POST(request: Request) {
  const body = await request.json();
  const deliverableId = String(body.deliverable_id ?? "").trim();
  const status = String(body.status ?? "").trim() as typeof allowedStatuses[number];
  const reviewNotes = String(body.review_notes ?? "").trim();

  if (!deliverableId || !allowedStatuses.includes(status)) {
    return NextResponse.json({ error: "Deliverable and valid review status are required." }, { status: 400 });
  }

  const auth = await createClient();
  const { data: authData } = await auth.auth.getUser();
  if (!authData.user) return NextResponse.json({ error: "Login required." }, { status: 401 });

  const admin = createAdminClient();
  if (!admin) return NextResponse.json({ error: "Supabase service role key is not configured." }, { status: 500 });

  const { data: profile } = await admin.from("profiles").select("role").eq("id", authData.user.id).single();
  if (profile?.role !== "admin" && profile?.role !== "brand") {
    return NextResponse.json({ error: "Only brands or admins can review deliverables." }, { status: 403 });
  }

  const { data: deliverable } = await admin.from("deliverables").select("*").eq("id", deliverableId).single();
  if (!deliverable) return NextResponse.json({ error: "Deliverable not found." }, { status: 404 });
  const canReview = profile?.role === "admin" || await ownsDeliverableWork(admin, deliverable, authData.user.id, authData.user.email ?? "");
  if (!canReview) {
    return NextResponse.json({ error: "Not allowed to review this deliverable." }, { status: 403 });
  }

  const { data, error } = await admin
    .from("deliverables")
    .update({
      status,
      review_notes: reviewNotes,
      approved_at: status === "approved" ? new Date().toISOString() : null
    })
    .eq("id", deliverableId)
    .select("*")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  if (deliverable.deal_id) {
    await updateDealAfterReview(admin, String(deliverable.deal_id), status);
  }

  if (deliverable.freelancer_project_id) {
    await updateProjectAfterReview(admin, String(deliverable.freelancer_project_id), status);
  }

  await trackEvent(admin, {
    ...userEventBase(authData.user, profile?.role),
    eventName: status === "approved" ? "deliverable_approved" : "deliverable_revision_requested",
    entityType: deliverable.deal_id ? "deal" : "freelancer_project",
    entityId: String(deliverable.deal_id ?? deliverable.freelancer_project_id),
    metadata: { deliverable_id: deliverableId, has_review_notes: Boolean(reviewNotes) }
  });
  await applyDeliverableLedgerEvent(admin, deliverable, status, reviewNotes);

  return NextResponse.json({ data });
}

async function applyDeliverableLedgerEvent(
  admin: NonNullable<ReturnType<typeof createAdminClient>>,
  deliverable: Record<string, unknown>,
  status: "approved" | "revision_requested",
  reviewNotes: string
) {
  if (deliverable.deal_id) {
    const { data: deal } = await admin.from("deals").select("id, campaign_id, creator_id, amount_cents").eq("id", deliverable.deal_id).maybeSingle();
    if (!deal) return;
    await applyLedgerEvent(admin, {
      amountCents: Number(deal.amount_cents ?? 0),
      campaignId: deal.campaign_id ? String(deal.campaign_id) : null,
      deliverableStatus: status,
      entityId: String(deal.creator_id),
      entityType: "creator",
      eventName: status === "approved" ? "deliverable_approved" : "deliverable_revision_requested",
      notes: reviewNotes,
      offerId: String(deal.id)
    });
  }
  if (deliverable.freelancer_project_id) {
    const { data: project } = await admin.from("freelancer_projects").select("id, campaign_id, freelancer_id, amount_cents").eq("id", deliverable.freelancer_project_id).maybeSingle();
    if (!project) return;
    await applyLedgerEvent(admin, {
      amountCents: Number(project.amount_cents ?? 0),
      campaignId: project.campaign_id ? String(project.campaign_id) : null,
      deliverableStatus: status,
      entityId: String(project.freelancer_id),
      entityType: "freelancer",
      eventName: status === "approved" ? "deliverable_approved" : "deliverable_revision_requested",
      freelancerProjectId: String(project.id),
      notes: reviewNotes
    });
  }
}

async function updateDealAfterReview(admin: NonNullable<ReturnType<typeof createAdminClient>>, dealId: string, status: "approved" | "revision_requested") {
  const nextDeliverableStatus = status === "approved" ? "approved" : "revision_requested";
  const { data: deal } = await admin
    .from("deals")
    .update(status === "approved"
      ? { deliverable_status: nextDeliverableStatus, stage: "approved", payment_status: "release_ready" }
      : { deliverable_status: nextDeliverableStatus, stage: "live" })
    .eq("id", dealId)
    .select("*")
    .single();

  if (status === "approved" && deal) {
    await admin.from("payments").upsert({
      deal_id: dealId,
      amount_cents: Number(deal.amount_cents ?? 0),
      platform_fee_cents: Math.round(Number(deal.amount_cents ?? 0) * 0.1),
      creator_payout_cents: Math.max(0, Number(deal.amount_cents ?? 0) - Math.round(Number(deal.amount_cents ?? 0) * 0.1)),
      status: "release_ready",
      funded_at: new Date().toISOString()
    }, { onConflict: "deal_id" });
  }
}

async function updateProjectAfterReview(admin: NonNullable<ReturnType<typeof createAdminClient>>, projectId: string, status: "approved" | "revision_requested") {
  await admin
    .from("freelancer_projects")
    .update(status === "approved"
      ? { deliverable_status: "approved", payment_status: "release_ready" }
      : { deliverable_status: "revision_requested" })
    .eq("id", projectId);
}

async function ownsDeliverableWork(
  admin: NonNullable<ReturnType<typeof createAdminClient>>,
  deliverable: Record<string, unknown>,
  profileId: string,
  email: string
) {
  const brandIds = await getBrandIdsForUser(admin, profileId, email);
  if (deliverable.deal_id) {
    const { data: deal } = await admin.from("deals").select("brand_id, campaign_id").eq("id", deliverable.deal_id).maybeSingle();
    if (deal?.brand_id && brandIds.includes(String(deal.brand_id))) return true;
    if (deal?.campaign_id) {
      const { data: campaign } = await admin.from("campaigns").select("profile_id").eq("id", deal.campaign_id).maybeSingle();
      return campaign?.profile_id === profileId;
    }
  }
  if (deliverable.freelancer_project_id) {
    const { data: project } = await admin.from("freelancer_projects").select("brand_id, campaign_id").eq("id", deliverable.freelancer_project_id).maybeSingle();
    if (project?.brand_id && brandIds.includes(String(project.brand_id))) return true;
    if (project?.campaign_id) {
      const { data: campaign } = await admin.from("campaigns").select("profile_id").eq("id", project.campaign_id).maybeSingle();
      return campaign?.profile_id === profileId;
    }
  }
  return false;
}

async function getBrandIdsForUser(admin: NonNullable<ReturnType<typeof createAdminClient>>, profileId: string, email: string) {
  const [{ data: brands }, { data: audits }, { data: campaigns }] = await Promise.all([
    admin.from("brands").select("id").eq("contact_email", email),
    admin.from("brand_audits").select("brand_id").eq("profile_id", profileId),
    admin.from("campaigns").select("brand_id").eq("profile_id", profileId)
  ]);

  return Array.from(new Set([
    ...((brands ?? []).map((brand) => String(brand.id))),
    ...((audits ?? []).map((audit) => String(audit.brand_id)).filter(Boolean)),
    ...((campaigns ?? []).map((campaign) => String(campaign.brand_id)).filter(Boolean))
  ]));
}
