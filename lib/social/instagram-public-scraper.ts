// Public Instagram profile scraper. No OAuth required.
//
// NOTE: Phyllo is *not* called from here anymore. Phyllo's Connect SDK is
// creator-authorized (the creator clicks a button and logs into IG inside
// Phyllo's modal); their handle-only lookup is a separate enterprise product.
// So the manual-entry path stays as a DIY HTML scraper; the rich data path
// is the Phyllo Connect button on the Connected Accounts panel.
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
    | "login_wall"
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

  // Note: Phyllo's handle-only lookup is enterprise-only. Real Phyllo data
  // arrives via the Connect SDK (creator-authorized) and is written to
  // connected_social_accounts + creator_platforms via /api/social/phyllo/
  // sync-account. The DIY HTML scraping below is the fallback for manual
  // handle entries.

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

  // Login-wall detection - Instagram redirects/serves a login page in some
  // cases. Body contains "loginForm" / "Log in" prominently when this happens.
  if (/<title>Login • Instagram<\/title>/i.test(html) || /"requireLogin":true/.test(html)) {
    return { ok: false, handle, reason: "login_wall", fetched_at };
  }

  // Try multiple extraction strategies in order of preference
  const strategies: Array<{ name: string; run: () => InstagramPublicMetrics | null }> = [
    { name: "og_description", run: () => parseFromMetaDescription(html, handle, profileUrl, fetched_at) },
    { name: "twitter_card",   run: () => parseFromTwitterCard(html, handle, profileUrl, fetched_at) },
    { name: "json_ld",        run: () => parseFromJsonLd(html, handle, profileUrl, fetched_at) },
    { name: "shared_data",    run: () => parseFromSharedData(html, handle, profileUrl, fetched_at) }
  ];

  for (const strategy of strategies) {
    const result = strategy.run();
    if (result) {
      return { ...result, raw_description: result.raw_description || `(parsed via ${strategy.name})` };
    }
  }

  // Private accounts return a generic description without follower counts
  const description = extractMeta(html, "og:description") ?? "";
  if (/this account is private/i.test(description)) {
    return { ok: false, handle, reason: "private_profile", fetched_at };
  }

  // No strategy worked; could not extract follower data
  return { ok: false, handle, reason: "parse_failed", fetched_at };
}

// ----- parsing strategies -----

function parseFromMetaDescription(html: string, handle: string, profileUrl: string, fetched_at: string): InstagramPublicMetrics | null {
  const description = extractMeta(html, "og:description");
  if (!description) return null;
  const stats = parseStatsFromDescription(description);
  if (!stats || stats.followers === null) return null;
  const titleMeta = extractMeta(html, "og:title");
  return {
    ok: true,
    handle,
    display_name: titleMeta ? cleanDisplayName(titleMeta) : null,
    followers: stats.followers,
    following: stats.following,
    posts: stats.posts,
    profile_url: profileUrl,
    fetched_at,
    raw_description: description
  };
}

function parseFromTwitterCard(html: string, handle: string, profileUrl: string, fetched_at: string): InstagramPublicMetrics | null {
  // Twitter Card meta tags often duplicate og: data and survive when og: is dropped
  const description = extractMeta(html, "twitter:description") ?? extractMeta(html, "twitter:title");
  if (!description) return null;
  const stats = parseStatsFromDescription(description);
  if (!stats || stats.followers === null) return null;
  return {
    ok: true,
    handle,
    display_name: extractMeta(html, "twitter:title") ? cleanDisplayName(extractMeta(html, "twitter:title")!) : null,
    followers: stats.followers,
    following: stats.following,
    posts: stats.posts,
    profile_url: profileUrl,
    fetched_at,
    raw_description: description
  };
}

function parseFromJsonLd(html: string, handle: string, profileUrl: string, fetched_at: string): InstagramPublicMetrics | null {
  // Look for <script type="application/ld+json"> blocks. Instagram has used
  // a Person schema with `mainEntityofPage` and sometimes `interactionStatistic`.
  const blocks = html.match(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi) ?? [];
  for (const block of blocks) {
    const inner = block.replace(/^<script[^>]*>/i, "").replace(/<\/script>$/i, "").trim();
    try {
      const data: unknown = JSON.parse(inner);
      const obj = Array.isArray(data) ? data[0] : data;
      if (!obj || typeof obj !== "object") continue;
      const o = obj as Record<string, unknown>;

      // Some IG JSON-LD blocks include text like the og:description in a `description` field
      const desc = typeof o.description === "string" ? o.description : "";
      if (desc) {
        const stats = parseStatsFromDescription(desc);
        if (stats && stats.followers !== null) {
          const name = typeof o.name === "string" ? o.name : null;
          return {
            ok: true,
            handle,
            display_name: name,
            followers: stats.followers,
            following: stats.following,
            posts: stats.posts,
            profile_url: profileUrl,
            fetched_at,
            raw_description: desc
          };
        }
      }
    } catch {
      continue;
    }
  }
  return null;
}

function parseFromSharedData(html: string, handle: string, profileUrl: string, fetched_at: string): InstagramPublicMetrics | null {
  // Older IG pages embedded a `window._sharedData = {...}` object. Some
  // server-rendered surfaces still have it. Look for user.edge_followed_by.count.
  const match = html.match(/"edge_followed_by"\s*:\s*\{\s*"count"\s*:\s*(\d+)/);
  const followingMatch = html.match(/"edge_follow"\s*:\s*\{\s*"count"\s*:\s*(\d+)/);
  const postsMatch = html.match(/"edge_owner_to_timeline_media"\s*:\s*\{\s*"count"\s*:\s*(\d+)/);
  const fullNameMatch = html.match(/"full_name"\s*:\s*"([^"]+)"/);
  if (!match) return null;
  return {
    ok: true,
    handle,
    display_name: fullNameMatch ? fullNameMatch[1] : null,
    followers: Number(match[1]),
    following: followingMatch ? Number(followingMatch[1]) : null,
    posts: postsMatch ? Number(postsMatch[1]) : null,
    profile_url: profileUrl,
    fetched_at,
    raw_description: ""
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
