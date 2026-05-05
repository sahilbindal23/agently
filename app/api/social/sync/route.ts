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
  const response = await fetch("https://www.googleapis.com/youtube/v3/channels?part=statistics&mine=true", {
    headers: { Authorization: `Bearer ${accessToken}` }
  });
  if (!response.ok) return null;
  const body = await response.json() as { items?: Array<{ statistics?: { subscriberCount?: string; viewCount?: string; videoCount?: string } }> };
  const stats = body.items?.[0]?.statistics;
  if (!stats) return null;
  const videoCount = Math.max(1, Number(stats.videoCount ?? 1));
  const avgViews = Math.round(Number(stats.viewCount ?? 0) / videoCount);
  return {
    followers: Number(stats.subscriberCount ?? 0),
    avg_views_30d: avgViews,
    reach_30d: avgViews,
    impressions_30d: avgViews,
    engagement_rate_30d: 0,
    india_audience_percent: 0,
    bangalore_audience_percent: 0,
    top_cities: [],
    audience_age_range: null,
    content_category_signals: ["youtube"],
    raw_metrics: { provider: "youtube", statistics: stats },
    source: "youtube_api"
  };
}

async function fetchInstagramSnapshot(accessToken: string, accountId: string) {
  if (!accountId) return null;
  const version = process.env.META_GRAPH_VERSION ?? "v20.0";
  const response = await fetch(`https://graph.facebook.com/${version}/${accountId}?fields=followers_count,media_count,username&access_token=${encodeURIComponent(accessToken)}`);
  if (!response.ok) return null;
  const body = await response.json() as { followers_count?: number; media_count?: number; username?: string };
  return {
    followers: Number(body.followers_count ?? 0),
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
    source: "instagram_graph_api"
  };
}

async function fetchFacebookSnapshot(accessToken: string, pageId: string) {
  if (!pageId) return null;
  const version = process.env.META_GRAPH_VERSION ?? "v20.0";
  const response = await fetch(`https://graph.facebook.com/${version}/${pageId}?fields=followers_count,fan_count,name&access_token=${encodeURIComponent(accessToken)}`);
  if (!response.ok) return null;
  const body = await response.json() as { followers_count?: number; fan_count?: number; name?: string };
  return {
    followers: Number(body.followers_count ?? body.fan_count ?? 0),
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
    source: "facebook_graph_api"
  };
}
