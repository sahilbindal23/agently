import { NextResponse } from "next/server";
import { getAgentlyData } from "@/lib/db/live-data";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET() {
  const { creators, source } = await getAgentlyData();
  return NextResponse.json({ data: creators, source });
}

export async function POST(request: Request) {
  const body = await request.json();
  const creatorPayload = {
    display_name: String(body.display_name ?? "").trim(),
    primary_niche: String(body.primary_niche ?? "").trim(),
    bio: String(body.bio ?? "").trim(),
    country: String(body.country ?? "").trim(),
    us_audience_percent: 0,
    india_audience_percent: Number(body.india_audience_percent ?? 0),
    home_city: String(body.home_city ?? "").trim(),
    languages: splitList(body.languages),
    top_indian_cities: splitList(body.top_indian_cities),
    audience_age_range: String(body.audience_age_range ?? "").trim(),
    content_style: String(body.content_style ?? "").trim(),
    prior_sponsor_categories: splitList(body.prior_sponsor_categories),
    monetization_score: Number(body.monetization_score ?? 50),
    valuation_score: Number(body.valuation_score ?? 50)
  };

  if (!creatorPayload.display_name) {
    return NextResponse.json({ error: "Creator display name is required." }, { status: 400 });
  }

  const supabase = createAdminClient();
  if (!supabase) {
    return NextResponse.json({ data: { id: crypto.randomUUID(), ...creatorPayload }, source: "demo_create" }, { status: 201 });
  }

  let creatorResult = await supabase
    .from("creators")
    .insert(creatorPayload)
    .select("*")
    .single();

  if (creatorResult.error?.message.toLowerCase().includes("column")) {
    const legacyPayload = {
      display_name: creatorPayload.display_name,
      primary_niche: creatorPayload.primary_niche,
      bio: creatorPayload.bio,
      country: creatorPayload.country,
      us_audience_percent: 0,
      monetization_score: creatorPayload.monetization_score,
      valuation_score: creatorPayload.valuation_score
    };

    creatorResult = await supabase
      .from("creators")
      .insert(legacyPayload)
      .select("*")
      .single();
  }

  if (creatorResult.error) {
    return NextResponse.json({ error: creatorResult.error.message }, { status: 500 });
  }

  const creator = creatorResult.data;

  const platform = String(body.platform ?? "").trim();
  if (platform) {
    await supabase.from("creator_platforms").insert({
      creator_id: creator.id,
      platform,
      handle: String(body.handle ?? "").trim(),
      url: String(body.url ?? "").trim(),
      followers: Number(body.followers ?? 0),
      avg_views: Number(body.avg_views ?? 0),
      engagement_rate: Number(body.engagement_rate ?? 0),
      posting_frequency: String(body.posting_frequency ?? "").trim()
    });
  }

  return NextResponse.json({ data: creator, source: "supabase" }, { status: 201 });
}

function splitList(value: unknown) {
  return String(value ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}
