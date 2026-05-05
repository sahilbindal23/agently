export type SocialTrustTone = "green" | "blue" | "amber" | "neutral";

export function socialTrustFromSource(source?: string | null) {
  const value = String(source ?? "");
  if (value.includes("youtube_analytics")) {
    return { label: "Verified via YouTube Analytics", tone: "green" as const, trusted: true };
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
