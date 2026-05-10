import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth/session";
import { classifyFacebookAgainstSelfReport, fetchFacebookPublicMetrics, normalizeFacebookHandle } from "@/lib/social/facebook-public-scraper";
import { createAdminClient } from "@/lib/supabase/admin";

const schema = z.object({
  handle: z.string().trim().min(1).max(200),
  force_refresh: z.boolean().optional().default(false)
});

const CACHE_TTL_HOURS = 24;

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Login required." }, { status: 401 });

  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid request." }, { status: 400 });

  const handle = normalizeFacebookHandle(parsed.data.handle);
  if (!handle) return NextResponse.json({ error: "Invalid Facebook page handle." }, { status: 400 });

  const admin = createAdminClient();
  if (!admin) return NextResponse.json({ error: "Service role not configured." }, { status: 500 });

  if (!parsed.data.force_refresh || user.role !== "admin") {
    const cached = await getCachedScrape(admin, handle);
    if (cached) return NextResponse.json({ data: cached, cached: true });
  }

  const result = await fetchFacebookPublicMetrics(handle);
  const creatorId = await resolveCreatorId(admin, user.id, user.role);

  if (!result.ok) {
    if (creatorId) {
      await admin.from("creator_platforms").update({
        last_scrape_attempted_at: result.fetched_at,
        last_scrape_status: result.reason
      }).eq("creator_id", creatorId).eq("platform", "Facebook").eq("handle", handle).then(() => null, () => null);
    }
    return NextResponse.json({ data: result }, { status: 200 });
  }

  let consistencyVerdict: { verdict: string; delta_pct: number } | null = null;
  if (creatorId) {
    const { data: existing } = await admin
      .from("creator_platforms")
      .select("followers, metric_source")
      .eq("creator_id", creatorId)
      .eq("platform", "Facebook")
      .eq("handle", handle)
      .maybeSingle();

    const trackedFollowers = result.followers ?? result.likes ?? 0;
    consistencyVerdict = classifyFacebookAgainstSelfReport(trackedFollowers, existing?.followers ?? null);
    const metricSource = consistencyVerdict.verdict === "significant_difference"
      ? "facebook_public_unconfirmed"
      : "facebook_public_scrape";

    const payload = {
      creator_id: creatorId,
      platform: "Facebook",
      handle,
      url: result.page_url,
      followers: trackedFollowers,
      metric_source: metricSource,
      last_scrape_attempted_at: result.fetched_at,
      last_scrape_status: "success",
      last_scrape_followers: trackedFollowers,
      last_scrape_self_report_delta_pct: consistencyVerdict.delta_pct
    };

    if (existing) {
      await admin.from("creator_platforms").update(payload).eq("creator_id", creatorId).eq("platform", "Facebook").eq("handle", handle);
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
    .eq("platform", "Facebook")
    .eq("handle", handle)
    .eq("last_scrape_status", "success")
    .gte("last_scrape_attempted_at", cutoff)
    .maybeSingle();
  if (!data || !data.last_scrape_attempted_at) return null;
  return {
    ok: true as const,
    handle,
    display_name: null,
    followers: Number(data.last_scrape_followers ?? data.followers ?? 0) || null,
    likes: null,
    page_url: data.url ? String(data.url) : `https://www.facebook.com/${handle}`,
    fetched_at: String(data.last_scrape_attempted_at),
    raw_description: ""
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
