// Phyllo Connect SDK integration.
//
// Phyllo's core product is creator-authorized: the creator clicks a button
// in our app, a Phyllo-hosted modal opens, they log into Instagram /
// YouTube / Facebook there, and Phyllo manages the OAuth + data sync. We
// receive profile data via /v1/profiles?account_id=... once the connection
// is made.
//
// Three backend operations:
//   1. createPhylloUser - register an Agently profile as a Phyllo user
//      (idempotent - we cache the phyllo_user_id on profiles)
//   2. createSdkToken   - mint a short-lived SDK token for the frontend
//   3. fetchAccountProfile - pull profile data after a connection lands
//   4. disconnectAccount - tell Phyllo to revoke a connected account
//
// Docs: https://docs.getphyllo.com/docs/api-reference

const FETCH_TIMEOUT_MS = 12_000;

export const PHYLLO_PRODUCTS_DEFAULT = [
  "IDENTITY",
  "IDENTITY.AUDIENCE",
  "ENGAGEMENT",
  "ENGAGEMENT.AUDIENCE"
] as const;

export type PhylloProduct = typeof PHYLLO_PRODUCTS_DEFAULT[number] | "INCOME" | "ACTIVITY";

export type PhylloPlatform = "instagram" | "youtube" | "facebook" | "twitter";

export function isPhylloConfigured(): boolean {
  return Boolean(process.env.PHYLLO_CLIENT_ID && process.env.PHYLLO_CLIENT_SECRET);
}

function getPhylloBaseUrl(): string {
  return process.env.PHYLLO_API_URL ?? "https://api.getphyllo.com";
}

function getPhylloEnvironment(): "staging" | "sandbox" | "production" {
  const url = getPhylloBaseUrl();
  if (url.includes("staging")) return "staging";
  if (url.includes("sandbox")) return "sandbox";
  return "production";
}

function authHeader() {
  const auth = Buffer.from(`${process.env.PHYLLO_CLIENT_ID}:${process.env.PHYLLO_CLIENT_SECRET}`).toString("base64");
  return `Basic ${auth}`;
}

async function phylloFetch<T = unknown>(path: string, init?: RequestInit): Promise<{ ok: true; status: number; data: T } | { ok: false; status: number; error: string }> {
  if (!isPhylloConfigured()) {
    return { ok: false, status: 0, error: "Phyllo credentials not configured" };
  }
  let response: Response;
  try {
    response = await fetch(`${getPhylloBaseUrl()}${path}`, {
      ...init,
      headers: {
        Authorization: authHeader(),
        "Content-Type": "application/json",
        Accept: "application/json",
        ...(init?.headers ?? {})
      },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS)
    });
  } catch (err) {
    return { ok: false, status: 0, error: err instanceof Error ? err.message : "fetch_error" };
  }
  let body: unknown;
  try { body = await response.json(); } catch { body = null; }
  if (!response.ok) {
    const message = (body && typeof body === "object" && "message" in body) ? String((body as Record<string, unknown>).message) : `Phyllo ${response.status}`;
    return { ok: false, status: response.status, error: message };
  }
  return { ok: true, status: response.status, data: body as T };
}

// ---------- 1. Create / get a Phyllo user for an Agently profile ----------

export async function createPhylloUser(params: { name: string; external_id: string }) {
  return phylloFetch<{ id: string; name: string; external_id: string }>("/v1/users", {
    method: "POST",
    body: JSON.stringify({ name: params.name, external_id: params.external_id })
  });
}

// ---------- 2. Mint an SDK token for the frontend ----------

export async function createSdkToken(params: { user_id: string; products?: readonly PhylloProduct[] }) {
  return phylloFetch<{ sdk_token: string; expires_at: string }>("/v1/sdk-tokens", {
    method: "POST",
    body: JSON.stringify({
      user_id: params.user_id,
      products: params.products ?? PHYLLO_PRODUCTS_DEFAULT
    })
  });
}

// ---------- 3. Fetch profile data for a connected account ----------

export type PhylloProfileData = {
  ok: true;
  account_id: string;
  user_id: string;
  work_platform_id: string;
  platform_username: string | null;
  full_name: string | null;
  followers: number | null;
  following: number | null;
  content_count: number | null;
  is_verified: boolean | null;
  url: string | null;
  image_url: string | null;
  introduction: string | null;
  raw: Record<string, unknown>;
};

export async function fetchAccountProfile(accountId: string): Promise<PhylloProfileData | { ok: false; error: string; status: number }> {
  // Phyllo's /v1/profiles endpoint takes account_id as a query param and
  // returns the latest profile snapshot.
  const result = await phylloFetch<{ data?: Array<Record<string, unknown>>; profile?: Record<string, unknown> } | Record<string, unknown>>(
    `/v1/profiles?account_id=${encodeURIComponent(accountId)}`,
    { method: "GET" }
  );
  if (!result.ok) return { ok: false, error: result.error, status: result.status };

  // Response shape is sometimes { data: [profile] }, sometimes { profile },
  // sometimes the profile directly. Defensive parse.
  const body = result.data as Record<string, unknown>;
  const profile = (Array.isArray((body as { data?: unknown[] }).data) ? ((body as { data: Record<string, unknown>[] }).data[0]) : null)
    ?? (body.profile as Record<string, unknown> | undefined)
    ?? body;
  if (!profile || typeof profile !== "object") {
    return { ok: false, error: "Phyllo profile response could not be parsed", status: result.status };
  }

  const reputation = (profile.reputation as Record<string, unknown> | undefined) ?? {};

  const accountNode = (profile.account as Record<string, unknown> | undefined) ?? {};
  const userNode = (profile.user as Record<string, unknown> | undefined) ?? {};
  const workPlatformNode = (profile.work_platform as Record<string, unknown> | undefined) ?? {};

  return {
    ok: true,
    account_id: String(accountNode.id ?? accountId),
    user_id: String(userNode.id ?? ""),
    work_platform_id: String(workPlatformNode.id ?? profile.work_platform_id ?? ""),
    platform_username: stringOrNull(profile.platform_username) ?? stringOrNull(profile.username),
    full_name: stringOrNull(profile.full_name) ?? stringOrNull(profile.name),
    followers: numberOrNull(reputation.follower_count) ?? numberOrNull(profile.follower_count),
    following: numberOrNull(reputation.following_count) ?? numberOrNull(profile.following_count),
    content_count: numberOrNull(reputation.content_count) ?? numberOrNull(profile.content_count),
    is_verified: typeof profile.is_verified === "boolean" ? profile.is_verified : null,
    url: stringOrNull(profile.url),
    image_url: stringOrNull(profile.image_url) ?? stringOrNull(profile.profile_image_url),
    introduction: stringOrNull(profile.introduction) ?? stringOrNull(profile.description),
    raw: profile
  };
}

// ---------- 4. Disconnect a connected account ----------

export async function disconnectAccount(accountId: string) {
  // Phyllo doesn't have a hard "delete" - they revoke via DELETE on the
  // account endpoint. Returns 200/204 on success.
  return phylloFetch(`/v1/accounts/${encodeURIComponent(accountId)}/disconnect`, {
    method: "POST"
  });
}

// ---------- helpers ----------

export function getPhylloFrontendEnvironment() {
  return getPhylloEnvironment();
}

function stringOrNull(value: unknown): string | null {
  return typeof value === "string" && value.length ? value : null;
}

function numberOrNull(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  const n = Number(value);
  return Number.isFinite(n) ? Math.round(n) : null;
}

/**
 * Map a Phyllo platform name (instagram / youtube / facebook / twitter) to
 * the platform string we use in connected_social_accounts.provider.
 */
export function phylloPlatformName(workPlatformId: string, defaultName?: string): PhylloPlatform | null {
  // Stable production UUIDs, may differ in staging
  const map: Record<string, PhylloPlatform> = {
    "9bb8913b-ddd9-430b-a66a-d74d846e6c66": "instagram",
    "14d9ddf5-51c6-415e-bde6-f8ed36ad7054": "youtube",
    "ad2fec62-2987-40a0-89fb-23485972598c": "facebook",
    "7645460a-96e0-4192-a3ce-a1fc30641f72": "twitter"
  };
  if (map[workPlatformId]) return map[workPlatformId];
  // env var override (e.g. PHYLLO_PLATFORM_ID_INSTAGRAM)
  for (const platform of ["instagram", "youtube", "facebook", "twitter"] as const) {
    const envId = process.env[`PHYLLO_PLATFORM_ID_${platform.toUpperCase()}`];
    if (envId && envId === workPlatformId) return platform;
  }
  if (defaultName === "instagram" || defaultName === "youtube" || defaultName === "facebook" || defaultName === "twitter") {
    return defaultName;
  }
  return null;
}
