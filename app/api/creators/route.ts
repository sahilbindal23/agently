import { NextResponse } from "next/server";
import { z } from "zod";
import { getAgentlyData } from "@/lib/db/live-data";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const creatorSchema = z.object({
  display_name: z.string().trim().min(1).max(120),
  primary_niche: z.string().trim().max(100).optional().or(z.literal("")),
  bio: z.string().trim().max(2000).optional().or(z.literal("")),
  country: z.string().trim().max(80).optional().or(z.literal("")),
  india_audience_percent: z.coerce.number().min(0).max(100).optional(),
  home_city: z.string().trim().max(100).optional().or(z.literal("")),
  languages: z.string().trim().max(400).optional().or(z.literal("")),
  top_indian_cities: z.string().trim().max(400).optional().or(z.literal("")),
  audience_age_range: z.string().trim().max(80).optional().or(z.literal("")),
  content_style: z.string().trim().max(400).optional().or(z.literal("")),
  prior_sponsor_categories: z.string().trim().max(400).optional().or(z.literal("")),
  platform: z.string().trim().max(80).optional().or(z.literal("")),
  handle: z.string().trim().max(120).optional().or(z.literal("")),
  url: z.string().trim().max(300).optional().or(z.literal("")),
  followers: z.coerce.number().int().min(0).max(1_000_000_000).optional(),
  avg_views: z.coerce.number().int().min(0).max(1_000_000_000).optional(),
  engagement_rate: z.coerce.number().min(0).max(100).optional(),
  posting_frequency: z.string().trim().max(120).optional().or(z.literal(""))
});

export async function GET() {
  const auth = await createClient();
  const { data: authData } = await auth.auth.getUser();
  if (!authData.user) return NextResponse.json({ error: "Login required." }, { status: 401 });

  const admin = createAdminClient();
  const { data: profile } = admin
    ? await admin.from("profiles").select("role").eq("id", authData.user.id).maybeSingle()
    : { data: null };
  const { creators, source } = await getAgentlyData({ includeDemo: profile?.role === "admin" });
  return NextResponse.json({ data: creators, source });
}

export async function POST(request: Request) {
  const auth = await createClient();
  const { data: authData } = await auth.auth.getUser();
  if (!authData.user) return NextResponse.json({ error: "Login required." }, { status: 401 });

  const supabase = createAdminClient();
  if (!supabase) return NextResponse.json({ error: "Supabase service role key is not configured." }, { status: 500 });

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", authData.user.id).maybeSingle();
  if (profile?.role !== "admin") {
    return NextResponse.json({ error: "Only admins can create creator records directly." }, { status: 403 });
  }

  const parsed = creatorSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid creator payload." }, { status: 400 });
  }
  const body = parsed.data;

  const creatorPayload = {
    display_name: body.display_name,
    primary_niche: body.primary_niche ?? "",
    bio: body.bio ?? "",
    country: body.country || "IN",
    us_audience_percent: 0,
    india_audience_percent: body.india_audience_percent ?? 0,
    home_city: body.home_city ?? "",
    languages: splitList(body.languages),
    top_indian_cities: splitList(body.top_indian_cities),
    audience_age_range: body.audience_age_range ?? "",
    content_style: body.content_style ?? "",
    prior_sponsor_categories: splitList(body.prior_sponsor_categories),
    monetization_score: 50,
    valuation_score: 50
  };

  let creatorResult = await supabase
    .from("creators")
    .insert(creatorPayload)
    .select("*")
    .single();

  if (creatorResult.error?.message.toLowerCase().includes("column")) {
    creatorResult = await supabase
      .from("creators")
      .insert({
        display_name: creatorPayload.display_name,
        primary_niche: creatorPayload.primary_niche,
        bio: creatorPayload.bio,
        country: creatorPayload.country,
        us_audience_percent: 0,
        monetization_score: 50,
        valuation_score: 50
      })
      .select("*")
      .single();
  }

  if (creatorResult.error || !creatorResult.data) {
    return NextResponse.json({ error: creatorResult.error?.message ?? "Could not create creator." }, { status: 500 });
  }

  const creator = creatorResult.data;
  if (body.platform) {
    await supabase.from("creator_platforms").insert({
      creator_id: creator.id,
      platform: body.platform,
      handle: body.handle ?? "",
      url: body.url ?? "",
      followers: body.followers ?? 0,
      avg_views: body.avg_views ?? 0,
      engagement_rate: body.engagement_rate ?? 0,
      posting_frequency: body.posting_frequency ?? ""
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
