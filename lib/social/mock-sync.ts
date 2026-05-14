import type { SocialProvider } from "@/lib/social/platforms";

export type MockSyncInput = {
  provider: SocialProvider;
  handle: string;
  creator: Record<string, unknown>;
  platform?: Record<string, unknown>;
};

export function buildMockSocialSnapshot({ provider, handle, creator, platform }: MockSyncInput) {
  const seed = seededNumber(`${provider}:${handle}:${creator.id ?? ""}`);
  const platformFollowers = Number(platform?.followers ?? 0);
  const platformAvgViews = Number(platform?.avg_views ?? 0);
  const platformEngagement = Number(platform?.engagement_rate ?? 0);
  const hasProfileMetrics = platformFollowers > 0 || platformAvgViews > 0 || platformEngagement > 0;
  const niche = String(creator.primary_niche ?? "creator");
  const city = String(creator.home_city ?? "Bengaluru");

  const followers = hasProfileMetrics ? platformFollowers : 0;
  const avgViews = hasProfileMetrics ? platformAvgViews || Math.round(followers * (provider === "youtube" ? 0.28 : 0.18)) : 0;
  const engagement = hasProfileMetrics ? platformEngagement || Number((2.4 + seed * 4.8).toFixed(2)) : 0;
  const indiaAudience = hasProfileMetrics
    ? Math.min(96, Math.max(42, Number(creator.india_audience_percent ?? 0) || Math.round(58 + seed * 32)))
    : 0;
  const bangaloreAudience = hasProfileMetrics ? Math.min(68, Math.max(12, Math.round(indiaAudience * (0.18 + seed * 0.32)))) : 0;
  const reach = Math.round(avgViews * (provider === "instagram" ? 1.35 : provider === "facebook" ? 1.12 : 1.05));

  return {
    followers,
    avg_views_30d: avgViews,
    reach_30d: reach,
    impressions_30d: Math.round(reach * (1.08 + seed * 0.45)),
    engagement_rate_30d: engagement,
    india_audience_percent: indiaAudience,
    bangalore_audience_percent: bangaloreAudience,
    top_cities: topCities(city, seed),
    audience_age_range: String(creator.audience_age_range ?? "") || (seed > 0.5 ? "18-34" : "21-34"),
    content_category_signals: contentSignals(niche),
    raw_metrics: {
      mock: true,
      provider,
      handle,
      note: hasProfileMetrics
        ? "Sync used platform metrics already entered on this creator profile."
        : "Connection succeeded, but no profile metrics were available. Add platform metrics or use OAuth for verified data."
    },
    source: hasProfileMetrics ? "mock_api" : "manual_connect_no_metrics"
  };
}

function seededNumber(input: string) {
  let hash = 0;
  for (let index = 0; index < input.length; index += 1) {
    hash = (hash * 31 + input.charCodeAt(index)) % 100000;
  }
  return hash / 100000;
}

function topCities(homeCity: string, seed: number) {
  const normalized = homeCity || "Bengaluru";
  const metros = ["Bengaluru", "Mumbai", "Delhi NCR", "Hyderabad", "Chennai", "Pune"];
  const rotated = metros.slice(Math.floor(seed * metros.length)).concat(metros.slice(0, Math.floor(seed * metros.length)));
  return Array.from(new Set([normalized, ...rotated])).slice(0, 4);
}

function contentSignals(niche: string) {
  const value = niche.toLowerCase();
  if (value.includes("fashion") || value.includes("beauty")) return ["fashion", "beauty", "lifestyle", "commerce"];
  if (value.includes("gaming") || value.includes("tech")) return ["gaming", "tech", "community", "reviews"];
  if (value.includes("food")) return ["food", "local discovery", "restaurants", "short-form"];
  if (value.includes("fitness")) return ["fitness", "wellness", "habit", "transformation"];
  return [niche, "creator-led storytelling", "brand integration"];
}
