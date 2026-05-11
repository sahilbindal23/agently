import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth/session";
import { gateRateLimit } from "@/lib/security/rate-limit-gate";
import { classifyTwitterAgainstSelfReport, fetchTwitterPublicMetrics, normalizeTwitterHandle } from "@/lib/social/twitter-public";
import { createAdminClient } from "@/lib/supabase/admin";

const schema = z.object({
  handle: z.string().trim().min(1).max(200),
  force_refresh: z.boolean().optional().default(false)
});

const CACHE_TTL_HOURS = 24;

export async function POST(request: Request) {
  const gate = await gateRateLimit(request, "social:scrape");
  if (gate) return gate;

  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Login required." }, { status: 401 });

  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid request." }, { status: 400 });

  const handle = normalizeTwitterHandle(parsed.data.handle);
  if (!handle) return NextResponse.json({ error: "Invalid Twitter handle." }, { status: 400 });

  const admin = createAdminClient();
  if (!admin) return NextResponse.json({ error: "Service role not configured." }, { status: 500 });

  if (!parsed.data.force_refresh || user.role !== "admin") {
    const cached = await getCachedScrape(admin, handle);
    if (cached) return NextResponse.json({ data: cached, cached: true });
  }

  const result = await fetchTwitterPublicMetrics(handle);
  const creatorId = await resolveCreatorId(admin, user.id, user.role);

  if (!result.ok) {
    if (creatorId) {
      await admin.from("creator_platforms").update({
        last_scrape_attempted_at: result.fetched_at,
        last_scrape_status: result.reason
      }).eq("creator_id", creatorId).eq("platform", "Twitter").eq("handle", handle).then(() => null, () => null);
    }
    return NextResponse.json({ data: result }, { status: 200 });
  }

  let consistencyVerdict: { verdict: string; delta_pct: number } | null = null;
  if (creatorId) {
    const { data: existing } = await admin
      .from("creator_platforms")
      .select("followers, metric_source")
      .eq("creator_id", creatorId)
      .eq("platform", "Twitter")
      .eq("handle", handle)
      .maybeSingle();

    consistencyVerdict = classifyTwitterAgainstSelfReport(result.followers ?? 0, existing?.followers ?? null);
    const metricSource = consistencyVerdict.verdict === "significant_difference"
      ? "twitter_public_unconfirmed"
      : "twitter_public_api";

    const payload = {
      creator_id: creatorId,
      platform: "Twitter",
      handle,
      url: result.profile_url,
      followers: result.followers,
      metric_source: metricSource,
      last_scrape_attempted_at: result.fetched_at,
      last_scrape_status: "success",
      last_scrape_followers: result.followers,
      last_scrape_self_report_delta_pct: consistencyVerdict.delta_pct
    };

    if (existing) {
      await admin.from("creator_platforms").update(payload).eq("creator_id", creatorId).eq("platform", "Twitter").eq("handle", handle);
    } else {
      await admin.from("creator_platforms").insert(payload);
    }
  }

  return NextResponse.json({ data: result, consistency: consistencyVerdict, cached: false });
}

async function getCachedScrape(admin: NonNullable<ReturnType<typeof createAdminClient>>, handle: string) {
  const cutoff = new Date(Date.now() - CACHE_TTL_HOURS * 60 * 60 * 1000).toISOString();
  const { data } = await admin
    .from("creator_platforms")
    .select("followers, last_scrape_attempted_at, last_scrape_status, last_scrape_followers, url")
    .eq("platform", "Twitter")
    .eq("handle", handle)
    .eq("last_scrape_status", "success")
    .gte("last_scrape_attempted_at", cutoff)
    .maybeSingle();
  if (!data || !data.last_scrape_attempted_at) return null;
  return {
    ok: true as const,
    user_id: "",
    handle,
    display_name: handle,
    followers: Number(data.last_scrape_followers ?? data.followers ?? 0) || null,
    following: null,
    tweet_count: null,
    is_verified: null,
    description: null,
    profile_url: data.url ? String(data.url) : `https://twitter.com/${handle}`,
    profile_image_url: null,
    fetched_at: String(data.last_scrape_attempted_at)
  };
}

async function resolveCreatorId(
  admin: NonNullable<ReturnType<typeof createAdminClient>>,
  profileId: string,
  role?: string
): Promise<string | null> {
  if (role !== "creator" && role !== "admin") return null;
  const { data } = await admin.from("creators").select("id").eq("profile_id", profileId).maybeSingle();
  return data ? String(data.id) : null;
}
