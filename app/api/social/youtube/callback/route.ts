import { NextResponse } from "next/server";
import { trackEvent, userEventBase } from "@/lib/analytics/track";
import { getProviderRedirectUri, profileRedirect, verifySocialOAuthState } from "@/lib/social/oauth";
import { sealToken } from "@/lib/social/token-seal";
import { createAdminClient } from "@/lib/supabase/admin";

type GoogleTokenResponse = {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  scope?: string;
};

type YouTubeChannelResponse = {
  items?: Array<{
    id?: string;
    snippet?: { title?: string; customUrl?: string };
    statistics?: { subscriberCount?: string; viewCount?: string; videoCount?: string };
  }>;
};

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = await verifySocialOAuthState(url.searchParams.get("state") ?? "", "youtube");
  if (!code || !state) return NextResponse.redirect(profileRedirect("/profile", { social: "youtube_oauth_failed" }));

  const admin = createAdminClient();
  if (!admin) return NextResponse.redirect(profileRedirect(state.returnTo, { social: "supabase_not_configured" }));

  const { data: creator } = await admin.from("creators").select("*").eq("profile_id", state.profileId).maybeSingle();
  if (!creator) return NextResponse.redirect(profileRedirect(state.returnTo, { social: "creator_profile_required" }));

  const token = await exchangeGoogleCode(code);
  if (!token.access_token) return NextResponse.redirect(profileRedirect(state.returnTo, { social: "youtube_token_failed" }));

  const channel = await fetchYouTubeChannel(token.access_token);
  const channelId = channel?.id ?? `youtube:${state.profileId}`;
  const handle = channel?.snippet?.customUrl || channel?.snippet?.title || "YouTube channel";
  const expiresAt = token.expires_in ? new Date(Date.now() + token.expires_in * 1000).toISOString() : null;

  const { data: account, error } = await admin
    .from("connected_social_accounts")
    .upsert({
      profile_id: state.profileId,
      creator_id: creator.id,
      provider: "youtube",
      handle,
      account_url: `https://www.youtube.com/channel/${channelId}`,
      platform_account_id: channelId,
      status: "oauth_connected",
      scopes: String(token.scope ?? "").split(" ").filter(Boolean),
      access_token_encrypted: sealToken(token.access_token),
      refresh_token_encrypted: sealToken(token.refresh_token),
      token_expires_at: expiresAt
    }, { onConflict: "creator_id,provider,handle" })
    .select("*")
    .single();

  if (error || !account) return NextResponse.redirect(profileRedirect(state.returnTo, { social: "youtube_save_failed" }));

  await upsertCreatorPlatform(admin, String(creator.id), handle, String(account.account_url ?? ""), channel);
  await trackEvent(admin, {
    ...userEventBase({ id: state.profileId } as Parameters<typeof userEventBase>[0], "creator"),
    eventName: "social_oauth_connected",
    entityType: "connected_social_account",
    entityId: account.id,
    metadata: { provider: "youtube", creator_id: creator.id, platform_account_id: channelId }
  });

  return NextResponse.redirect(profileRedirect(state.returnTo, { social: "youtube_connected" }));
}

async function exchangeGoogleCode(code: string): Promise<GoogleTokenResponse> {
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID ?? "",
      client_secret: process.env.GOOGLE_CLIENT_SECRET ?? "",
      redirect_uri: getProviderRedirectUri("youtube"),
      grant_type: "authorization_code"
    })
  });
  if (!response.ok) return {};
  return response.json();
}

async function fetchYouTubeChannel(accessToken: string) {
  const response = await fetch("https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics&mine=true", {
    headers: { Authorization: `Bearer ${accessToken}` }
  });
  if (!response.ok) return null;
  const body = await response.json() as YouTubeChannelResponse;
  return body.items?.[0] ?? null;
}

async function upsertCreatorPlatform(
  admin: NonNullable<ReturnType<typeof createAdminClient>>,
  creatorId: string,
  handle: string,
  url: string,
  channel: Awaited<ReturnType<typeof fetchYouTubeChannel>>
) {
  const followers = Number(channel?.statistics?.subscriberCount ?? 0);
  const videoCount = Math.max(1, Number(channel?.statistics?.videoCount ?? 1));
  const avgViews = Math.round(Number(channel?.statistics?.viewCount ?? 0) / videoCount);
  const payload = {
    creator_id: creatorId,
    platform: "YouTube",
    handle,
    url,
    followers,
    avg_views: avgViews
  };
  const { data: existing } = await admin
    .from("creator_platforms")
    .select("id")
    .eq("creator_id", creatorId)
    .eq("platform", "YouTube")
    .eq("handle", handle)
    .maybeSingle();

  if (existing?.id) await admin.from("creator_platforms").update(payload).eq("id", existing.id);
  else await admin.from("creator_platforms").insert(payload);
}
