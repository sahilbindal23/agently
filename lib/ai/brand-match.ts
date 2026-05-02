import type { Brand, Creator, CreatorPlatform } from "@/types";
import { getBangaloreFit, getCreatorLanguages, getIndiaAudiencePercent } from "@/lib/utils/creator-metrics";

export type BrandMatchInput = {
  direction?: "brand_to_creators";
  brand_name: string;
  brand_category: string;
  campaign_goal: string;
  target_audience: string;
  target_platform?: string;
  min_followers?: number;
  max_followers?: number;
  preferred_regions?: string;
  preferred_languages?: string;
  launch_city?: string;
  creator_style?: string;
  bridge_audience?: string;
};

export type CreatorBrandMatchInput = {
  direction: "creator_to_brands";
  creator_id?: string;
  creator_name?: string;
  creator_niche?: string;
  platforms?: string;
  audience_description?: string;
  desired_brand_categories?: string;
  excluded_categories?: string;
  campaign_goal?: string;
  minimum_deal_value_inr?: number;
  preferred_regions?: string;
  preferred_languages?: string;
};

export type CreatorMatch = {
  creator_id: string;
  creator_name: string;
  primary_platform: string;
  fit_score: number;
  match_type: "direct_category_fit" | "bridge_audience_fit" | "audience_scale_fit" | "experimental_fit";
  match_reason: string;
  audience_reason: string;
  outreach_angle: string;
  suggested_intro: string;
  watchouts: string[];
};

export type BrandRecommendation = {
  brand_id: string;
  brand_name: string;
  industry: string;
  fit_score: number;
  match_type: "ideal_sponsor_fit" | "stretch_sponsor_fit" | "local_activation_fit" | "poor_fit";
  match_reason: string;
  creator_value_prop: string;
  outreach_angle: string;
  suggested_intro: string;
  likely_objections: string[];
  deal_realism: string;
};

const categoryMap: Record<string, string[]> = {
  fashion: ["fashion", "style", "beauty", "lifestyle", "thrift", "apparel", "streetwear"],
  beauty: ["beauty", "skincare", "makeup", "fashion", "lifestyle"],
  gaming: ["gaming", "hardware", "twitch", "stream", "esports", "desk", "tech"],
  gamer: ["gaming", "hardware", "twitch", "stream", "esports", "desk", "tech"],
  gamers: ["gaming", "hardware", "twitch", "stream", "esports", "desk", "tech"],
  tech: ["tech", "gaming", "hardware", "productivity", "creator tools", "gadgets"],
  fitness: ["fitness", "wellness", "health", "nutrition", "recovery", "workout"],
  food: ["food", "cooking", "restaurant", "snack", "beverage"],
  finance: ["finance", "business", "investing", "career", "education"],
  education: ["education", "career", "productivity", "business", "study"]
};

export function matchCreatorsForBrand(
  input: BrandMatchInput,
  creators: Creator[],
  platforms: CreatorPlatform[]
) {
  const matches = creators
    .map((creator) => scoreCreator(input, creator, platforms.filter((platform) => platform.creator_id === creator.id)))
    .sort((a, b) => b.fit_score - a.fit_score)
    .slice(0, 8);

  return {
    market_focus: "India-first creator-brand matching with support for direct category fit and cross-audience bridge campaigns.",
    matches
  };
}

export function matchBrandsForCreator(
  input: CreatorBrandMatchInput,
  creators: Creator[],
  platforms: CreatorPlatform[],
  brands: Brand[]
) {
  const selectedCreator = input.creator_id ? creators.find((creator) => creator.id === input.creator_id) : undefined;
  const creatorProfile = selectedCreator ?? {
    id: "custom_creator",
    display_name: input.creator_name || "Creator",
    primary_niche: input.creator_niche || "",
    bio: input.audience_description || "",
    country: "IN",
    us_audience_percent: 0,
    india_audience_percent: 70,
    home_city: "Bengaluru",
    languages: splitList(input.preferred_languages || "English, Hindi"),
    top_indian_cities: splitList(input.preferred_regions || "Bengaluru"),
    audience_age_range: "",
    content_style: input.audience_description || "",
    prior_sponsor_categories: splitList(input.desired_brand_categories || ""),
    monetization_score: 70,
    valuation_score: 70
  } satisfies Creator;
  const creatorPlatforms = selectedCreator ? platforms.filter((platform) => platform.creator_id === selectedCreator.id) : [];

  const matches = brands
    .map((brand) => scoreBrandForCreator(input, creatorProfile, creatorPlatforms, brand))
    .sort((a, b) => b.fit_score - a.fit_score)
    .slice(0, 8);

  return {
    market_focus: "Creator-to-brand recommendations for Bangalore and India-first sponsor outreach.",
    matches
  };
}

function scoreCreator(input: BrandMatchInput, creator: Creator, platforms: CreatorPlatform[]): CreatorMatch {
  const primary = choosePrimaryPlatform(input.target_platform, platforms);
  const creatorText = `${creator.primary_niche} ${creator.bio} ${primary.platform} ${primary.handle}`.toLowerCase();
  const localText = `${creator.country} ${creator.home_city} ${creator.languages.join(" ")} ${creator.top_indian_cities.join(" ")} ${creator.content_style} ${creator.prior_sponsor_categories.join(" ")}`.toLowerCase();
  const campaignText = `${input.campaign_goal} ${input.target_audience} ${input.preferred_regions} ${input.launch_city}`.toLowerCase();
  const brandCategory = input.brand_category.toLowerCase();
  const bridgeAudience = String(input.bridge_audience ?? "").toLowerCase();
  const audience = input.target_audience.toLowerCase();
  const indiaAudience = getIndiaAudiencePercent(creator);
  const bangaloreFit = getBangaloreFit(creator);

  let score = 42;
  const watchouts: string[] = [];

  const categoryKeywords = keywordsFor(brandCategory);
  const directHits = categoryKeywords.filter((keyword) => creatorText.includes(keyword)).length;
  score += Math.min(26, directHits * 9);

  const bridgeKeywords = keywordsFor(bridgeAudience || audience);
  const bridgeHits = bridgeKeywords.filter((keyword) => creatorText.includes(keyword)).length;
  if (bridgeAudience && bridgeHits > 0) score += Math.min(22, bridgeHits * 8);

  const desiredPlatform = String(input.target_platform ?? "").toLowerCase();
  if (desiredPlatform && primary.platform.toLowerCase().includes(desiredPlatform)) score += 12;
  if (desiredPlatform && !primary.platform.toLowerCase().includes(desiredPlatform)) watchouts.push(`Primary platform is ${primary.platform}, not ${input.target_platform}.`);

  const minFollowers = Number(input.min_followers ?? 0);
  const maxFollowers = Number(input.max_followers ?? 0);
  if (minFollowers && primary.followers >= minFollowers) score += 8;
  if (minFollowers && primary.followers < minFollowers) {
    score -= 12;
    watchouts.push(`Follower count is below the requested minimum of ${minFollowers.toLocaleString("en-IN")}.`);
  }
  if (maxFollowers && primary.followers > maxFollowers) {
    score -= 5;
    watchouts.push("Creator may be above the preferred size band, so pricing could be higher.");
  }

  if (indiaAudience >= 70) score += 14;
  else if (indiaAudience >= 45) score += 9;
  else if (campaignText.includes("india") || audience.includes("india")) score += 3;

  if (campaignText.includes("bangalore") || campaignText.includes("bengaluru")) {
    score += Math.round(bangaloreFit / 8);
    if (bangaloreFit < 55) watchouts.push("Bangalore relevance is not strongly validated yet.");
  }

  const preferredRegions = String(input.preferred_regions ?? "").toLowerCase();
  if (preferredRegions && preferredRegions.split(",").some((region) => localText.includes(region.trim()))) score += 8;
  else if (preferredRegions) watchouts.push("Preferred Indian city overlap needs validation.");

  const preferredLanguages = String(input.preferred_languages ?? "").toLowerCase();
  if (preferredLanguages && preferredLanguages.split(",").some((language) => localText.includes(language.trim()))) score += 6;
  else if (preferredLanguages) watchouts.push("Language fit is not yet confirmed.");

  if (creator.monetization_score >= 80) score += 7;
  if (creator.valuation_score >= 85) score += 5;
  if (primary.engagement_rate >= 4) score += 5;
  if (primary.avg_views > 100000) score += 5;

  const fitScore = Math.max(5, Math.min(98, Math.round(score)));
  const matchType = getMatchType(directHits, bridgeHits, bridgeAudience, fitScore);
  const categoryLabel = input.brand_category || "the brand category";
  const launchCity = input.launch_city || input.preferred_regions || "Bengaluru and India";
  const region = ` in ${launchCity}`;
  const language = input.preferred_languages ? ` using ${input.preferred_languages}` : "";

  return {
    creator_id: creator.id,
    creator_name: creator.display_name,
    primary_platform: primary.platform,
    fit_score: fitScore,
    match_type: matchType,
    match_reason: buildMatchReason(matchType, creator, categoryLabel, bridgeAudience),
    audience_reason: `${primary.followers.toLocaleString("en-IN")} followers, ${primary.avg_views.toLocaleString("en-IN")} average views, ${primary.engagement_rate}% engagement, ${indiaAudience}% India audience, ${bangaloreFit}/100 Bangalore fit, and languages: ${getCreatorLanguages(creator)}.`,
    outreach_angle: `Pitch ${creator.display_name} as a ${matchType === "bridge_audience_fit" ? `cross-audience bridge into ${bridgeAudience}` : "trusted category voice"} for ${categoryLabel}${region}${language}.`,
    suggested_intro: `${creator.display_name} could help ${input.brand_name || "your brand"} reach ${input.target_audience || "the target audience"} through ${primary.platform} content that ties ${categoryLabel} to ${input.campaign_goal || "the campaign goal"}.`,
    watchouts: watchouts.length ? watchouts : ["Confirm city, language split, audience age, and recent brand conflicts before outreach."]
  };
}

function scoreBrandForCreator(
  input: CreatorBrandMatchInput,
  creator: Creator,
  platforms: CreatorPlatform[],
  brand: Brand
): BrandRecommendation {
  const primary = choosePrimaryPlatform(undefined, platforms);
  const creatorText = `${creator.primary_niche} ${creator.bio} ${creator.content_style} ${creator.prior_sponsor_categories.join(" ")} ${input.audience_description}`.toLowerCase();
  const brandText = `${brand.name} ${brand.industry} ${brand.status}`.toLowerCase();
  const desiredText = `${input.desired_brand_categories} ${input.campaign_goal}`.toLowerCase();
  const excludedText = String(input.excluded_categories ?? "").toLowerCase();
  const indiaAudience = getIndiaAudiencePercent(creator);
  const bangaloreFit = getBangaloreFit(creator);
  const likelyObjections: string[] = [];

  let score = 38;
  const creatorKeywords = keywordsFor(creatorText);
  const desiredKeywords = keywordsFor(desiredText);
  const brandKeywords = keywordsFor(brandText);

  const categoryOverlap = brandKeywords.filter((keyword) => creatorKeywords.includes(keyword) || desiredKeywords.includes(keyword)).length;
  score += Math.min(26, categoryOverlap * 8);

  const excludedKeywords = keywordsFor(excludedText);
  if (excludedKeywords.length && brandKeywords.some((keyword) => excludedKeywords.includes(keyword))) {
    score -= 35;
    likelyObjections.push("Creator excluded this sponsor category.");
  }

  if (indiaAudience >= 70) score += 12;
  else if (indiaAudience >= 45) score += 7;
  else likelyObjections.push("India audience share needs strengthening for India-first brands.");

  if (bangaloreFit >= 80) score += 12;
  else if (bangaloreFit >= 50) score += 6;
  else likelyObjections.push("Bangalore relevance is not strongly proven yet.");

  if (primary.followers >= 50000) score += 6;
  else likelyObjections.push("Audience size may be too small for larger brand budgets.");

  if (primary.engagement_rate >= 4) score += 6;
  if (brand.status === "active" || brand.status === "target" || brand.status === "inbound") score += 4;

  const minimumDealValue = Number(input.minimum_deal_value_inr ?? 0);
  const estimatedCapacity = Math.max(primary.avg_views * 0.8, primary.followers * 0.015);
  if (minimumDealValue && estimatedCapacity < minimumDealValue) {
    score -= 8;
    likelyObjections.push("Requested minimum deal value may be above the current audience-based estimate.");
  }

  const fitScore = Math.max(5, Math.min(98, Math.round(score)));
  const matchType = getBrandMatchType(fitScore, categoryOverlap, bangaloreFit);
  const valueProp = buildCreatorValueProp(creator, primary, brand, indiaAudience, bangaloreFit);

  return {
    brand_id: brand.id,
    brand_name: brand.name,
    industry: brand.industry,
    fit_score: fitScore,
    match_type: matchType,
    match_reason: buildBrandReason(matchType, creator, brand),
    creator_value_prop: valueProp,
    outreach_angle: `Pitch ${brand.name} on a ${creator.home_city || "Bengaluru"}-first creator activation that connects ${brand.industry} to ${creator.primary_niche} through measurable deliverables.`,
    suggested_intro: `${creator.display_name} can help ${brand.name} reach ${creator.primary_niche || "a focused creator audience"} across ${primary.platform} with a Bangalore/India-first campaign built around ${input.campaign_goal || "brand awareness and trust"}.`,
    likely_objections: likelyObjections.length ? likelyObjections : ["Validate current campaign budget, category conflicts, and whether the brand is actively testing creator-led acquisition."],
    deal_realism: fitScore >= 80 ? "High: pursue with a specific package and rate anchor." : fitScore >= 60 ? "Medium: test with a smaller pilot or performance-linked package." : "Low: keep as a long-shot or only pitch with a very specific angle."
  };
}

function choosePrimaryPlatform(targetPlatform: string | undefined, platforms: CreatorPlatform[]) {
  if (platforms.length === 0) {
    return { platform: "Unknown", followers: 0, avg_views: 0, engagement_rate: 0 } as CreatorPlatform;
  }

  const requested = String(targetPlatform ?? "").toLowerCase();
  return (
    platforms.find((platform) => requested && platform.platform.toLowerCase().includes(requested)) ??
    [...platforms].sort((a, b) => b.avg_views - a.avg_views)[0]
  );
}

function keywordsFor(value: string) {
  const tokens = value
    .split(/[^a-z0-9]+/i)
    .map((token) => token.toLowerCase())
    .filter(Boolean);

  const mapped = tokens.flatMap((token) => categoryMap[token] ?? [token]);
  return Array.from(new Set(mapped));
}

function splitList(value: string) {
  return value.split(",").map((item) => item.trim()).filter(Boolean);
}

function getMatchType(directHits: number, bridgeHits: number, bridgeAudience: string, score: number): CreatorMatch["match_type"] {
  if (directHits > 0) return "direct_category_fit";
  if (bridgeAudience && bridgeHits > 0) return "bridge_audience_fit";
  if (score >= 65) return "audience_scale_fit";
  return "experimental_fit";
}

function buildMatchReason(matchType: CreatorMatch["match_type"], creator: Creator, categoryLabel: string, bridgeAudience: string) {
  if (matchType === "direct_category_fit") {
    return `${creator.display_name}'s ${creator.primary_niche} positioning maps directly to ${categoryLabel}.`;
  }
  if (matchType === "bridge_audience_fit") {
    return `${creator.display_name} can bridge ${categoryLabel} into ${bridgeAudience} through audience context rather than obvious category matching.`;
  }
  if (matchType === "audience_scale_fit") {
    return `${creator.display_name} has useful audience scale for a test campaign, even though the category fit needs validation.`;
  }
  return `${creator.display_name} is an experimental match; use a small test brief and validate audience data before committing budget.`;
}

function getBrandMatchType(score: number, categoryOverlap: number, bangaloreFit: number): BrandRecommendation["match_type"] {
  if (score >= 78 && categoryOverlap > 0) return "ideal_sponsor_fit";
  if (score >= 68 && bangaloreFit >= 70) return "local_activation_fit";
  if (score >= 55) return "stretch_sponsor_fit";
  return "poor_fit";
}

function buildCreatorValueProp(creator: Creator, primary: CreatorPlatform, brand: Brand, indiaAudience: number, bangaloreFit: number) {
  return `${creator.display_name} gives ${brand.name} access to a ${creator.primary_niche} audience through ${primary.platform}, ${primary.followers.toLocaleString("en-IN")} followers, ${primary.avg_views.toLocaleString("en-IN")} average views, ${indiaAudience}% India audience, and ${bangaloreFit}/100 Bangalore fit.`;
}

function buildBrandReason(matchType: BrandRecommendation["match_type"], creator: Creator, brand: Brand) {
  if (matchType === "ideal_sponsor_fit") {
    return `${brand.name} is a strong fit for ${creator.display_name}'s category, audience, and India-first positioning.`;
  }
  if (matchType === "local_activation_fit") {
    return `${brand.name} is useful for a Bangalore-first activation even if the category fit needs sharper packaging.`;
  }
  if (matchType === "stretch_sponsor_fit") {
    return `${brand.name} is a plausible stretch sponsor if the pitch is tied to a concrete audience or launch moment.`;
  }
  return `${brand.name} is not a natural fit yet; outreach would need a very specific reason to avoid feeling generic.`;
}
