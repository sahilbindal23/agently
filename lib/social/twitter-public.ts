// Public Twitter / X user lookup via Twitter API v2.
// Uses an app-level Bearer Token (not OAuth) so any public profile can be
// queried without per-user authorization.
//
// COST WARNING: Twitter killed all free user-lookup tiers in 2023. To use
// this you need a paid Developer plan (Basic = $100/mo as of 2025), which
// gives access to /2/users/by/username with public_metrics. Until that env
// var is set, the scraper returns reason='missing_api_key' and callers
// fall back to self-reported.
//
// Endpoint reference:
//   https://api.twitter.com/2/users/by/username/{handle}?user.fields=public_metrics,verified,description,profile_image_url

export type TwitterPublicMetrics = {
  ok: true;
  user_id: string;
  handle: string;
  display_name: string;
  followers: number | null;
  following: number | null;
  tweet_count: number | null;
  is_verified: boolean | null;
  description: string | null;
  profile_url: string;
  profile_image_url: string | null;
  fetched_at: string;
};

export type TwitterPublicFailure = {
  ok: false;
  reason:
    | "missing_api_key"
    | "invalid_handle"
    | "user_not_found"
    | "suspended_or_protected"
    | "rate_limited"
    | "fetch_error"
    | "parse_failed"
    | "timeout";
  http_status?: number;
  fetched_at: string;
  detail?: string;
};

export type TwitterPublicResult = TwitterPublicMetrics | TwitterPublicFailure;

const FETCH_TIMEOUT_MS = 8000;
const API_BASE = "https://api.twitter.com/2";

export async function fetchTwitterPublicMetrics(input: string): Promise<TwitterPublicResult> {
  const fetched_at = new Date().toISOString();
  const bearer = process.env.TWITTER_BEARER_TOKEN;
  if (!bearer) {
    return {
      ok: false,
      reason: "missing_api_key",
      fetched_at,
      detail: "TWITTER_BEARER_TOKEN env var is not set. Twitter API v2 requires a paid Developer plan ($100/mo Basic tier as of 2025) for user lookups."
    };
  }

  const handle = normalizeTwitterHandle(input);
  if (!handle) return { ok: false, reason: "invalid_handle", fetched_at };

  let response: Response;
  try {
    const url = `${API_BASE}/users/by/username/${handle}?user.fields=public_metrics,verified,description,profile_image_url`;
    response = await fetch(url, {
      headers: { Authorization: `Bearer ${bearer}` },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS)
    });
  } catch (err) {
    const isTimeout = err instanceof Error && err.name === "TimeoutError";
    return { ok: false, reason: isTimeout ? "timeout" : "fetch_error", fetched_at, detail: err instanceof Error ? err.message : undefined };
  }

  if (response.status === 429) return { ok: false, reason: "rate_limited", http_status: 429, fetched_at };
  if (response.status === 401 || response.status === 403) {
    return { ok: false, reason: "fetch_error", http_status: response.status, fetched_at, detail: "Twitter rejected the bearer token. Check that TWITTER_BEARER_TOKEN is valid and your Developer project is active." };
  }

  let body: TwitterUserResponse;
  try {
    body = await response.json();
  } catch {
    return { ok: false, reason: "parse_failed", http_status: response.status, fetched_at };
  }

  if (body.errors?.length) {
    const first = body.errors[0];
    if (first.title === "Not Found Error" || /not found/i.test(first.detail ?? "")) {
      return { ok: false, reason: "user_not_found", http_status: response.status, fetched_at };
    }
    if (/suspended|protected|forbidden/i.test(first.detail ?? "")) {
      return { ok: false, reason: "suspended_or_protected", http_status: response.status, fetched_at };
    }
    return { ok: false, reason: "fetch_error", http_status: response.status, fetched_at, detail: first.detail ?? first.title };
  }

  const data = body.data;
  if (!data) return { ok: false, reason: "user_not_found", http_status: response.status, fetched_at };

  const metrics = data.public_metrics ?? {};
  return {
    ok: true,
    user_id: String(data.id ?? ""),
    handle: String(data.username ?? handle),
    display_name: String(data.name ?? handle),
    followers: numberOrNull(metrics.followers_count),
    following: numberOrNull(metrics.following_count),
    tweet_count: numberOrNull(metrics.tweet_count),
    is_verified: typeof data.verified === "boolean" ? data.verified : null,
    description: data.description ? String(data.description) : null,
    profile_url: `https://twitter.com/${data.username ?? handle}`,
    profile_image_url: data.profile_image_url ? String(data.profile_image_url) : null,
    fetched_at
  };
}

type TwitterUserResponse = {
  data?: {
    id?: string;
    username?: string;
    name?: string;
    verified?: boolean;
    description?: string;
    profile_image_url?: string;
    public_metrics?: {
      followers_count?: number;
      following_count?: number;
      tweet_count?: number;
      listed_count?: number;
    };
  };
  errors?: Array<{ title?: string; detail?: string }>;
};

/**
 * Accept any of: "@handle", "handle", "twitter.com/handle",
 * "https://x.com/handle/status/...", returns clean lowercased handle or
 * null if unparseable.
 */
export function normalizeTwitterHandle(input: string): string | null {
  let raw = String(input ?? "").trim();
  if (!raw) return null;
  raw = raw.replace(/^@/, "");

  if (/^https?:\/\//i.test(raw) || /(twitter\.com|x\.com)/i.test(raw)) {
    const withScheme = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
    try {
      const url = new URL(withScheme);
      const seg = url.pathname.split("/").filter(Boolean)[0];
      if (seg) raw = seg;
    } catch {
      return null;
    }
  }

  // Twitter handles: 1-15 chars, letters/numbers/underscore (no periods)
  raw = raw.toLowerCase();
  if (!/^[a-z0-9_]{1,15}$/.test(raw)) return null;
  return raw;
}

function numberOrNull(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  const n = Number(value);
  return Number.isFinite(n) ? Math.round(n) : null;
}

/**
 * Mirror of the IG/YouTube consistency check: scraped vs self-reported with
 * 20% tolerance.
 */
export function classifyTwitterAgainstSelfReport(scraped: number, selfReported?: number | null) {
  if (!selfReported || selfReported <= 0) {
    return { verdict: "no_self_report" as const, delta_pct: 0 };
  }
  const delta = Math.abs(scraped - selfReported) / selfReported;
  return delta <= 0.20
    ? { verdict: "within_tolerance" as const, delta_pct: Number((delta * 100).toFixed(1)) }
    : { verdict: "significant_difference" as const, delta_pct: Number((delta * 100).toFixed(1)) };
}
