// 'twitter' is kept in the union type so lib/social/twitter-public.ts and
// /api/social/scrape-twitter compile, but Twitter is intentionally absent
// from `socialProviders` so it doesn't show up in the UI dropdown. To
// re-enable, uncomment the twitter entry in the array below.
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
    id: "facebook",
    label: "Facebook",
    platformLabel: "Facebook page",
    requiredScopes: ["pages_read_engagement", "read_insights"],
    usefulMetrics: ["page followers", "reach", "engagement", "audience geography"]
  }
  // Twitter intentionally omitted - re-enable once Basic API tier is provisioned:
  // { id: "twitter", label: "Twitter / X", platformLabel: "Twitter / X account",
  //   requiredScopes: ["users.read", "tweet.read"],
  //   usefulMetrics: ["followers", "following", "tweet count"] }
];

export function providerLabel(provider: string) {
  return socialProviders.find((item) => item.id === provider)?.label ?? provider;
}
