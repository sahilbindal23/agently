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

type MetaProfileResponse = {
  id?: string;
  name?: string;
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

  // Resolve which entity (creator/brand/freelancer) this connection belongs to.
  const { data: profile } = await admin.from("profiles").select("role, email").eq("id", state.profileId).maybeSingle();
  const role = String(profile?.role ?? "");
  let entityKey: "creator_id" | "brand_id" | "freelancer_id" = "creator_id";
  let entityId = "";
  let onConflict = "creator_id,provider,handle";
  if (role === "brand") {
    const { data: brand } = await admin.from("brands").select("id").eq("contact_email", String(profile?.email ?? "").toLowerCase()).maybeSingle();
    if (!brand) return NextResponse.redirect(profileRedirect(state.returnTo, { social: "brand_profile_required" }));
    entityKey = "brand_id"; entityId = String(brand.id); onConflict = "brand_id,provider,handle";
  } else if (role === "freelancer") {
    const { data: freelancer } = await admin.from("freelancers").select("id").eq("profile_id", state.profileId).maybeSingle();
    if (!freelancer) return NextResponse.redirect(profileRedirect(state.returnTo, { social: "freelancer_profile_required" }));
    entityKey = "freelancer_id"; entityId = String(freelancer.id); onConflict = "freelancer_id,provider,handle";
  } else {
    const { data: creator } = await admin.from("creators").select("id").eq("profile_id", state.profileId).maybeSingle();
    if (!creator) return NextResponse.redirect(profileRedirect(state.returnTo, { social: "creator_profile_required" }));
    entityKey = "creator_id"; entityId = String(creator.id); onConflict = "creator_id,provider,handle";
  }

  const token = await exchangeMetaCode(code, metaProvider);
  if (!token.access_token) return NextResponse.redirect(profileRedirect(state.returnTo, { social: "meta_token_failed" }));

  const pages = await fetchMetaPages(token.access_token);
  const selected = selectMetaPage(pages, metaProvider);
  const limitedProfile = selected ? null : await fetchMetaProfile(token.access_token);

  const accountToken = selected?.access_token ?? token.access_token;
  const accountId = state.provider === "instagram"
    ? selected?.instagram_business_account?.id ?? selected?.id ?? limitedProfile?.id ?? `meta:${state.profileId}`
    : selected?.id ?? limitedProfile?.id ?? `meta:${state.profileId}`;
  const handle = state.provider === "instagram"
    ? selected?.instagram_business_account?.username ?? selected?.name ?? limitedProfile?.name ?? "Meta account"
    : selected?.name ?? limitedProfile?.name ?? "Meta account";
  const expiresAt = token.expires_in ? new Date(Date.now() + token.expires_in * 1000).toISOString() : null;
  const connectionStatus = selected ? "oauth_connected" : "oauth_limited";

  const { data: account, error } = await admin
    .from("connected_social_accounts")
    .upsert({
      profile_id: state.profileId,
      [entityKey]: entityId,
      provider: state.provider,
      handle,
      account_url: selected
        ? state.provider === "instagram" ? `https://www.instagram.com/${handle}` : `https://www.facebook.com/${accountId}`
        : "https://www.facebook.com/me",
      platform_account_id: accountId,
      status: connectionStatus,
      scopes: getMetaOAuthScopes(),
      access_token_encrypted: sealToken(accountToken),
      refresh_token_encrypted: null,
      token_expires_at: expiresAt
    }, { onConflict })
    .select("*")
    .single();

  if (error || !account) return NextResponse.redirect(profileRedirect(state.returnTo, { social: "meta_save_failed" }));

  await trackEvent(admin, {
    ...userEventBase({ id: state.profileId } as Parameters<typeof userEventBase>[0], role || "creator"),
    eventName: "social_oauth_connected",
    entityType: "connected_social_account",
    entityId: account.id,
    metadata: { provider: state.provider, [entityKey]: entityId, platform_account_id: accountId, status: connectionStatus }
  });

  return NextResponse.redirect(profileRedirect(state.returnTo, {
    social: selected ? `${state.provider}_connected` : `${state.provider}_limited_connected`
  }));
}

function getProviderFromState(encoded: string) {
  try {
    const parsed = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")) as { provider?: string };
    return parsed.provider;
  } catch {
    return null;
  }
}

async function exchangeMetaCode(code: string, provider: "instagram" | "facebook"): Promise<MetaTokenResponse> {
  const version = process.env.META_GRAPH_VERSION ?? "v20.0";
  const response = await fetch(`https://graph.facebook.com/${version}/oauth/access_token?${new URLSearchParams({
    client_id: process.env.META_APP_ID ?? "",
    client_secret: process.env.META_APP_SECRET ?? "",
    redirect_uri: getProviderRedirectUri(provider),
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

async function fetchMetaProfile(accessToken: string) {
  const version = process.env.META_GRAPH_VERSION ?? "v20.0";
  const response = await fetch(`https://graph.facebook.com/${version}/me?fields=id,name`, {
    headers: { Authorization: `Bearer ${accessToken}` }
  });
  if (!response.ok) return null;
  return response.json() as Promise<MetaProfileResponse>;
}

function selectMetaPage(pages: MetaPage[], provider: "instagram" | "facebook") {
  if (provider === "instagram") return pages.find((page) => page.instagram_business_account?.id);
  return pages[0] ?? null;
}

function getMetaOAuthScopes() {
  const explicitScopes = process.env.META_OAUTH_SCOPES
    ?.split(",")
    .map((scope) => scope.trim())
    .filter(Boolean);

  if (explicitScopes?.length) return explicitScopes;

  if (process.env.META_OAUTH_MODE === "business") {
    return ["pages_show_list", "pages_read_engagement", "instagram_basic", "instagram_manage_insights"];
  }

  // Default: only public_profile (granted without App Review). Adding email
  // requires App Review approval in Meta App Dashboard.
  return ["public_profile"];
}
