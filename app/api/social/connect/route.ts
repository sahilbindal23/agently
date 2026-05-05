import { NextResponse } from "next/server";
import { trackEvent, userEventBase } from "@/lib/analytics/track";
import { createSocialOAuthState, getProviderRedirectUri, isProviderOAuthReady } from "@/lib/social/oauth";
import { socialProviders, type SocialProvider } from "@/lib/social/platforms";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const provider = String(url.searchParams.get("provider") ?? "").trim() as SocialProvider;
  const returnTo = String(url.searchParams.get("return_to") ?? "/profile");

  if (!socialProviders.some((item) => item.id === provider)) {
    return NextResponse.redirect(new URL("/profile?social=invalid_provider", url.origin));
  }

  const auth = await createClient();
  const { data: authData } = await auth.auth.getUser();
  if (!authData.user) return NextResponse.redirect(new URL("/login", url.origin));

  if (!isProviderOAuthReady(provider)) {
    return NextResponse.redirect(new URL(`/profile?social=${provider}_oauth_not_configured`, url.origin));
  }

  const state = await createSocialOAuthState(provider, authData.user.id, returnTo);
  const redirectUri = getProviderRedirectUri(provider);

  if (provider === "youtube") {
    const authUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
    authUrl.searchParams.set("client_id", process.env.GOOGLE_CLIENT_ID ?? "");
    authUrl.searchParams.set("redirect_uri", redirectUri);
    authUrl.searchParams.set("response_type", "code");
    authUrl.searchParams.set("scope", "https://www.googleapis.com/auth/youtube.readonly https://www.googleapis.com/auth/yt-analytics.readonly");
    authUrl.searchParams.set("access_type", "offline");
    authUrl.searchParams.set("include_granted_scopes", "true");
    authUrl.searchParams.set("prompt", "consent");
    authUrl.searchParams.set("state", state);
    return NextResponse.redirect(authUrl);
  }

  const metaVersion = process.env.META_GRAPH_VERSION ?? "v20.0";
  const authUrl = new URL(`https://www.facebook.com/${metaVersion}/dialog/oauth`);
  authUrl.searchParams.set("client_id", process.env.META_APP_ID ?? "");
  authUrl.searchParams.set("redirect_uri", redirectUri);
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("scope", "pages_show_list,pages_read_engagement,read_insights,instagram_basic,instagram_manage_insights");
  authUrl.searchParams.set("state", state);
  return NextResponse.redirect(authUrl);
}

export async function POST(request: Request) {
  const body = await request.json();
  const provider = String(body.provider ?? "").trim() as SocialProvider;
  const handle = String(body.handle ?? "").trim();
  const accountUrl = String(body.account_url ?? "").trim();

  if (!socialProviders.some((item) => item.id === provider) || !handle) {
    return NextResponse.json({ error: "Provider and handle are required." }, { status: 400 });
  }

  const auth = await createClient();
  const { data: authData } = await auth.auth.getUser();
  if (!authData.user) return NextResponse.json({ error: "Login required." }, { status: 401 });

  const admin = createAdminClient();
  if (!admin) return NextResponse.json({ error: "Supabase service role key is not configured." }, { status: 500 });

  const { data: creator } = await admin.from("creators").select("*").eq("profile_id", authData.user.id).maybeSingle();
  if (!creator) return NextResponse.json({ error: "Create a creator profile before connecting social accounts." }, { status: 404 });

  const providerConfig = socialProviders.find((item) => item.id === provider);
  const { data, error } = await admin
    .from("connected_social_accounts")
    .upsert({
      profile_id: authData.user.id,
      creator_id: creator.id,
      provider,
      handle,
      account_url: accountUrl,
      platform_account_id: `${provider}:${handle}`,
      status: "mock_connected",
      scopes: providerConfig?.requiredScopes ?? []
    }, { onConflict: "creator_id,provider,handle" })
    .select("*")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  await trackEvent(admin, {
    ...userEventBase(authData.user, "creator"),
    eventName: "social_connected",
    entityType: "connected_social_account",
    entityId: data.id,
    metadata: { provider, creator_id: creator.id, status: data.status }
  });
  return NextResponse.json({ data });
}
