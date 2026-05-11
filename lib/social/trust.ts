export type SocialTrustTone = "green" | "blue" | "amber" | "neutral";

/**
 * Map a metric_source string to a simple trust signal:
 *   - `label`: short, user-facing. "Instagram verified" / "YouTube verified" /
 *     "Facebook verified" when the source is authoritative. Empty string
 *     when not - the badge component renders nothing in that case.
 *   - `trusted`: drives engine scoring. True for OAuth + matched-public-API
 *     sources, false for self-report, mismatched, pending, etc.
 *
 * The "trusted" boolean is the load-bearing signal for the recommendation
 * engine and rate-blender. Don't widen what counts as trusted without
 * also reviewing how those weights flow downstream.
 */
export function socialTrustFromSource(source?: string | null) {
  const value = String(source ?? "");

  if (value === "phyllo_instagram") {
    return { label: "Instagram verified", tone: "green" as const, trusted: true };
  }
  if (value === "phyllo_youtube") {
    return { label: "YouTube verified", tone: "green" as const, trusted: true };
  }
  if (value === "phyllo_facebook") {
    return { label: "Facebook verified", tone: "green" as const, trusted: true };
  }
  if (value === "phyllo_twitter") {
    return { label: "Twitter verified", tone: "green" as const, trusted: true };
  }

  // ----- YouTube -----
  if (value.includes("youtube_analytics")) {
    return { label: "YouTube verified", tone: "green" as const, trusted: true };
  }
  if (value === "youtube_public_api") {
    return { label: "YouTube verified", tone: "green" as const, trusted: true };
  }

  // ----- Instagram -----
  if (value.includes("instagram_graph")) {
    return { label: "Instagram verified", tone: "green" as const, trusted: true };
  }
  if (value === "public_scrape") {
    return { label: "Instagram verified", tone: "green" as const, trusted: true };
  }

  // ----- Twitter / X -----
  if (value === "twitter_public_api") {
    return { label: "Twitter verified", tone: "green" as const, trusted: true };
  }

  // ----- Facebook -----
  if (value.includes("facebook_graph")) {
    return { label: "Facebook verified", tone: "green" as const, trusted: true };
  }
  if (value === "facebook_public_scrape") {
    return { label: "Facebook verified", tone: "green" as const, trusted: true };
  }

  // ----- Demo / mock data (only in non-prod) -----
  if (value === "mock_api") {
    return { label: "", tone: "neutral" as const, trusted: true };
  }

  // ----- Untrusted sources: no badge shown -----
  // Includes: youtube_public_unconfirmed, public_scrape_unconfirmed,
  // self_reported, no_creator, permission_*, setup_required, empty, anything else.
  return { label: "", tone: "neutral" as const, trusted: false };
}

export function isTrustedMetricSource(source?: string | null) {
  return socialTrustFromSource(source).trusted;
}
