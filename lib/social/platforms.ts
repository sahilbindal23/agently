export type SocialProvider = "instagram" | "facebook" | "youtube" | "twitter";

export const socialProviders: Array<{
  id: SocialProvider;
  label: string;
  platformLabel: string;
  requiredScopes: string[];
  usefulMetrics: string[];
}> = [
  {
    id: "instagram",
    label: "Instagram",
    platformLabel: "Instagram professional account",
    requiredScopes: ["instagram_basic", "instagram_manage_insights"],
    usefulMetrics: ["followers", "reach", "impressions", "engagement", "top cities"]
  },
  {
    id: "youtube",
    label: "YouTube",
    platformLabel: "YouTube channel",
    requiredScopes: ["youtube.readonly", "yt-analytics.readonly"],
    usefulMetrics: ["views", "subscribers", "likes", "comments", "country reports"]
  },
  {
    id: "twitter",
    label: "Twitter / X",
    platformLabel: "Twitter / X account",
    requiredScopes: ["users.read", "tweet.read"],
    usefulMetrics: ["followers", "following", "tweet count"]
  },
  {
    id: "facebook",
    label: "Facebook",
    platformLabel: "Facebook page",
    requiredScopes: ["pages_read_engagement", "read_insights"],
    usefulMetrics: ["page followers", "reach", "engagement", "audience geography"]
  }
];

export function providerLabel(provider: string) {
  return socialProviders.find((item) => item.id === provider)?.label ?? provider;
}
