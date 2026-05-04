import { NextResponse } from "next/server";
import { trackEvent, userEventBase } from "@/lib/analytics/track";
import { applyLedgerEvent } from "@/lib/engines/outcome-ledger";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const allowedStatuses = ["unpaid", "pending", "funded", "release_ready", "released", "refunded", "disputed"] as const;
type EntityType = "deal" | "freelancer_project";

export async function POST(request: Request) {
  const body = await request.json();
  const entityType = String(body.entity_type ?? "deal") as EntityType;
  const entityId = String(body.entity_id ?? "").trim();
  const status = String(body.status ?? "").trim() as typeof allowedStatuses[number];

  if (!entityId || (entityType !== "deal" && entityType !== "freelancer_project") || !allowedStatuses.includes(status)) {
    return NextResponse.json({ error: "Entity, entity type, and valid payment status are required." }, { status: 400 });
  }

  const auth = await createClient();
  const { data: authData } = await auth.auth.getUser();
  if (!authData.user) return NextResponse.json({ error: "Login required." }, { status: 401 });

  const admin = createAdminClient();
  if (!admin) return NextResponse.json({ error: "Supabase service role key is not configured." }, { status: 500 });

  const { data: profile } = await admin.from("profiles").select("role").eq("id", authData.user.id).single();
  if (profile?.role !== "admin" && profile?.role !== "brand") {
    return NextResponse.json({ error: "Only brands or admins can update payment status in this prototype." }, { status: 403 });
  }
  if (profile?.role === "brand" && !["pending", "funded"].includes(status)) {
    return NextResponse.json({ error: "Brands can only mark owned work as pending or funded. Release, refund, and dispute states require admin review." }, { status: 403 });
  }
  const brandIds = profile?.role === "brand" ? await getBrandIdsForUser(admin, authData.user.id, authData.user.email ?? "") : [];

  if (entityType === "deal") {
    if (profile?.role === "brand") {
      const { data: deal } = await admin.from("deals").select("brand_id").eq("id", entityId).single();
      if (!deal || !brandIds.includes(String(deal.brand_id))) {
        return NextResponse.json({ error: "Not allowed to update this deal payment." }, { status: 403 });
      }
    }

    const { data, error } = await admin
      .from("deals")
      .update({ payment_status: status })
      .eq("id", entityId)
      .select("*")
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    await upsertPaymentForDeal(admin, data, status);
    await trackEvent(admin, {
      ...userEventBase(authData.user, profile?.role),
      eventName: "payment_status_updated",
      entityType,
      entityId,
      metadata: { status, amount_cents: data.amount_cents, brand_id: data.brand_id }
    });
    await applyLedgerEvent(admin, {
      amountCents: Number(data.amount_cents ?? 0),
      campaignId: data.campaign_id ? String(data.campaign_id) : null,
      entityId: String(data.creator_id),
      entityType: "creator",
      eventName: "payment_status_updated",
      offerId: entityId,
      paymentStatus: status
    });
    return NextResponse.json({ data });
  }

  if (profile?.role === "brand") {
    const { data: project } = await admin.from("freelancer_projects").select("brand_id").eq("id", entityId).single();
    if (!project || !brandIds.includes(String(project.brand_id))) {
      return NextResponse.json({ error: "Not allowed to update this project payment." }, { status: 403 });
    }
  }

  const { data, error } = await admin
    .from("freelancer_projects")
    .update({ payment_status: status })
    .eq("id", entityId)
    .select("*")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  await upsertPaymentForProject(admin, data, status);
  await trackEvent(admin, {
    ...userEventBase(authData.user, profile?.role),
    eventName: "payment_status_updated",
    entityType,
    entityId,
    metadata: { status, amount_cents: data.amount_cents, brand_id: data.brand_id }
  });
  await applyLedgerEvent(admin, {
    amountCents: Number(data.amount_cents ?? 0),
    campaignId: data.campaign_id ? String(data.campaign_id) : null,
    entityId: String(data.freelancer_id),
    entityType: "freelancer",
    eventName: "payment_status_updated",
    freelancerProjectId: entityId,
    paymentStatus: status
  });
  return NextResponse.json({ data });
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

async function upsertPaymentForDeal(admin: NonNullable<ReturnType<typeof createAdminClient>>, deal: Record<string, unknown>, status: string) {
  const amount = Number(deal.amount_cents ?? 0);
  const platformFee = Math.round(amount * 0.1);
  await admin.from("payments").upsert({
    deal_id: String(deal.id),
    amount_cents: amount,
    platform_fee_cents: platformFee,
    creator_payout_cents: Math.max(0, amount - platformFee),
    status,
    funded_at: status === "funded" ? new Date().toISOString() : null,
    released_at: status === "released" ? new Date().toISOString() : null
  }, { onConflict: "deal_id" });
}

async function upsertPaymentForProject(admin: NonNullable<ReturnType<typeof createAdminClient>>, project: Record<string, unknown>, status: string) {
  const amount = Number(project.amount_cents ?? 0);
  const platformFee = Math.round(amount * 0.1);
  await admin.from("payments").upsert({
    deal_id: null,
    freelancer_project_id: String(project.id),
    amount_cents: amount,
    platform_fee_cents: platformFee,
    creator_payout_cents: Math.max(0, amount - platformFee),
    status,
    funded_at: status === "funded" ? new Date().toISOString() : null,
    released_at: status === "released" ? new Date().toISOString() : null
  }, { onConflict: "freelancer_project_id" });
}
