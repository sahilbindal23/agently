// Phyllo Identity API client. Drop-in replacement for our DIY public scrapers
// when PHYLLO_CLIENT_ID + PHYLLO_CLIENT_SECRET are set. Falls back to scraping
// when not configured, so dev / staging / pre-billing keeps working.
//
// Docs: https://docs.getphyllo.com/docs/api-reference
//
// API model:
//   - Identity API: handle -> profile lookup. ~$0.10 per call. No creator
//     action required, no OAuth, just a server-side call with Basic auth.
//   - Endpoint: POST /v1/social/profiles/lookup
//     body: { identifier, work_platform_id }
//
// Each social platform Phyllo supports has a stable work_platform_id UUID.
// We hardcode the well-known ones here but allow override via env vars in
// case Phyllo ever rotates them or adds new platforms.

export type PhylloPlatform = "instagram" | "youtube" | "facebook" | "twitter";

export type PhylloProfile = {
  ok: true;
  platform: PhylloPlatform;
  identifier: string;
  display_name: string | null;
  username: string | null;
  followers: number | null;
  following: number | null;
  content_count: number | null;
  is_verified: boolean | null;
  profile_url: string | null;
  image_url: string | null;
  description: string | null;
  fetched_at: string;
  raw: Record<string, unknown>;
};

export type PhylloFailure = {
  ok: false;
  platform: PhylloPlatform;
  identifier: string;
  reason:
    | "missing_credentials"
    | "unsupported_platform"
    | "profile_not_found"
    | "rate_limited"
    | "auth_error"
    | "fetch_error"
    | "parse_failed"
    | "timeout";
  http_status?: number;
  detail?: string;
  fetched_at: string;
};

export type PhylloResult = PhylloProfile | PhylloFailure;

const FETCH_TIMEOUT_MS = 10_000;

// Default work_platform_id values from Phyllo docs as of 2025. Override with
// env vars if Phyllo updates them.
const DEFAULT_PLATFORM_IDS: Record<PhylloPlatform, string> = {
  instagram: "9bb8913b-ddd9-430b-a66a-d74d846e6c66",
  youtube:   "14d9ddf5-51c6-415e-bde6-f8ed36ad7054",
  facebook:  "ad2fec62-2987-40a0-89fb-23485972598c",
  twitter:   "7645460a-96e0-4192-a3ce-a1fc30641f72"
};

export function isPhylloConfigured(): boolean {
  return Boolean(process.env.PHYLLO_CLIENT_ID && process.env.PHYLLO_CLIENT_SECRET);
}

function getPhylloBaseUrl(): string {
  // Default to production. Phyllo's staging/sandbox is api.staging.getphyllo.com -
  // set PHYLLO_API_URL to override during dev.
  return process.env.PHYLLO_API_URL ?? "https://api.getphyllo.com";
}

function getPlatformId(platform: PhylloPlatform): string | null {
  const envKey = `PHYLLO_PLATFORM_ID_${platform.toUpperCase()}`;
  const fromEnv = process.env[envKey];
  return fromEnv || DEFAULT_PLATFORM_IDS[platform] || null;
}

/**
 * Identity-API lookup for a creator profile by handle.
 *
 * Returns a discriminated union. Branch on .ok.
 *
 * Falls through with reason='missing_credentials' if Phyllo env vars are
 * not set, so callers can chain with the public scraper as a fallback:
 *
 *   const phyllo = await fetchPhylloProfile("instagram", handle);
 *   if (phyllo.ok) return adaptToOurShape(phyllo);
 *   // ... fall back to DIY scraper
 */
export async function fetchPhylloProfile(platform: PhylloPlatform, identifier: string): Promise<PhylloResult> {
  const fetched_at = new Date().toISOString();
  if (!isPhylloConfigured()) {
    return { ok: false, platform, identifier, reason: "missing_credentials", fetched_at };
  }
  const platformId = getPlatformId(platform);
  if (!platformId) {
    return { ok: false, platform, identifier, reason: "unsupported_platform", fetched_at };
  }

  const auth = Buffer.from(`${process.env.PHYLLO_CLIENT_ID}:${process.env.PHYLLO_CLIENT_SECRET}`).toString("base64");

  let response: Response;
  try {
    response = await fetch(`${getPhylloBaseUrl()}/v1/social/profiles/lookup`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/json",
        Accept: "application/json"
      },
      body: JSON.stringify({ identifier, work_platform_id: platformId }),
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS)
    });
  } catch (err) {
    const isTimeout = err instanceof Error && err.name === "TimeoutError";
    return {
      ok: false,
      platform,
      identifier,
      reason: isTimeout ? "timeout" : "fetch_error",
      fetched_at,
      detail: err instanceof Error ? err.message : undefined
    };
  }

  if (response.status === 401 || response.status === 403) {
    return { ok: false, platform, identifier, reason: "auth_error", http_status: response.status, fetched_at };
  }
  if (response.status === 404) {
    return { ok: false, platform, identifier, reason: "profile_not_found", http_status: 404, fetched_at };
  }
  if (response.status === 429) {
    return { ok: false, platform, identifier, reason: "rate_limited", http_status: 429, fetched_at };
  }

  let body: Record<string, unknown>;
  try {
    body = await response.json();
  } catch {
    return { ok: false, platform, identifier, reason: "parse_failed", http_status: response.status, fetched_at };
  }

  if (!response.ok) {
    const detail = typeof body?.message === "string" ? body.message : undefined;
    return { ok: false, platform, identifier, reason: "fetch_error", http_status: response.status, fetched_at, detail };
  }

  // Phyllo's profile shape varies a bit by platform but the core fields are
  // consistent. We pull out the ones we care about and keep the raw payload
  // for downstream consumers that want richer data.
  const profile = (body.profile as Record<string, unknown>) ?? body;
  if (!profile || typeof profile !== "object") {
    return { ok: false, platform, identifier, reason: "parse_failed", fetched_at };
  }

  return {
    ok: true,
    platform,
    identifier,
    display_name: stringOrNull(profile.full_name) ?? stringOrNull(profile.display_name),
    username: stringOrNull(profile.username) ?? stringOrNull(profile.platform_username),
    followers: numberOrNull(profile.reputation && (profile.reputation as Record<string, unknown>).follower_count) ?? numberOrNull(profile.follower_count),
    following: numberOrNull(profile.reputation && (profile.reputation as Record<string, unknown>).following_count) ?? numberOrNull(profile.following_count),
    content_count: numberOrNull(profile.reputation && (profile.reputation as Record<string, unknown>).content_count) ?? numberOrNull(profile.content_count),
    is_verified: typeof profile.is_verified === "boolean" ? profile.is_verified : null,
    profile_url: stringOrNull(profile.url),
    image_url: stringOrNull(profile.image_url) ?? stringOrNull(profile.profile_image_url),
    description: stringOrNull(profile.introduction) ?? stringOrNull(profile.description),
    fetched_at,
    raw: body
  };
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
 * Same shape as our existing platform-specific consistency checks.
 */
export function classifyPhylloAgainstSelfReport(scraped: number, selfReported?: number | null) {
  if (!selfReported || selfReported <= 0) {
    return { verdict: "no_self_report" as const, delta_pct: 0 };
  }
  const delta = Math.abs(scraped - selfReported) / selfReported;
  return delta <= 0.20
    ? { verdict: "within_tolerance" as const, delta_pct: Number((delta * 100).toFixed(1)) }
    : { verdict: "significant_difference" as const, delta_pct: Number((delta * 100).toFixed(1)) };
}
