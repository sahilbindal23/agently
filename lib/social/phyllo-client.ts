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
  return process.env.PHYLLO_API_URL ?? "https://api.staging.getphyllo.com";
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
    const message = describePhylloError(body, response.status);
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

export async function getPhylloUserByExternalId(externalId: string) {
  return phylloFetch<{ id: string; name?: string; external_id?: string }>(
    `/v1/users/external_id/${encodeURIComponent(externalId)}`,
    { method: "GET" }
  );
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

// ---------- 3b. Audience demographics for a connected account ----------

export type PhylloAudienceData = {
  ok: true;
  countries: Array<{ code: string; name: string | null; percent: number }>;
  cities: Array<{ name: string; percent: number }>;
  age_range: string | null;
  raw: Record<string, unknown>;
};

export async function fetchAccountAudience(accountId: string): Promise<PhylloAudienceData | { ok: false; error: string; status: number }> {
  // Requires the IDENTITY.AUDIENCE product. Returns a country/city/age
  // breakdown for the connected account's audience.
  const result = await phylloFetch<Record<string, unknown>>(
    `/v1/audience?account_id=${encodeURIComponent(accountId)}`,
    { method: "GET" }
  );
  if (!result.ok) return { ok: false, error: result.error, status: result.status };
  const body = result.data;
  const audience = (Array.isArray((body as { data?: unknown[] }).data) ? ((body as { data: Record<string, unknown>[] }).data[0]) : null)
    ?? (body.audience as Record<string, unknown> | undefined)
    ?? body;

  const countries = parseDemographic(audience.countries ?? audience.country_distribution, "code", "name");
  const cities = parseDemographic(audience.cities ?? audience.city_distribution, "name").map((row) => ({ name: row.code, percent: row.percent }));
  const ages = parseDemographic(audience.age_distribution ?? audience.age_groups ?? audience.ages, "code");
  const dominantAge = ages.sort((a, b) => b.percent - a.percent)[0]?.code ?? null;

  return {
    ok: true,
    countries: countries.map((row) => ({ code: row.code, name: row.name ?? null, percent: row.percent })),
    cities,
    age_range: dominantAge,
    raw: audience as Record<string, unknown>
  };
}

type DemographicRow = { code: string; name: string | null; percent: number };

function parseDemographic(value: unknown, codeKey: string, nameKey?: string): DemographicRow[] {
  if (!Array.isArray(value)) return [];
  const rows: DemographicRow[] = [];
  for (const entry of value) {
    if (!entry || typeof entry !== "object") continue;
    const row = entry as Record<string, unknown>;
    const code = stringOrNull(row[codeKey]) ?? stringOrNull(row.code) ?? stringOrNull(row.name) ?? stringOrNull(row.id);
    if (!code) continue;
    const percentRaw = numberOrNull(row.value) ?? numberOrNull(row.percentage) ?? numberOrNull(row.percent) ?? numberOrNull(row.share);
    // Phyllo returns either a 0-100 percent or a 0-1 fraction depending
    // on endpoint and product. Normalise to a percent (0-100).
    const percent = percentRaw === null ? 0 : (percentRaw <= 1 ? percentRaw * 100 : percentRaw);
    const name = nameKey ? stringOrNull(row[nameKey]) : null;
    rows.push({ code, name, percent: Math.round(percent * 100) / 100 });
  }
  return rows;
}

// ---------- 3c. Recent contents / posts for engagement metrics ----------

export type PhylloContentsData = {
  ok: true;
  avg_views_30d: number;
  total_views_30d: number;
  engagement_rate_30d: number;
  sample_count: number;
  raw: unknown;
};

export async function fetchAccountContents(accountId: string): Promise<PhylloContentsData | { ok: false; error: string; status: number }> {
  // Requires the ENGAGEMENT product. Pulls recent posts and computes avg
  // views / engagement rate across the last 30 days where possible.
  const since = new Date();
  since.setDate(since.getDate() - 30);
  const fromDate = since.toISOString().slice(0, 10);

  const result = await phylloFetch<Record<string, unknown>>(
    `/v1/social/contents?account_id=${encodeURIComponent(accountId)}&from_date=${fromDate}&limit=50`,
    { method: "GET" }
  );
  if (!result.ok) return { ok: false, error: result.error, status: result.status };

  const body = result.data;
  const items = Array.isArray((body as { data?: unknown[] }).data)
    ? (body as { data: Record<string, unknown>[] }).data
    : Array.isArray((body as { contents?: unknown[] }).contents)
      ? (body as { contents: Record<string, unknown>[] }).contents
      : [];

  let totalViews = 0;
  let totalEngagementInteractions = 0;
  let sampleCount = 0;

  for (const raw of items) {
    if (!raw || typeof raw !== "object") continue;
    const engagement = (raw.engagement as Record<string, unknown> | undefined) ?? {};
    const views = numberOrNull(engagement.view_count) ?? numberOrNull(engagement.impression_count) ?? numberOrNull(raw.view_count) ?? 0;
    const likes = numberOrNull(engagement.like_count) ?? numberOrNull(raw.like_count) ?? 0;
    const comments = numberOrNull(engagement.comment_count) ?? numberOrNull(raw.comment_count) ?? 0;
    const shares = numberOrNull(engagement.share_count) ?? numberOrNull(raw.share_count) ?? 0;
    totalViews += views ?? 0;
    totalEngagementInteractions += (likes ?? 0) + (comments ?? 0) + (shares ?? 0);
    sampleCount += 1;
  }

  const avgViews = sampleCount > 0 ? Math.round(totalViews / sampleCount) : 0;
  const engagementRate = totalViews > 0
    ? Number(((totalEngagementInteractions / totalViews) * 100).toFixed(2))
    : 0;

  return {
    ok: true,
    avg_views_30d: avgViews,
    total_views_30d: totalViews,
    engagement_rate_30d: engagementRate,
    sample_count: sampleCount,
    raw: body
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

function describePhylloError(body: unknown, status: number) {
  if (!body || typeof body !== "object") return `Phyllo ${status}`;
  const record = body as Record<string, unknown>;
  const message =
    stringOrNull(record.message) ??
    stringOrNull(record.error) ??
    stringOrNull(record.detail) ??
    stringOrNull(record.title);
  if (message) return `${message} (Phyllo ${status})`;
  try {
    return `${JSON.stringify(body).slice(0, 500)} (Phyllo ${status})`;
  } catch {
    return `Phyllo ${status}`;
  }
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
