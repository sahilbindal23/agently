// Public Instagram profile scraper. No OAuth required.
//
// Strategy: fetch the public profile HTML and parse the Open Graph
// description meta tag. Instagram puts follower/following/post counts there
// in a stable format like:
//   "1.2M Followers, 234 Following, 567 Posts - See Instagram photos and videos from @username"
//
// This is fragile by nature - Instagram can change their HTML at any time.
// Every failure path returns a typed status object instead of throwing so
// the caller can fall back to self-reported data and downgrade trust score
// rather than crashing the request.
//
// Trust contract:
//   - Successful scrape   -> metric_source = "public_scrape", confidence
//                            below OAuth (api_synced) but above self-reported
//   - Failed scrape       -> caller keeps existing self-reported data,
//                            no metric_source change
//
// IMPORTANT for callers: cache results aggressively. Do not call this more
// than once per profile per 24h. Instagram will rate-limit and IP-ban
// repeat offenders.

export type InstagramPublicMetrics = {
  ok: true;
  handle: string;
  display_name: string | null;
  followers: number | null;
  following: number | null;
  posts: number | null;
  profile_url: string;
  fetched_at: string;
  raw_description: string;
};

export type InstagramScrapeFailure = {
  ok: false;
  handle: string;
  reason:
    | "invalid_handle"
    | "private_profile"
    | "rate_limited"
    | "not_found"
    | "fetch_error"
    | "no_meta_data"
    | "parse_failed"
    | "timeout";
  http_status?: number;
  fetched_at: string;
};

export type InstagramScrapeResult = InstagramPublicMetrics | InstagramScrapeFailure;

const SCRAPE_TIMEOUT_MS = 8000;

/**
 * Scrape a public Instagram profile for follower / following / post counts.
 * Returns a discriminated union — check `.ok` to branch.
 */
export async function fetchInstagramPublicMetrics(handleOrUrl: string): Promise<InstagramScrapeResult> {
  const handle = normalizeHandle(handleOrUrl);
  if (!handle) {
    return { ok: false, handle: handleOrUrl, reason: "invalid_handle", fetched_at: new Date().toISOString() };
  }

  const profileUrl = `https://www.instagram.com/${handle}/`;
  const fetched_at = new Date().toISOString();

  let html: string;
  let response: Response;
  try {
    response = await fetch(profileUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; AgentlyBot/1.0; +https://agently.in)",
        Accept: "text/html,application/xhtml+xml",
        "Accept-Language": "en-US,en;q=0.9"
      },
      signal: AbortSignal.timeout(SCRAPE_TIMEOUT_MS),
      redirect: "follow"
    });
  } catch (err) {
    const isAbort = err instanceof Error && err.name === "TimeoutError";
    return { ok: false, handle, reason: isAbort ? "timeout" : "fetch_error", fetched_at };
  }

  if (response.status === 404) return { ok: false, handle, reason: "not_found", http_status: 404, fetched_at };
  if (response.status === 429) return { ok: false, handle, reason: "rate_limited", http_status: 429, fetched_at };
  if (!response.ok) return { ok: false, handle, reason: "fetch_error", http_status: response.status, fetched_at };

  try {
    html = await response.text();
  } catch {
    return { ok: false, handle, reason: "fetch_error", fetched_at };
  }

  const description = extractMeta(html, "og:description");
  if (!description) {
    return { ok: false, handle, reason: "no_meta_data", fetched_at };
  }

  // Private accounts return a generic description without follower counts
  if (/this account is private/i.test(description)) {
    return { ok: false, handle, reason: "private_profile", fetched_at };
  }

  const stats = parseStatsFromDescription(description);
  if (!stats || stats.followers === null) {
    return { ok: false, handle, reason: "parse_failed", fetched_at };
  }

  const titleMeta = extractMeta(html, "og:title");
  const displayName = titleMeta ? cleanDisplayName(titleMeta) : null;

  return {
    ok: true,
    handle,
    display_name: displayName,
    followers: stats.followers,
    following: stats.following,
    posts: stats.posts,
    profile_url: profileUrl,
    fetched_at,
    raw_description: description
  };
}

/**
 * Accept any of: "@handle", "handle", "instagram.com/handle",
 * "https://www.instagram.com/handle/?hl=en", returns clean lowercase handle
 * or null if unparseable.
 */
export function normalizeHandle(input: string): string | null {
  let raw = String(input ?? "").trim();
  if (!raw) return null;
  raw = raw.replace(/^@/, "");

  // If it looks like a URL, parse and pull the first path segment
  if (/^https?:\/\//i.test(raw) || /instagram\.com/i.test(raw)) {
    const withScheme = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
    try {
      const url = new URL(withScheme);
      const seg = url.pathname.split("/").filter(Boolean)[0];
      if (seg) raw = seg;
    } catch {
      return null;
    }
  }

  // Instagram handles: 1-30 chars, letters/numbers/period/underscore
  raw = raw.toLowerCase();
  if (!/^[a-z0-9._]{1,30}$/.test(raw)) return null;
  return raw;
}

function extractMeta(html: string, property: string): string | null {
  // Match either <meta property="..." content="..."> or <meta name="..." content="...">
  // with attributes in any order.
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
  // og:title looks like: "Display Name (@handle) • Instagram photos and videos"
  // strip the @handle part and the trailing platform suffix
  return ogTitle
    .replace(/\s*\(@[^)]+\)/, "")
    .replace(/\s*[•·\-–—]\s*Instagram.*$/i, "")
    .trim();
}

function parseStatsFromDescription(description: string) {
  // Examples Instagram returns:
  //   "1.2M Followers, 234 Following, 567 Posts - See Instagram photos..."
  //   "12,345 Followers, 234 Following, 567 Posts"
  //   "1,234,567 Followers, 234 Following, 567 Posts"
  //   "1.2K Followers, 234 Following, 567 Posts"
  // Some non-English locales may format differently. We accept either
  // "Followers" or the localized variant if present.
  const followerMatch = description.match(/([\d,.]+\s*[kKmMbB]?)\s+(?:Followers?|followers?)\b/);
  const followingMatch = description.match(/([\d,.]+\s*[kKmMbB]?)\s+(?:Following|following)\b/);
  const postsMatch = description.match(/([\d,.]+\s*[kKmMbB]?)\s+(?:Posts?|posts?)\b/);
  if (!followerMatch) return null;

  return {
    followers: parseAbbreviatedNumber(followerMatch[1]),
    following: followingMatch ? parseAbbreviatedNumber(followingMatch[1]) : null,
    posts: postsMatch ? parseAbbreviatedNumber(postsMatch[1]) : null
  };
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

/**
 * Sanity-check whether scraped numbers are plausible vs what the user
 * self-reported. Used to decide whether to trust the scrape or flag a
 * mismatch for admin review.
 *
 * Returns a delta object the caller can act on:
 *   - within_tolerance: scrape is within 20% of self-reported -> trust it
 *   - significant_difference: outside tolerance -> flag for review
 *   - no_self_report: no self-reported number to compare -> trust scrape
 *
 * Tolerance accounts for: rounding (1.2M can be 1.15M-1.25M), normal
 * follower fluctuation between updates, and minor scraper imprecision.
 */
export function classifyScrapeAgainstSelfReport(scraped: number, selfReported?: number | null) {
  if (!selfReported || selfReported <= 0) {
    return { verdict: "no_self_report" as const, delta_pct: 0 };
  }
  const delta = Math.abs(scraped - selfReported) / selfReported;
  return delta <= 0.20
    ? { verdict: "within_tolerance" as const, delta_pct: Number((delta * 100).toFixed(1)) }
    : { verdict: "significant_difference" as const, delta_pct: Number((delta * 100).toFixed(1)) };
}
