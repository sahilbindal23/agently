import { NextResponse } from "next/server";
import { z } from "zod";
import { trackEvent, userEventBase } from "@/lib/analytics/track";
import { applyLedgerEvent } from "@/lib/engines/outcome-ledger";
import { ensurePaymentRecordForEntity } from "@/lib/payments/workflow";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const schema = z.object({
  entity_type: z.enum(["deal", "freelancer_project"]).default("deal"),
  entity_id: z.string().trim().min(1, "Entity ID is required."),
  status: z.enum(["unpaid", "pending", "funded", "release_ready", "released", "refunded", "disputed"])
});

export async function POST(request: Request) {
  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid request." }, { status: 400 });
  }
  const { entity_type: entityType, entity_id: entityId, status } = parsed.data;

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
    const { data: dealCheck } = await admin.from("deals").select("brand_id, dispute_status").eq("id", entityId).single();
    if (status === "released" && dealCheck?.dispute_status === "open") {
      return NextResponse.json({ error: "Cannot release payment while a dispute is open on this deal." }, { status: 409 });
    }
    if (profile?.role === "brand") {
      if (!dealCheck || !brandIds.includes(String(dealCheck.brand_id))) {
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

  const { data: projectCheck } = await admin.from("freelancer_projects").select("brand_id, dispute_status").eq("id", entityId).single();
  if (status === "released" && projectCheck?.dispute_status === "open") {
    return NextResponse.json({ error: "Cannot release payment while a dispute is open on this project." }, { status: 409 });
  }
  if (profile?.role === "brand") {
    if (!projectCheck || !brandIds.includes(String(projectCheck.brand_id))) {
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
  await ensurePaymentRecordForEntity(admin, "deal", deal, status);
}

async function upsertPaymentForProject(admin: NonNullable<ReturnType<typeof createAdminClient>>, project: Record<string, unknown>, status: string) {
  await ensurePaymentRecordForEntity(admin, "freelancer_project", project, status);
}
