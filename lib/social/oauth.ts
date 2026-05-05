import { cookies } from "next/headers";
import crypto from "crypto";
import type { SocialProvider } from "@/lib/social/platforms";

export const SOCIAL_OAUTH_STATE_COOKIE = "agently_social_oauth_state";

export type SocialOAuthState = {
  nonce: string;
  provider: SocialProvider;
  profileId: string;
  returnTo: string;
};

export function isProviderOAuthReady(provider: SocialProvider) {
  if (provider === "youtube") return Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
  return Boolean(process.env.META_APP_ID && process.env.META_APP_SECRET);
}

export function getProviderRedirectUri(provider: SocialProvider) {
  const appUrl = process.env.APP_URL ?? "http://localhost:3000";
  if (provider === "youtube") return process.env.GOOGLE_REDIRECT_URI ?? `${appUrl}/api/social/youtube/callback`;
  return process.env.META_REDIRECT_URI ?? `${appUrl}/api/social/meta/callback`;
}

export async function createSocialOAuthState(provider: SocialProvider, profileId: string, returnTo = "/profile") {
  const state: SocialOAuthState = {
    nonce: crypto.randomBytes(24).toString("hex"),
    provider,
    profileId,
    returnTo
  };
  const encoded = Buffer.from(JSON.stringify(state), "utf8").toString("base64url");
  const cookieStore = await cookies();
  cookieStore.set(SOCIAL_OAUTH_STATE_COOKIE, encoded, {
    httpOnly: true,
    maxAge: 10 * 60,
    path: "/",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production"
  });
  return encoded;
}

export async function verifySocialOAuthState(encoded: string, expectedProvider: SocialProvider) {
  const cookieStore = await cookies();
  const stored = cookieStore.get(SOCIAL_OAUTH_STATE_COOKIE)?.value;
  cookieStore.delete(SOCIAL_OAUTH_STATE_COOKIE);
  if (!encoded || !stored || encoded !== stored) return null;

  try {
    const parsed = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")) as SocialOAuthState;
    if (parsed.provider !== expectedProvider || !parsed.profileId || !parsed.nonce) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function profileRedirect(path = "/profile", params?: Record<string, string>) {
  const appUrl = process.env.APP_URL ?? "http://localhost:3000";
  const url = new URL(path, appUrl);
  Object.entries(params ?? {}).forEach(([key, value]) => url.searchParams.set(key, value));
  return url;
}
