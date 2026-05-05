import { NextResponse } from "next/server";
import { buildMockSocialSnapshot } from "@/lib/social/mock-sync";
import { refreshCreatorScoresFromSnapshots } from "@/lib/social/sync-engine";
import { unsealToken } from "@/lib/social/token-seal";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const body = await request.json();
  const accountId = String(body.account_id ?? "").trim();
  if (!accountId) return NextResponse.json({ error: "Connected account is required." }, { status: 400 });

  const auth = await createClient();
  const { data: authData } = await auth.auth.getUser();
  if (!authData.user) return NextResponse.json({ error: "Login required." }, { status: 401 });

  const admin = createAdminClient();
  if (!admin) return NextResponse.json({ error: "Supabase service role key is not configured." }, { status: 500 });

  const { data: account } = await admin.from("connected_social_accounts").select("*").eq("id", accountId).single();
  if (!account) return NextResponse.json({ error: "Connected account not found." }, { status: 404 });
  if (account.profile_id !== authData.user.id) {
    const { data: profile } = await admin.from("profiles").select("role").eq("id", authData.user.id).single();
    if (profile?.role !== "admin") return NextResponse.json({ error: "Not allowed to sync this account." }, { status: 403 });
  }

  const [{ data: creator }, { data: platforms }] = await Promise.all([
    admin.from("creators").select("*").eq("id", account.creator_id).single(),
    admin.from("creator_platforms").select("*").eq("creator_id", account.creator_id)
  ]);
  if (!creator) return NextResponse.json({ error: "Creator not found." }, { status: 404 });

  const matchingPlatform = (platforms ?? []).find((platform) => providerMatchesPlatform(String(account.provider), String(platform.platform)));
  const oauthSnapshot = await buildOAuthSnapshot(account);
  const snapshot = oauthSnapshot ?? buildMockSocialSnapshot({
    provider: account.provider,
    handle: String(account.handle ?? ""),
    creator,
    platform: matchingPlatform
  });

  const { data: inserted, error } = await admin
    .from("social_metric_snapshots")
    .insert({
      connected_account_id: account.id,
      creator_id: account.creator_id,
      provider: account.provider,
      ...snapshot
    })
    .select("*")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const latestSignals = await refreshCreatorScoresFromSnapshots(admin, String(account.creator_id));
  await Promise.all([
    admin.from("connected_social_accounts").update({ last_synced_at: new Date().toISOString(), status: "synced" }).eq("id", account.id),
    Promise.resolve()
  ]);

  return NextResponse.json({ data: inserted, summary: latestSignals });
}

function providerMatchesPlatform(provider: string, platform: string) {
  return platform.toLowerCase().includes(provider === "youtube" ? "youtube" : provider);
}

async function buildOAuthSnapshot(account: Record<string, unknown>) {
  const accessToken = unsealToken(String(account.access_token_encrypted ?? ""));
  if (!accessToken || !String(account.status ?? "").startsWith("oauth")) return null;
  if (account.provider === "youtube") return fetchYouTubeSnapshot(accessToken);
  if (account.provider === "instagram") return fetchInstagramSnapshot(accessToken, String(account.platform_account_id ?? ""));
  if (account.provider === "facebook") return fetchFacebookSnapshot(accessToken, String(account.platform_account_id ?? ""));
  return null;
}

async function fetchYouTubeSnapshot(accessToken: string) {
  const [channelStats, totals, countries, videos] = await Promise.all([
    fetchYouTubeChannelStats(accessToken),
    fetchYouTubeAnalytics(accessToken, {
      metrics: "views,estimatedMinutesWatched,likes,comments,shares,subscribersGained"
    }),
    fetchYouTubeAnalytics(accessToken, {
      dimensions: "country",
      metrics: "views",
      sort: "-views",
      maxResults: "25"
    }),
    fetchYouTubeAnalytics(accessToken, {
      dimensions: "video",
      metrics: "views,likes,comments,shares",
      sort: "-views",
      maxResults: "25"
    })
  ]);
  const permissionRequired = [totals, countries, videos].some((report) => report?.source_error === "permission_required");

  const totalRow = totals?.rows?.[0] ?? [];
  const totalViews = Number(totalRow[0] ?? 0);
  const totalLikes = Number(totalRow[2] ?? 0);
  const totalComments = Number(totalRow[3] ?? 0);
  const totalShares = Number(totalRow[4] ?? 0);
  const videoViews = (videos?.rows ?? []).map((row) => Number(row[1] ?? 0)).filter((value) => value > 0);
  const avgViews = videoViews.length
    ? Math.round(videoViews.reduce((sum, value) => sum + value, 0) / videoViews.length)
    : totalViews || channelStats.avgViews;
  const countryRows = countries?.rows ?? [];
  const indiaViews = countryRows
    .filter((row) => String(row[0] ?? "").toUpperCase() === "IN")
    .reduce((sum, row) => sum + Number(row[1] ?? 0), 0);
  const indiaAudience = totalViews > 0 ? Math.round((indiaViews / totalViews) * 100) : 0;
  const engagementRate = totalViews > 0 ? Number((((totalLikes + totalComments + totalShares) / totalViews) * 100).toFixed(2)) : 0;
  const emptyChannel = channelStats.followers === 0 && channelStats.avgViews === 0;

  if (permissionRequired) {
    return {
      followers: channelStats.followers,
      avg_views_30d: channelStats.avgViews,
      reach_30d: channelStats.avgViews,
      impressions_30d: channelStats.avgViews,
      engagement_rate_30d: 0,
      india_audience_percent: 0,
      bangalore_audience_percent: 0,
      top_cities: [],
      audience_age_range: null,
      content_category_signals: ["youtube"],
      raw_metrics: {
        provider: "youtube",
        statistics: channelStats.raw,
        note: "YouTube Analytics permissions are missing or expired. Reconnect the account."
      },
      source: "youtube_permission_required"
    };
  }

  if (!totals && !countries && !videos) {
    return {
      followers: channelStats.followers,
      avg_views_30d: channelStats.avgViews,
      reach_30d: channelStats.avgViews,
      impressions_30d: channelStats.avgViews,
      engagement_rate_30d: 0,
      india_audience_percent: 0,
      bangalore_audience_percent: 0,
      top_cities: [],
      audience_age_range: null,
      content_category_signals: ["youtube"],
      raw_metrics: {
        provider: "youtube",
        statistics: channelStats.raw,
        note: emptyChannel
          ? "OAuth worked, but this YouTube account has no creator performance data yet."
          : "YouTube Analytics data was not available, so Agently used basic channel statistics."
      },
      source: emptyChannel ? "youtube_no_creator_data" : "youtube_api"
    };
  }

  return {
    followers: channelStats.followers,
    avg_views_30d: avgViews,
    reach_30d: totalViews,
    impressions_30d: totalViews,
    engagement_rate_30d: engagementRate,
    india_audience_percent: indiaAudience,
    bangalore_audience_percent: 0,
    top_cities: indiaAudience > 0 ? ["India"] : [],
    audience_age_range: null,
    content_category_signals: ["youtube", "analytics verified"],
    raw_metrics: {
      provider: "youtube",
      channel_statistics: channelStats.raw,
      analytics_totals: totals,
      analytics_countries: countries,
      analytics_videos: videos
    },
    source: emptyChannel && totalViews === 0 ? "youtube_no_creator_data" : "youtube_analytics_api"
  };
}

async function fetchYouTubeChannelStats(accessToken: string) {
  const response = await fetch("https://www.googleapis.com/youtube/v3/channels?part=statistics&mine=true", {
    headers: { Authorization: `Bearer ${accessToken}` }
  });
  if (!response.ok) return { followers: 0, avgViews: 0, raw: null };
  const body = await response.json() as { items?: Array<{ statistics?: { subscriberCount?: string; viewCount?: string; videoCount?: string } }> };
  const stats = body.items?.[0]?.statistics;
  if (!stats) return { followers: 0, avgViews: 0, raw: null };
  const videoCount = Math.max(1, Number(stats.videoCount ?? 1));
  return {
    followers: Number(stats.subscriberCount ?? 0),
    avgViews: Math.round(Number(stats.viewCount ?? 0) / videoCount),
    raw: stats
  };
}

async function fetchYouTubeAnalytics(
  accessToken: string,
  options: {
    dimensions?: string;
    metrics: string;
    sort?: string;
    maxResults?: string;
  }
) {
  const { startDate, endDate } = lastNDays(30);
  const params = new URLSearchParams({
    ids: "channel==MINE",
    startDate,
    endDate,
    metrics: options.metrics
  });
  if (options.dimensions) params.set("dimensions", options.dimensions);
  if (options.sort) params.set("sort", options.sort);
  if (options.maxResults) params.set("maxResults", options.maxResults);

  const response = await fetch(`https://youtubeanalytics.googleapis.com/v2/reports?${params.toString()}`, {
    headers: { Authorization: `Bearer ${accessToken}` }
  });
  if (response.status === 401 || response.status === 403) {
    return {
      columnHeaders: [],
      rows: [],
      source_error: "permission_required"
    };
  }
  if (!response.ok) return null;
  return response.json() as Promise<{
    columnHeaders?: Array<{ name: string; columnType: string; dataType: string }>;
    rows?: Array<Array<string | number>>;
    source_error?: string;
  }>;
}

function lastNDays(days: number) {
  const end = new Date();
  end.setDate(end.getDate() - 1);
  const start = new Date(end);
  start.setDate(start.getDate() - days + 1);
  return {
    startDate: start.toISOString().slice(0, 10),
    endDate: end.toISOString().slice(0, 10)
  };
}

async function fetchInstagramSnapshot(accessToken: string, accountId: string) {
  if (!accountId) return metaSetupRequiredSnapshot("instagram", "No Instagram professional account was available from the connected Meta account.");
  const version = process.env.META_GRAPH_VERSION ?? "v20.0";
  const response = await fetch(`https://graph.facebook.com/${version}/${accountId}?fields=followers_count,media_count,username&access_token=${encodeURIComponent(accessToken)}`);
  if (response.status === 401 || response.status === 403) return metaPermissionSnapshot("instagram");
  if (!response.ok) return metaSetupRequiredSnapshot("instagram", "Instagram metrics could not be pulled from this account.");
  const body = await response.json() as { followers_count?: number; media_count?: number; username?: string };
  const followers = Number(body.followers_count ?? 0);
  return {
    followers,
    avg_views_30d: 0,
    reach_30d: 0,
    impressions_30d: 0,
    engagement_rate_30d: 0,
    india_audience_percent: 0,
    bangalore_audience_percent: 0,
    top_cities: [],
    audience_age_range: null,
    content_category_signals: ["instagram"],
    raw_metrics: body,
    source: followers > 0 ? "instagram_graph_api" : "instagram_setup_required"
  };
}

async function fetchFacebookSnapshot(accessToken: string, pageId: string) {
  if (!pageId) return metaSetupRequiredSnapshot("facebook", "No Facebook Page was available from the connected Meta account.");
  const version = process.env.META_GRAPH_VERSION ?? "v20.0";
  const response = await fetch(`https://graph.facebook.com/${version}/${pageId}?fields=followers_count,fan_count,name&access_token=${encodeURIComponent(accessToken)}`);
  if (response.status === 401 || response.status === 403) return metaPermissionSnapshot("facebook");
  if (!response.ok) return metaSetupRequiredSnapshot("facebook", "Facebook Page metrics could not be pulled from this account.");
  const body = await response.json() as { followers_count?: number; fan_count?: number; name?: string };
  const followers = Number(body.followers_count ?? body.fan_count ?? 0);
  return {
    followers,
    avg_views_30d: 0,
    reach_30d: 0,
    impressions_30d: 0,
    engagement_rate_30d: 0,
    india_audience_percent: 0,
    bangalore_audience_percent: 0,
    top_cities: [],
    audience_age_range: null,
    content_category_signals: ["facebook"],
    raw_metrics: body,
    source: followers > 0 ? "facebook_graph_api" : "facebook_setup_required"
  };
}

function metaPermissionSnapshot(provider: "instagram" | "facebook") {
  return {
    followers: 0,
    avg_views_30d: 0,
    reach_30d: 0,
    impressions_30d: 0,
    engagement_rate_30d: 0,
    india_audience_percent: 0,
    bangalore_audience_percent: 0,
    top_cities: [],
    audience_age_range: null,
    content_category_signals: [provider],
    raw_metrics: { provider, note: "Permissions are missing or expired. Reconnect the account." },
    source: `${provider}_permission_required`
  };
}

function metaSetupRequiredSnapshot(provider: "instagram" | "facebook", note: string) {
  return {
    followers: 0,
    avg_views_30d: 0,
    reach_30d: 0,
    impressions_30d: 0,
    engagement_rate_30d: 0,
    india_audience_percent: 0,
    bangalore_audience_percent: 0,
    top_cities: [],
    audience_age_range: null,
    content_category_signals: [provider],
    raw_metrics: { provider, note },
    source: `${provider}_setup_required`
  };
}
