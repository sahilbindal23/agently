export type SocialTrustTone = "green" | "blue" | "amber" | "neutral";

export function socialTrustFromSource(source?: string | null) {
  const value = String(source ?? "");
  if (value.includes("youtube_analytics")) {
    return { label: "Verified via YouTube Analytics", tone: "green" as const, trusted: true };
  }
  if (value === "youtube_public_api") {
    // Pulled from YouTube Data API with our server API key. Authoritative
    // for subscriber/view counts but lacks audience demographics.
    return { label: "Verified via YouTube API", tone: "blue" as const, trusted: true };
  }
  if (value === "youtube_public_unconfirmed") {
    // Self-reported number disagreed with YouTube API - flagged for review
    return { label: "Self-report doesn't match YouTube channel", tone: "amber" as const, trusted: false };
  }
  if (value.includes("instagram_graph")) {
    return { label: "Verified via Instagram API", tone: "green" as const, trusted: true };
  }
  if (value.includes("facebook_graph")) {
    return { label: "Verified via Facebook API", tone: "green" as const, trusted: true };
  }
  if (value === "mock_api") {
    return { label: "Prototype demo metrics", tone: "blue" as const, trusted: true };
  }
  if (value === "public_scrape") {
    // Public scrape matched (or we had no self-report to compare to). Trust
    // is between OAuth-grade and self-reported - we know the number is real
    // from a real Instagram page, but Instagram could have changed their
    // HTML or the scrape could be stale.
    return { label: "Verified from public Instagram profile", tone: "blue" as const, trusted: true };
  }
  if (value === "public_scrape_unconfirmed") {
    // Scraped number significantly disagreed with what the user self-reported.
    // Don't count this as trusted - flag for review.
    return { label: "Self-report doesn't match Instagram profile", tone: "amber" as const, trusted: false };
  }
  if (value.includes("self_reported")) {
    return { label: "Pending metric review", tone: "amber" as const, trusted: false };
  }
  if (value.includes("no_creator")) {
    return { label: "No creator data yet", tone: "amber" as const, trusted: false };
  }
  if (value.includes("permission")) {
    return { label: "Permission needed", tone: "amber" as const, trusted: false };
  }
  if (value.includes("setup_required")) {
    return { label: "Setup required", tone: "amber" as const, trusted: false };
  }
  if (value && value !== "self_reported") {
    return { label: "Platform metrics", tone: "green" as const, trusted: true };
  }
  return { label: "Self-reported metrics", tone: "neutral" as const, trusted: false };
}

export function isTrustedMetricSource(source?: string | null) {
  return socialTrustFromSource(source).trusted;
}
