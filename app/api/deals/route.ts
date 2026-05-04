import { NextResponse } from "next/server";
import { z } from "zod";
import { trackEvent, userEventBase } from "@/lib/analytics/track";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

type Row = Record<string, unknown>;

const dealSchema = z.object({
  campaign_id: z.string().uuid().optional().or(z.literal("")),
  creator_id: z.string().uuid(),
  brand_name: z.string().trim().min(1).max(120).optional(),
  brand_contact_email: z.string().trim().email().optional().or(z.literal("")),
  brand_website: z.string().trim().max(240).optional().or(z.literal("")),
  brand_industry: z.string().trim().max(100).optional().or(z.literal("")),
  title: z.string().trim().min(1).max(160),
  deliverables: z.string().trim().min(1).max(2500),
  amount_cents: z.coerce.number().int().positive().max(1_000_000_000),
  due_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().or(z.literal("")),
  campaign_goal: z.string().trim().max(1200).optional().or(z.literal("")),
  notes: z.string().trim().max(2500).optional().or(z.literal(""))
});

export async function GET() {
  const auth = await createClient();
  const { data: authData } = await auth.auth.getUser();
  if (!authData.user) return NextResponse.json({ error: "Login required." }, { status: 401 });

  const admin = createAdminClient();
  if (!admin) return NextResponse.json({ error: "Supabase service role key is not configured." }, { status: 500 });

  const role = await getRole(admin, authData.user.id);
  if (role === "admin") {
    const { data, error } = await admin.from("deals").select("*").order("created_at", { ascending: false });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ data: data ?? [], source: "supabase" });
  }

  if (role === "creator") {
    const { data: creator } = await admin.from("creators").select("id").eq("profile_id", authData.user.id).maybeSingle();
    if (!creator) return NextResponse.json({ data: [], source: "supabase" });
    const { data, error } = await admin.from("deals").select("*").eq("creator_id", creator.id).order("created_at", { ascending: false });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ data: data ?? [], source: "supabase" });
  }

  if (role === "brand") {
    const [brandsResult, campaignsResult] = await Promise.all([
      admin.from("brands").select("id").eq("contact_email", normalizeEmail(authData.user.email)),
      admin.from("campaigns").select("id, brand_id").eq("profile_id", authData.user.id)
    ]);
    if (brandsResult.error || campaignsResult.error) {
      return NextResponse.json({ error: brandsResult.error?.message ?? campaignsResult.error?.message }, { status: 500 });
    }

    const brandIds = unique([
      ...(brandsResult.data ?? []).map((brand) => String(brand.id)),
      ...(campaignsResult.data ?? []).map((campaign) => String(campaign.brand_id ?? "")).filter(Boolean)
    ]);
    const campaignIds = (campaignsResult.data ?? []).map((campaign) => String(campaign.id));
    const dealMap = new Map<string, Row>();

    if (brandIds.length) {
      const { data, error } = await admin.from("deals").select("*").in("brand_id", brandIds).order("created_at", { ascending: false });
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      for (const deal of data ?? []) dealMap.set(String(deal.id), deal);
    }
    if (campaignIds.length) {
      const { data, error } = await admin.from("deals").select("*").in("campaign_id", campaignIds).order("created_at", { ascending: false });
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      for (const deal of data ?? []) dealMap.set(String(deal.id), deal);
    }

    return NextResponse.json({ data: Array.from(dealMap.values()), source: "supabase" });
  }

  return NextResponse.json({ data: [], source: "supabase" });
}

export async function POST(request: Request) {
  const parsed = dealSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid deal payload." }, { status: 400 });
  }
  const body = parsed.data;

  const auth = await createClient();
  const { data: authData } = await auth.auth.getUser();
  if (!authData.user) return NextResponse.json({ error: "Login required." }, { status: 401 });

  const admin = createAdminClient();
  if (!admin) return NextResponse.json({ error: "Supabase service role key is not configured." }, { status: 500 });

  const role = await getRole(admin, authData.user.id);
  if (role !== "brand" && role !== "admin") {
    return NextResponse.json({ error: "Only brands or admins can create creator offers." }, { status: 403 });
  }

  const { data: creator } = await admin.from("creators").select("id").eq("id", body.creator_id).maybeSingle();
  if (!creator) return NextResponse.json({ error: "Creator not found." }, { status: 404 });

  const campaign = body.campaign_id ? await getCampaign(admin, body.campaign_id) : null;
  if (body.campaign_id && !campaign) return NextResponse.json({ error: "Campaign not found." }, { status: 404 });
  if (campaign && role !== "admin" && campaign.profile_id !== authData.user.id) {
    return NextResponse.json({ error: "Not allowed to create an offer from this campaign." }, { status: 403 });
  }
  if (!campaign && role === "admin" && !body.brand_contact_email) {
    return NextResponse.json({ error: "Brand contact email is required when an admin creates an offer outside a campaign." }, { status: 400 });
  }

  const brandResult = await resolveBrand(admin, {
    campaign,
    userEmail: authData.user.email ?? "",
    brandName: body.brand_name,
    brandEmail: body.brand_contact_email,
    brandWebsite: body.brand_website,
    brandIndustry: body.brand_industry
  });
  if ("error" in brandResult) return NextResponse.json({ error: brandResult.error }, { status: brandResult.status });

  const dealPayload = {
    creator_id: body.creator_id,
    brand_id: brandResult.brand.id,
    campaign_id: body.campaign_id || null,
    title: body.title,
    deliverables: body.deliverables,
    amount_cents: body.amount_cents,
    currency: "inr",
    stage: "lead",
    offer_status: "submitted",
    payment_status: "unpaid",
    deliverable_status: "brand_offer_submitted",
    risk_score: initialRiskScore(body),
    start_date: new Date().toISOString().slice(0, 10),
    due_date: body.due_date || null,
    notes: [
      "Brand-submitted inbound offer. Agency review required before negotiation, contract approval, or payment link generation.",
      body.campaign_goal ? `Campaign goal: ${body.campaign_goal}` : "",
      body.notes ? `Brand notes: ${body.notes}` : ""
    ].filter(Boolean).join("\n")
  };

  const { data: deal, error: dealError } = await admin
    .from("deals")
    .insert(dealPayload)
    .select("*")
    .single();

  if (dealError) {
    if (brandResult.created) await admin.from("brands").delete().eq("id", brandResult.brand.id);
    return NextResponse.json({ error: dealError.message }, { status: 500 });
  }

  await trackEvent(admin, {
    ...userEventBase(authData.user, role),
    eventName: "offer_sent",
    entityType: "deal",
    entityId: deal.id,
    metadata: {
      campaign_id: body.campaign_id || null,
      creator_id: body.creator_id,
      brand_id: brandResult.brand.id,
      amount_cents: body.amount_cents,
      risk_score: deal.risk_score
    }
  });

  return NextResponse.json({ data: deal, source: "supabase" }, { status: 201 });
}

async function getRole(admin: NonNullable<ReturnType<typeof createAdminClient>>, profileId: string) {
  const { data } = await admin.from("profiles").select("role").eq("id", profileId).maybeSingle();
  return String(data?.role ?? "admin");
}

async function getCampaign(admin: NonNullable<ReturnType<typeof createAdminClient>>, campaignId: string) {
  const { data } = await admin.from("campaigns").select("*").eq("id", campaignId).maybeSingle();
  return data as Row | null;
}

async function resolveBrand(
  admin: NonNullable<ReturnType<typeof createAdminClient>>,
  input: {
    campaign: Row | null;
    userEmail: string;
    brandName?: string;
    brandEmail?: string;
    brandWebsite?: string;
    brandIndustry?: string;
  }
): Promise<{ brand: Row; created: boolean } | { error: string; status: number }> {
  if (input.campaign?.brand_id) {
    const { data: brand } = await admin.from("brands").select("*").eq("id", input.campaign.brand_id).maybeSingle();
    if (brand) return { brand, created: false };
  }

  const email = normalizeEmail(input.brandEmail || input.userEmail);
  const name = String(input.brandName ?? "").trim();
  if (!name && !email) return { error: "Brand name or brand email is required.", status: 400 };

  if (email) {
    const { data: existing, error } = await admin.from("brands").select("*").eq("contact_email", email).maybeSingle();
    if (error) return { error: error.message, status: 500 };
    if (existing) return { brand: existing, created: false };
  }

  const { data: brand, error: brandError } = await admin
    .from("brands")
    .insert({
      name: name || "Brand",
      website: input.brandWebsite ?? "",
      industry: input.brandIndustry ?? "",
      contact_email: email,
      status: "inbound"
    })
    .select("*")
    .single();

  if (brandError || !brand) return { error: brandError?.message ?? "Could not create brand.", status: 500 };
  return { brand, created: true };
}

function initialRiskScore(body: z.infer<typeof dealSchema>) {
  const text = `${body.deliverables} ${body.notes ?? ""}`.toLowerCase();
  let score = 10;
  if (text.includes("whitelist") || text.includes("usage")) score += 8;
  if (text.includes("perpetual") || text.includes("exclusive")) score += 18;
  if (!body.due_date) score += 5;
  return Math.min(score, 100);
}

function normalizeEmail(value: unknown) {
  return String(value ?? "").trim().toLowerCase();
}

function unique(values: string[]) {
  return Array.from(new Set(values));
}
