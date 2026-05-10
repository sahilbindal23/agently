import { fetchPhylloProfile, isPhylloConfigured } from "@/lib/social/phyllo-client";

// Public YouTube channel lookup via the YouTube Data API v3.
// No OAuth required - uses a server-side API key.
//
// Why this exists alongside the OAuth path:
//   - OAuth (youtube.readonly + yt-analytics.readonly) returns rich
//     analytics (audience country, demographics, watch time) but requires
//     creator authorization AND Google OAuth verification (sensitive scope).
//   - API key gives subscriber count, total views, video count for any
//     public channel without creator action - sufficient for trust score
//     and rate calculator inputs.
//
// Quota: 10,000 units/day on free tier. A channel lookup is 1 unit. Plenty.
// Cache 24h to avoid burning quota on repeat lookups.

export type YouTubePublicMetrics = {
  ok: true;
  channel_id: string;
  handle: string | null;
  display_name: string;
  subscribers: number | null;
  total_views: number | null;
  video_count: number | null;
  country: string | null;
  thumbnail_url: string | null;
  channel_url: string;
  fetched_at: string;
};

export type YouTubePublicFailure = {
  ok: false;
  reason:
    | "missing_api_key"
    | "invalid_input"
    | "channel_not_found"
    | "quota_exceeded"
    | "rate_limited"
    | "fetch_error"
    | "parse_failed"
    | "timeout";
  http_status?: number;
  fetched_at: string;
  detail?: string;
};

export type YouTubePublicResult = YouTubePublicMetrics | YouTubePublicFailure;

const FETCH_TIMEOUT_MS = 8000;
const API_BASE = "https://www.googleapis.com/youtube/v3";

/**
 * Look up a YouTube channel by handle (`@nameXYZ`), URL, or channel ID
 * (`UC...`). Returns a discriminated union; check `.ok` to branch.
 *
 * Accepts:
 *   - `@channelHandle`
 *   - `https://www.youtube.com/@channelHandle`
 *   - `https://www.youtube.com/channel/UC...`
 *   - `https://www.youtube.com/c/oldStyleSlug`
 *   - bare `UC...` channel ID
 */
export async function fetchYouTubeChannelMetrics(input: string): Promise<YouTubePublicResult> {
  const fetched_at = new Date().toISOString();

  // 1. Phyllo first when configured - same legitimate-data path as IG/FB
  if (isPhylloConfigured()) {
    const phyllo = await fetchPhylloProfile("youtube", input);
    if (phyllo.ok) {
      return {
        ok: true,
        channel_id: phyllo.username ?? "",
        handle: phyllo.username ?? null,
        display_name: phyllo.display_name ?? input,
        subscribers: phyllo.followers,
        total_views: null,
        video_count: phyllo.content_count,
        country: null,
        thumbnail_url: phyllo.image_url,
        channel_url: phyllo.profile_url ?? `https://www.youtube.com/${input}`,
        fetched_at: phyllo.fetched_at
      };
    }
    // Fall through to YouTube Data API on Phyllo failure
  }

  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) {
    return { ok: false, reason: "missing_api_key", fetched_at, detail: "YOUTUBE_API_KEY env var is not set and Phyllo is not configured" };
  }

  const ident = parseChannelInput(input);
  if (!ident) return { ok: false, reason: "invalid_input", fetched_at };

  // Strategy:
  //   - If we have a channel ID directly, query channels?id=...
  //   - If we have a handle, query channels?forHandle=@...
  //   - If we have an old-style /c/ slug, fall through to search-as-fallback
  let channelData: YouTubeChannelItem | null = null;
  let lastFailure: YouTubePublicFailure | null = null;

  if (ident.kind === "id") {
    const result = await queryChannel(apiKey, { id: ident.value });
    if (!result.ok) return result;
    channelData = result.item;
  } else if (ident.kind === "handle") {
    const result = await queryChannel(apiKey, { forHandle: ident.value });
    if (!result.ok) lastFailure = result;
    else channelData = result.item;
  } else if (ident.kind === "username") {
    // Legacy /user/ URLs - try forUsername first
    const result = await queryChannel(apiKey, { forUsername: ident.value });
    if (!result.ok) lastFailure = result;
    else channelData = result.item;
  }

  if (!channelData && lastFailure) return lastFailure;
  if (!channelData) return { ok: false, reason: "channel_not_found", fetched_at };

  const stats = channelData.statistics ?? {};
  const snippet = channelData.snippet ?? {};
  const channelId = String(channelData.id ?? "");
  const handle = ident.kind === "handle" ? ident.value : null;

  return {
    ok: true,
    channel_id: channelId,
    handle: handle,
    display_name: String(snippet.title ?? "YouTube channel"),
    subscribers: stats.hiddenSubscriberCount ? null : (parseSafeInt(stats.subscriberCount)),
    total_views: parseSafeInt(stats.viewCount),
    video_count: parseSafeInt(stats.videoCount),
    country: snippet.country ? String(snippet.country) : null,
    thumbnail_url: snippet.thumbnails?.default?.url ?? null,
    channel_url: handle
      ? `https://www.youtube.com/${handle}`
      : `https://www.youtube.com/channel/${channelId}`,
    fetched_at
  };
}

type ChannelQuery = { id: string } | { forHandle: string } | { forUsername: string };

type YouTubeChannelItem = {
  id?: string;
  snippet?: {
    title?: string;
    country?: string;
    thumbnails?: { default?: { url?: string } };
  };
  statistics?: {
    subscriberCount?: string;
    viewCount?: string;
    videoCount?: string;
    hiddenSubscriberCount?: boolean;
  };
};

type YouTubeListResponse = {
  items?: YouTubeChannelItem[];
  error?: { code?: number; message?: string; errors?: Array<{ reason?: string }> };
};

async function queryChannel(apiKey: string, query: ChannelQuery): Promise<{ ok: true; item: YouTubeChannelItem } | YouTubePublicFailure> {
  const fetched_at = new Date().toISOString();
  const params = new URLSearchParams({
    part: "snippet,statistics",
    key: apiKey,
    ...query
  });

  let response: Response;
  try {
    response = await fetch(`${API_BASE}/channels?${params.toString()}`, {
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS)
    });
  } catch (err) {
    const isTimeout = err instanceof Error && err.name === "TimeoutError";
    return { ok: false, reason: isTimeout ? "timeout" : "fetch_error", fetched_at, detail: err instanceof Error ? err.message : undefined };
  }

  let body: YouTubeListResponse;
  try {
    body = await response.json();
  } catch {
    return { ok: false, reason: "parse_failed", fetched_at, http_status: response.status };
  }

  if (!response.ok) {
    const reasonCode = body.error?.errors?.[0]?.reason ?? "";
    if (response.status === 403 && /quota/i.test(reasonCode)) {
      return { ok: false, reason: "quota_exceeded", fetched_at, http_status: response.status, detail: body.error?.message };
    }
    if (response.status === 429) {
      return { ok: false, reason: "rate_limited", fetched_at, http_status: response.status, detail: body.error?.message };
    }
    return { ok: false, reason: "fetch_error", fetched_at, http_status: response.status, detail: body.error?.message };
  }

  const item = body.items?.[0];
  if (!item) return { ok: false, reason: "channel_not_found", fetched_at };
  return { ok: true, item };
}

type ParsedIdent =
  | { kind: "id"; value: string }
  | { kind: "handle"; value: string } // includes leading @
  | { kind: "username"; value: string };

function parseChannelInput(input: string): ParsedIdent | null {
  const trimmed = String(input ?? "").trim();
  if (!trimmed) return null;

  // Bare channel ID like UCxxxxxxxxxxxxxxxxxxxxxx (24 chars starting with UC)
  if (/^UC[A-Za-z0-9_-]{20,}$/.test(trimmed)) {
    return { kind: "id", value: trimmed };
  }

  // Handle starting with @
  if (trimmed.startsWith("@")) {
    const clean = trimmed.toLowerCase();
    if (/^@[a-z0-9._-]{3,}$/.test(clean)) return { kind: "handle", value: clean };
    return null;
  }

  // URL forms
  if (/^https?:\/\//i.test(trimmed) || /youtube\.com|youtu\.be/i.test(trimmed)) {
    const withScheme = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
    let url: URL;
    try {
      url = new URL(withScheme);
    } catch {
      return null;
    }
    const segments = url.pathname.split("/").filter(Boolean);
    if (segments.length === 0) return null;

    const first = segments[0];
    if (first === "channel" && segments[1]) {
      return { kind: "id", value: segments[1] };
    }
    if (first === "user" && segments[1]) {
      return { kind: "username", value: segments[1] };
    }
    if (first.startsWith("@")) {
      return { kind: "handle", value: first.toLowerCase() };
    }
    if (first === "c" && segments[1]) {
      // /c/legacySlug - treat as a handle attempt; if forHandle fails the
      // caller will get channel_not_found (acceptable - these are deprecated)
      return { kind: "handle", value: `@${segments[1].toLowerCase()}` };
    }
  }

  // Bare handle without @
  if (/^[a-z0-9._-]{3,}$/i.test(trimmed)) {
    return { kind: "handle", value: `@${trimmed.toLowerCase()}` };
  }

  return null;
}

function parseSafeInt(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  const n = Number(value);
  return Number.isFinite(n) ? Math.round(n) : null;
}

/**
 * Same shape as the Instagram scrape consistency check - compares an
 * authoritative scrape against a self-reported number with 20% tolerance.
 */
export function classifyYouTubeAgainstSelfReport(scraped: number, selfReported?: number | null) {
  if (!selfReported || selfReported <= 0) {
    return { verdict: "no_self_report" as const, delta_pct: 0 };
  }
  const delta = Math.abs(scraped - selfReported) / selfReported;
  return delta <= 0.20
    ? { verdict: "within_tolerance" as const, delta_pct: Number((delta * 100).toFixed(1)) }
    : { verdict: "significant_difference" as const, delta_pct: Number((delta * 100).toFixed(1)) };
}
