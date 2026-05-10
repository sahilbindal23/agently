import { fetchPhylloProfile, isPhylloConfigured } from "@/lib/social/phyllo-client";

// Public Facebook page metric scraper. Same shape as instagram-public-scraper.
// Tries multiple parsing strategies because Facebook (like Instagram) varies
// what gets server-rendered vs hydrated client-side.
//
// Strategies:
//   1. og:description meta - sometimes contains "X likes · Y talking about this"
//   2. twitter:description - twitter card mirrors og: data
//   3. Direct text scan - "1.2M people like this", "12,345 followers"
//
// IMPORTANT: Facebook actively blocks unauthenticated bot fetches harder
// than Instagram. Expect higher failure rates. The Mbasic.facebook.com
// mobile-fallback domain works better than the main domain for some pages.

export type FacebookPublicMetrics = {
  ok: true;
  handle: string;
  display_name: string | null;
  followers: number | null;
  likes: number | null;
  page_url: string;
  fetched_at: string;
  raw_description: string;
};

export type FacebookScrapeFailure = {
  ok: false;
  handle: string;
  reason:
    | "invalid_handle"
    | "private_or_restricted"
    | "rate_limited"
    | "not_found"
    | "fetch_error"
    | "no_meta_data"
    | "parse_failed"
    | "login_wall"
    | "timeout";
  http_status?: number;
  fetched_at: string;
};

export type FacebookScrapeResult = FacebookPublicMetrics | FacebookScrapeFailure;

const FETCH_TIMEOUT_MS = 8000;

export async function fetchFacebookPublicMetrics(handleOrUrl: string): Promise<FacebookScrapeResult> {
  const handle = normalizeFacebookHandle(handleOrUrl);
  if (!handle) {
    return { ok: false, handle: handleOrUrl, reason: "invalid_handle", fetched_at: new Date().toISOString() };
  }

  // 1. Phyllo first if configured - production path
  if (isPhylloConfigured()) {
    const phyllo = await fetchPhylloProfile("facebook", handle);
    if (phyllo.ok) {
      return {
        ok: true,
        handle,
        display_name: phyllo.display_name,
        followers: phyllo.followers,
        likes: null,
        page_url: phyllo.profile_url ?? `https://www.facebook.com/${handle}`,
        fetched_at: phyllo.fetched_at,
        raw_description: "(via Phyllo Identity API)"
      };
    }
    // Fall through to scraping on Phyllo failure
  }

  // Try main domain first, fall back to mbasic which sometimes serves
  // less-blocked HTML to non-logged-in clients.
  const candidates = [
    `https://www.facebook.com/${handle}`,
    `https://m.facebook.com/${handle}`,
    `https://mbasic.facebook.com/${handle}`
  ];

  let lastFailure: FacebookScrapeFailure | null = null;
  for (const url of candidates) {
    const result = await scrapeOne(url, handle);
    if (result.ok) return result;
    lastFailure = result;
    // If it's a hard failure (not_found, rate_limited), stop trying other URLs
    if (result.reason === "not_found" || result.reason === "rate_limited" || result.reason === "private_or_restricted") {
      break;
    }
  }
  return lastFailure ?? { ok: false, handle, reason: "fetch_error", fetched_at: new Date().toISOString() };
}

async function scrapeOne(url: string, handle: string): Promise<FacebookScrapeResult> {
  const fetched_at = new Date().toISOString();
  let response: Response;
  try {
    response = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; AgentlyBot/1.0; +https://agently.in)",
        Accept: "text/html,application/xhtml+xml",
        "Accept-Language": "en-US,en;q=0.9"
      },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      redirect: "follow"
    });
  } catch (err) {
    const isAbort = err instanceof Error && err.name === "TimeoutError";
    return { ok: false, handle, reason: isAbort ? "timeout" : "fetch_error", fetched_at };
  }

  if (response.status === 404) return { ok: false, handle, reason: "not_found", http_status: 404, fetched_at };
  if (response.status === 429) return { ok: false, handle, reason: "rate_limited", http_status: 429, fetched_at };
  if (!response.ok) return { ok: false, handle, reason: "fetch_error", http_status: response.status, fetched_at };

  let html: string;
  try {
    html = await response.text();
  } catch {
    return { ok: false, handle, reason: "fetch_error", fetched_at };
  }

  // Login wall detection
  if (/<title>(Log in|Login)[^<]*<\/title>/i.test(html) || /name=["']email["'][^>]+placeholder=["']Email/.test(html)) {
    return { ok: false, handle, reason: "login_wall", fetched_at };
  }
  if (/page is currently unavailable|content isn't available/i.test(html)) {
    return { ok: false, handle, reason: "private_or_restricted", fetched_at };
  }

  // Strategy 1: og:description meta tag
  const ogDesc = extractMeta(html, "og:description") ?? "";
  const ogTitle = extractMeta(html, "og:title") ?? "";
  const stats1 = parseFacebookStats(ogDesc);
  if (stats1) {
    return {
      ok: true,
      handle,
      display_name: ogTitle ? cleanDisplayName(ogTitle) : null,
      followers: stats1.followers,
      likes: stats1.likes,
      page_url: url,
      fetched_at,
      raw_description: ogDesc
    };
  }

  // Strategy 2: twitter:description (often duplicates og:)
  const twDesc = extractMeta(html, "twitter:description") ?? "";
  const stats2 = parseFacebookStats(twDesc);
  if (stats2) {
    return {
      ok: true,
      handle,
      display_name: ogTitle ? cleanDisplayName(ogTitle) : extractMeta(html, "twitter:title") ?? null,
      followers: stats2.followers,
      likes: stats2.likes,
      page_url: url,
      fetched_at,
      raw_description: twDesc
    };
  }

  // Strategy 3: free-text scan within the body for follower counts
  const bodyText = html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
  const stats3 = parseFacebookStats(bodyText.slice(0, 100_000));
  if (stats3) {
    return {
      ok: true,
      handle,
      display_name: ogTitle ? cleanDisplayName(ogTitle) : null,
      followers: stats3.followers,
      likes: stats3.likes,
      page_url: url,
      fetched_at,
      raw_description: ogDesc || "(extracted from page body)"
    };
  }

  if (!ogDesc && !twDesc) return { ok: false, handle, reason: "no_meta_data", fetched_at };
  return { ok: false, handle, reason: "parse_failed", fetched_at };
}

/**
 * Accept any of: "PageName", "@PageName", "facebook.com/PageName",
 * "https://www.facebook.com/PageName/posts/...", returns clean handle.
 */
export function normalizeFacebookHandle(input: string): string | null {
  let raw = String(input ?? "").trim();
  if (!raw) return null;
  raw = raw.replace(/^@/, "");

  if (/^https?:\/\//i.test(raw) || /facebook\.com/i.test(raw)) {
    const withScheme = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
    try {
      const url = new URL(withScheme);
      const seg = url.pathname.split("/").filter(Boolean)[0];
      if (seg && seg !== "profile.php") raw = seg;
      // For numeric profile IDs (profile.php?id=123), grab the id
      if (seg === "profile.php") {
        const id = url.searchParams.get("id");
        if (id) raw = id;
      }
    } catch {
      return null;
    }
  }

  // Facebook page handles are loose: alphanumeric + dots + dashes
  if (!/^[A-Za-z0-9.\-_]{3,80}$/.test(raw)) return null;
  return raw;
}

function extractMeta(html: string, property: string): string | null {
  const escaped = property.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const patterns = [
    new RegExp(`<meta[^>]+property=["']${escaped}["'][^>]+content=["']([^"']+)["']`, "i"),
    new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+property=["']${escaped}["']`, "i"),
    new RegExp(`<meta[^>]+name=["']${escaped}["'][^>]+content=["']([^"']+)["']`, "i")
  ];
  for (const re of patterns) {
    const m = html.match(re);
    if (m) return decodeHtmlEntities(m[1]);
  }
  return null;
}

function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&apos;/g, "'");
}

function cleanDisplayName(ogTitle: string): string {
  return ogTitle
    .replace(/\s*[•·\-–—]\s*Facebook.*$/i, "")
    .replace(/\s*\|\s*Facebook.*$/i, "")
    .trim();
}

function parseFacebookStats(text: string): { followers: number | null; likes: number | null } | null {
  // Patterns Facebook uses (or used historically) in og:description and body:
  //   "1.2M followers · 1.1M likes · 5K talking about this"
  //   "Mamaearth. 1,234,567 likes · 234 talking about this · 12 were here."
  //   "Followers · 1.2M"
  //   "12,345 people follow this"
  const followerPatterns = [
    /([\d,.]+\s*[kKmMbB]?)\s*(?:followers?|people follow this|people are following this)/i,
    /(?:followers?|following)\s*[·:•]\s*([\d,.]+\s*[kKmMbB]?)/i
  ];
  const likePatterns = [
    /([\d,.]+\s*[kKmMbB]?)\s*(?:people like this|likes?)\b/i,
    /likes?\s*[·:•]\s*([\d,.]+\s*[kKmMbB]?)/i
  ];

  let followers: number | null = null;
  let likes: number | null = null;

  for (const re of followerPatterns) {
    const m = text.match(re);
    if (m) {
      followers = parseAbbreviatedNumber(m[1]);
      if (followers !== null) break;
    }
  }
  for (const re of likePatterns) {
    const m = text.match(re);
    if (m) {
      likes = parseAbbreviatedNumber(m[1]);
      if (likes !== null) break;
    }
  }

  if (followers === null && likes === null) return null;
  return { followers, likes };
}

function parseAbbreviatedNumber(text: string): number | null {
  const clean = String(text).replace(/,/g, "").replace(/\s+/g, "").trim();
  const match = clean.match(/^([\d.]+)([kKmMbB]?)$/);
  if (!match) return null;
  const num = parseFloat(match[1]);
  if (!Number.isFinite(num)) return null;
  const suffix = match[2].toLowerCase();
  if (suffix === "k") return Math.round(num * 1_000);
  if (suffix === "m") return Math.round(num * 1_000_000);
  if (suffix === "b") return Math.round(num * 1_000_000_000);
  return Math.round(num);
}

export function classifyFacebookAgainstSelfReport(scraped: number, selfReported?: number | null) {
  if (!selfReported || selfReported <= 0) {
    return { verdict: "no_self_report" as const, delta_pct: 0 };
  }
  const delta = Math.abs(scraped - selfReported) / selfReported;
  return delta <= 0.20
    ? { verdict: "within_tolerance" as const, delta_pct: Number((delta * 100).toFixed(1)) }
    : { verdict: "significant_difference" as const, delta_pct: Number((delta * 100).toFixed(1)) };
}
