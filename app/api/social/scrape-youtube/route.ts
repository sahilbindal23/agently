import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth/session";
import { classifyYouTubeAgainstSelfReport, fetchYouTubeChannelMetrics } from "@/lib/social/youtube-public";
import { createAdminClient } from "@/lib/supabase/admin";

const schema = z.object({
  channel: z.string().trim().min(1).max(300),
  force_refresh: z.boolean().optional().default(false)
});

const CACHE_TTL_HOURS = 24;

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Login required." }, { status: 401 });

  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid request." }, { status: 400 });

  const admin = createAdminClient();
  if (!admin) return NextResponse.json({ error: "Service role not configured." }, { status: 500 });

  // Cache hit on the channel input (handle, ID, URL all map down to the
  // same channel via creator_platforms.handle once we've stored it once).
  if (!parsed.data.force_refresh || user.role !== "admin") {
    const cached = await getCachedScrape(admin, parsed.data.channel);
    if (cached) return NextResponse.json({ data: cached, cached: true });
  }

  const result = await fetchYouTubeChannelMetrics(parsed.data.channel);

  // Resolve which creator we're attaching this to
  const creatorId = await resolveCreatorId(admin, user.id, user.role);

  if (!result.ok) {
    if (creatorId) {
      // Best-effort: store the failure on whatever YT row exists for this creator
      await admin.from("creator_platforms").update({
        last_scrape_attempted_at: result.fetched_at,
        last_scrape_status: result.reason
      }).eq("creator_id", creatorId).eq("platform", "YouTube").then(() => null, () => null);
    }
    return NextResponse.json({ data: result }, { status: 200 });
  }

  let consistencyVerdict: { verdict: string; delta_pct: number } | null = null;
  if (creatorId) {
    const existing = await admin
      .from("creator_platforms")
      .select("followers, metric_source, handle")
      .eq("creator_id", creatorId)
      .eq("platform", "YouTube")
      .maybeSingle();

    consistencyVerdict = classifyYouTubeAgainstSelfReport(result.subscribers ?? 0, existing.data?.followers ?? null);

    const metricSource = consistencyVerdict.verdict === "significant_difference"
      ? "youtube_public_unconfirmed"
      : "youtube_public_api";

    // YouTube avg views = total_views / video_count, capped to a sane value
    const avgViews = result.total_views && result.video_count && result.video_count > 0
      ? Math.round(result.total_views / result.video_count)
      : null;

    const handleForRow = result.handle ?? existing.data?.handle ?? `youtube:${result.channel_id}`;

    const payload = {
      creator_id: creatorId,
      platform: "YouTube",
      handle: handleForRow,
      url: result.channel_url,
      followers: result.subscribers,
      avg_views: avgViews,
      metric_source: metricSource,
      last_scrape_attempted_at: result.fetched_at,
      last_scrape_status: "success",
      last_scrape_followers: result.subscribers,
      last_scrape_self_report_delta_pct: consistencyVerdict.delta_pct
    };

    if (existing.data) {
      await admin.from("creator_platforms").update(payload).eq("creator_id", creatorId).eq("platform", "YouTube");
    } else {
      await admin.from("creator_platforms").insert(payload);
    }
  }

  return NextResponse.json({ data: result, consistency: consistencyVerdict, cached: false });
}

async function getCachedScrape(admin: NonNullable<ReturnType<typeof createAdminClient>>, channelInput: string) {
  const cutoff = new Date(Date.now() - CACHE_TTL_HOURS * 60 * 60 * 1000).toISOString();
  const cleaned = String(channelInput ?? "").trim().toLowerCase();
  if (!cleaned) return null;
  // Match by URL containment, handle, or stored channel id - the input format
  // the user passes can vary, so we look at any successful YT scrape recently
  // that mentions any form of this identifier on the row.
  const { data } = await admin
    .from("creator_platforms")
    .select("followers, last_scrape_attempted_at, last_scrape_status, last_scrape_followers, url, handle")
    .eq("platform", "YouTube")
    .eq("last_scrape_status", "success")
    .gte("last_scrape_attempted_at", cutoff)
    .or(`handle.ilike.%${cleaned}%,url.ilike.%${cleaned}%`)
    .limit(1)
    .maybeSingle();
  if (!data || !data.last_scrape_attempted_at) return null;
  return {
    ok: true as const,
    channel_id: "",
    handle: data.handle ? String(data.handle) : null,
    display_name: data.handle ? String(data.handle) : "YouTube channel",
    subscribers: Number(data.last_scrape_followers ?? data.followers ?? 0) || null,
    total_views: null,
    video_count: null,
    country: null,
    thumbnail_url: null,
    channel_url: data.url ? String(data.url) : "",
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
