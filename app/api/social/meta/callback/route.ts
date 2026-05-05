import { NextResponse } from "next/server";
import { trackEvent, userEventBase } from "@/lib/analytics/track";
import { getProviderRedirectUri, profileRedirect, verifySocialOAuthState } from "@/lib/social/oauth";
import { sealToken } from "@/lib/social/token-seal";
import { createAdminClient } from "@/lib/supabase/admin";

type MetaTokenResponse = {
  access_token?: string;
  expires_in?: number;
};

type MetaPage = {
  id: string;
  name?: string;
  access_token?: string;
  instagram_business_account?: { id: string; username?: string };
};

type MetaPagesResponse = {
  data?: MetaPage[];
};

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const rawState = url.searchParams.get("state") ?? "";
  const decodedProvider = getProviderFromState(rawState);
  if (decodedProvider !== "instagram" && decodedProvider !== "facebook") {
    return NextResponse.redirect(profileRedirect("/profile", { social: "meta_oauth_failed" }));
  }
  const metaProvider: "instagram" | "facebook" = decodedProvider;

  const state = await verifySocialOAuthState(rawState, metaProvider);
  if (!code || !state) return NextResponse.redirect(profileRedirect("/profile", { social: "meta_oauth_failed" }));

  const admin = createAdminClient();
  if (!admin) return NextResponse.redirect(profileRedirect(state.returnTo, { social: "supabase_not_configured" }));

  const { data: creator } = await admin.from("creators").select("*").eq("profile_id", state.profileId).maybeSingle();
  if (!creator) return NextResponse.redirect(profileRedirect(state.returnTo, { social: "creator_profile_required" }));

  const token = await exchangeMetaCode(code);
  if (!token.access_token) return NextResponse.redirect(profileRedirect(state.returnTo, { social: "meta_token_failed" }));

  const pages = await fetchMetaPages(token.access_token);
  const selected = selectMetaPage(pages, metaProvider);
  if (!selected) {
    return NextResponse.redirect(profileRedirect(state.returnTo, { social: `${state.provider}_page_required` }));
  }

  const accountToken = selected.access_token ?? token.access_token;
  const accountId = state.provider === "instagram"
    ? selected.instagram_business_account?.id ?? selected.id
    : selected.id;
  const handle = state.provider === "instagram"
    ? selected.instagram_business_account?.username ?? selected.name ?? "Instagram account"
    : selected.name ?? "Facebook page";
  const expiresAt = token.expires_in ? new Date(Date.now() + token.expires_in * 1000).toISOString() : null;

  const { data: account, error } = await admin
    .from("connected_social_accounts")
    .upsert({
      profile_id: state.profileId,
      creator_id: creator.id,
      provider: state.provider,
      handle,
      account_url: state.provider === "instagram" ? `https://www.instagram.com/${handle}` : `https://www.facebook.com/${accountId}`,
      platform_account_id: accountId,
      status: "oauth_connected",
      scopes: ["pages_show_list", "pages_read_engagement", "read_insights", "instagram_basic", "instagram_manage_insights"],
      access_token_encrypted: sealToken(accountToken),
      refresh_token_encrypted: null,
      token_expires_at: expiresAt
    }, { onConflict: "creator_id,provider,handle" })
    .select("*")
    .single();

  if (error || !account) return NextResponse.redirect(profileRedirect(state.returnTo, { social: "meta_save_failed" }));

  await trackEvent(admin, {
    ...userEventBase({ id: state.profileId } as Parameters<typeof userEventBase>[0], "creator"),
    eventName: "social_oauth_connected",
    entityType: "connected_social_account",
    entityId: account.id,
    metadata: { provider: state.provider, creator_id: creator.id, platform_account_id: accountId }
  });

  return NextResponse.redirect(profileRedirect(state.returnTo, { social: `${state.provider}_connected` }));
}

function getProviderFromState(encoded: string) {
  try {
    const parsed = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")) as { provider?: string };
    return parsed.provider;
  } catch {
    return null;
  }
}

async function exchangeMetaCode(code: string): Promise<MetaTokenResponse> {
  const version = process.env.META_GRAPH_VERSION ?? "v20.0";
  const response = await fetch(`https://graph.facebook.com/${version}/oauth/access_token?${new URLSearchParams({
    client_id: process.env.META_APP_ID ?? "",
    client_secret: process.env.META_APP_SECRET ?? "",
    redirect_uri: getProviderRedirectUri("instagram"),
    code
  }).toString()}`);
  if (!response.ok) return {};
  return response.json();
}

async function fetchMetaPages(accessToken: string) {
  const version = process.env.META_GRAPH_VERSION ?? "v20.0";
  const fields = "id,name,access_token,instagram_business_account{id,username}";
  const response = await fetch(`https://graph.facebook.com/${version}/me/accounts?fields=${encodeURIComponent(fields)}`, {
    headers: { Authorization: `Bearer ${accessToken}` }
  });
  if (!response.ok) return [];
  const body = await response.json() as MetaPagesResponse;
  return body.data ?? [];
}

function selectMetaPage(pages: MetaPage[], provider: "instagram" | "facebook") {
  if (provider === "instagram") return pages.find((page) => page.instagram_business_account?.id);
  return pages[0] ?? null;
}
