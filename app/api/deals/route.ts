import { NextResponse } from "next/server";
import { getAgentlyData } from "@/lib/db/live-data";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET() {
  const { deals, source } = await getAgentlyData();
  return NextResponse.json({ data: deals, source });
}

export async function POST(request: Request) {
  const body = await request.json();
  const amountCents = Number(body.amount_cents ?? Number(body.amount_inr ?? body.amount_usd ?? 0) * 100);
  const title = String(body.title ?? "").trim();
  const creatorId = String(body.creator_id ?? "").trim();
  const brandName = String(body.brand_name ?? "").trim();
  const brandEmail = String(body.brand_contact_email ?? "").trim();
  const campaignId = String(body.campaign_id ?? "").trim();

  if (!title || !creatorId || !brandName || !amountCents) {
    return NextResponse.json({ error: "Title, creator, brand, and offer amount are required." }, { status: 400 });
  }

  const dealPayloadBase = {
    creator_id: creatorId,
    campaign_id: campaignId || null,
    title,
    deliverables: String(body.deliverables ?? "").trim(),
    amount_cents: amountCents,
    currency: "inr",
    stage: "lead",
    offer_status: "submitted",
    payment_status: "unpaid",
    deliverable_status: "brand_offer_submitted",
    risk_score: 10,
    start_date: new Date().toISOString().slice(0, 10),
    due_date: body.due_date || null,
    notes: [
      "Brand-submitted inbound offer. Agency review required before negotiation, contract approval, or payment link generation.",
      body.campaign_goal ? `Campaign goal: ${body.campaign_goal}` : "",
      body.notes ? `Brand notes: ${body.notes}` : ""
    ].filter(Boolean).join("\n")
  };

  const supabase = createAdminClient();
  if (!supabase) {
    return NextResponse.json({
      data: {
        id: crypto.randomUUID(),
        brand_id: crypto.randomUUID(),
        ...dealPayloadBase
      },
      source: "demo_create"
    }, { status: 201 });
  }

  const { data: brand, error: brandError } = await supabase
    .from("brands")
    .insert({
      name: brandName,
      website: String(body.brand_website ?? "").trim(),
      industry: String(body.brand_industry ?? "").trim(),
      contact_email: brandEmail,
      status: "inbound"
    })
    .select("*")
    .single();

  if (brandError) {
    return NextResponse.json({ error: brandError.message }, { status: 500 });
  }

  const { data: deal, error: dealError } = await supabase
    .from("deals")
    .insert({ ...dealPayloadBase, brand_id: brand.id })
    .select("*")
    .single();

  if (dealError) {
    return NextResponse.json({ error: dealError.message }, { status: 500 });
  }

  return NextResponse.json({ data: deal, source: "supabase" }, { status: 201 });
}
