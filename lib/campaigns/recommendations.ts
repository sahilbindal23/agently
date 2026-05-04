import { getBangaloreFit, getCreatorLanguages } from "@/lib/utils/creator-metrics";
import type { Campaign, Creator, CreatorPlatform } from "@/types";

export type FreelancerRecommendationInput = {
  id: string;
  display_name: string;
  service_category: string;
  home_city: string;
  service_regions: string[];
  languages: string[];
  skills: string[];
  hourly_rate_cents?: number;
  day_rate_cents?: number;
  portfolio_score?: number;
  image_url?: string | null;
  verification_tier?: string;
  verification_status?: string;
  completed_project_count?: number;
};

export type ServiceRateInput = {
  freelancer_id: string;
  service_name: string;
  rate_cents: number;
};

export type ScoreBreakdown = {
  category_fit: number;
  audience_fit: number;
  platform_fit: number;
  city_fit: number;
  language_fit: number;
  budget_fit: number;
  data_confidence: number;
};

export type RoiEstimate = {
  expected_reach: number;
  expected_engagements: number;
  estimated_cpm_cents: number;
  estimated_cpe_cents: number;
  confidence_score: number;
};

export type CampaignRecommendation = {
  id: string;
  name: string;
  subtitle: string;
  image_url?: string | null;
  score: number;
  reason: string;
  match_type: string;
  best_use_case: string;
  expected_outcome: string;
  risk_level: "low" | "medium" | "high";
  proof_points: string[];
  score_breakdown: ScoreBreakdown;
  watchouts: string[];
  roi_estimate: RoiEstimate;
  trust_source: "api_synced" | "verified_profile" | "self_reported";
};

type TrustSource = CampaignRecommendation["trust_source"];

export function rankCreators(campaign: Campaign, creators: Creator[], platforms: CreatorPlatform[]): CampaignRecommendation[] {
  const briefText = briefKeywords(campaign);
  return creators.map((creator) => {
    const creatorPlatforms = platforms.filter((platform) => platform.creator_id === creator.id);
    const primary = creatorPlatforms[0];
    const platformFit = campaign.platforms.length && creatorPlatforms.some((platform) => includesAny(platform.platform, campaign.platforms)) ? 88 : campaign.platforms.length ? 45 : 70;
    const categoryFit = includesAny(creator.primary_niche, campaign.creator_categories) || includesAny(creator.content_style, campaign.creator_categories) ? 90 : 48;
    const audienceFit = includesAny(`${creator.primary_niche} ${creator.bio} ${creator.content_style}`, briefText) ? 82 : 52;
    const languageFit = campaign.languages.length && creator.languages.some((language) => includesAny(language, campaign.languages)) ? 86 : campaign.languages.length ? 42 : 68;
    const cityFit = getBangaloreFit(creator);
    const budgetFit = getCreatorBudgetFit(campaign.budget_cents, primary?.avg_views ?? 0);
    const trustBoost = trustScore(creator.verification_tier, creator.verification_status) + completedWorkTrustBoost(Number(creator.completed_deal_count ?? 0));
    const syncedMetrics = Boolean(primary?.metric_source && primary.metric_source !== "self_reported");
    const trustSource: TrustSource = syncedMetrics ? "api_synced" : creator.verification_tier && creator.verification_tier !== "unverified" ? "verified_profile" : "self_reported";
    const dataConfidence = Math.min(96, Math.max(primary?.data_confidence ?? 0, primary?.avg_views ? 76 : 42) + trustBoost + (syncedMetrics ? 5 : 0));
    const scoreBreakdown = {
      category_fit: categoryFit,
      audience_fit: audienceFit,
      platform_fit: platformFit,
      city_fit: cityFit,
      language_fit: languageFit,
      budget_fit: budgetFit,
      data_confidence: dataConfidence
    };
    const score = weightedScore(scoreBreakdown);
    const roi = estimateCreatorRoi(campaign, primary);
    const watchouts = creatorWatchouts(campaign, creator, primary, scoreBreakdown);
    const matchType = creatorMatchType(campaign, scoreBreakdown, creator);

    return {
      id: creator.id,
      name: creator.display_name,
      image_url: creator.image_url ?? null,
      subtitle: `${creator.primary_niche} - ${primary ? `${primary.platform}, ${compactNumber(primary.followers)} followers` : getCreatorLanguages(creator)}`,
      score,
      reason: `${creator.display_name} fits through ${creator.primary_niche.toLowerCase()}, ${creator.home_city || "India"} relevance, and ${creator.content_style || "audience"} style${creator.completed_deal_count ? `, with ${creator.completed_deal_count} completed Agently deal${creator.completed_deal_count === 1 ? "" : "s"}` : ""}.`,
      match_type: matchType,
      best_use_case: creatorBestUseCase(matchType, campaign, creator),
      expected_outcome: creatorExpectedOutcome(campaign, primary, roi),
      risk_level: riskLevel(score, watchouts.length, scoreBreakdown.data_confidence),
      proof_points: creatorProofPoints(creator, primary, scoreBreakdown),
      score_breakdown: scoreBreakdown,
      watchouts,
      roi_estimate: roi,
      trust_source: trustSource
    };
  }).sort((a, b) => trustSortBoost(b.trust_source) + b.score - (trustSortBoost(a.trust_source) + a.score));
}

export function rankFreelancers(campaign: Campaign, freelancers: FreelancerRecommendationInput[], serviceRates: ServiceRateInput[]): CampaignRecommendation[] {
  const needs = [...campaign.freelancer_needs, ...briefKeywords(campaign)];
  return freelancers.map((freelancer) => {
    const skillsText = [freelancer.service_category, ...(freelancer.skills ?? []), ...(freelancer.service_regions ?? [])].join(" ");
    const skillFit = includesAny(skillsText, needs) ? 88 : 52;
    const cityFit = includesAny(`${freelancer.home_city} ${(freelancer.service_regions ?? []).join(" ")}`, [campaign.city_focus, campaign.region_focus, "Bangalore", "Bengaluru"].filter(Boolean)) ? 84 : 48;
    const languageFit = campaign.languages.length && (freelancer.languages ?? []).some((language) => includesAny(language, campaign.languages)) ? 82 : campaign.languages.length ? 44 : 66;
    const portfolioFit = Math.min(90, Math.max(35, Number(freelancer.portfolio_score ?? 0)));
    const budgetFit = getFreelancerBudgetFit(campaign.budget_cents, freelancer.hourly_rate_cents ?? freelancer.day_rate_cents ?? 0);
    const trustBoost = trustScore(freelancer.verification_tier, freelancer.verification_status) + completedWorkTrustBoost(Number(freelancer.completed_project_count ?? 0));
    const scoreBreakdown = {
      category_fit: skillFit,
      audience_fit: 55,
      platform_fit: 65,
      city_fit: cityFit,
      language_fit: languageFit,
      budget_fit: budgetFit,
      data_confidence: Math.min(96, portfolioFit + trustBoost)
    };
    const score = weightedScore(scoreBreakdown);
    const rates = serviceRates.filter((rate) => rate.freelancer_id === freelancer.id).slice(0, 2);
    const roi = estimateFreelancerValue(campaign, freelancer, rates);
    const watchouts = freelancerWatchouts(campaign, freelancer, rates.length);
    const matchType = freelancerMatchType(campaign, freelancer, scoreBreakdown);

    return {
      id: freelancer.id,
      name: freelancer.display_name,
      image_url: String((freelancer as Record<string, unknown>).image_url ?? "") || null,
      subtitle: `${freelancer.service_category || "Creative services"} - hourly ${currency(freelancer.hourly_rate_cents ?? freelancer.day_rate_cents ?? 0)}`,
      score,
      reason: `${freelancer.display_name} fits the production need through ${(freelancer.skills ?? []).slice(0, 3).join(", ") || freelancer.service_category}. ${rates.length ? `Listed rates: ${rates.map((rate) => `${rate.service_name} ${currency(rate.rate_cents)}`).join(", ")}.` : "Add service rates to improve pricing clarity."}`,
      match_type: matchType,
      best_use_case: freelancerBestUseCase(matchType, campaign, freelancer),
      expected_outcome: freelancerExpectedOutcome(campaign, freelancer, rates),
      risk_level: riskLevel(score, watchouts.length, scoreBreakdown.data_confidence),
      proof_points: freelancerProofPoints(freelancer, rates, scoreBreakdown),
      score_breakdown: scoreBreakdown,
      watchouts,
      roi_estimate: roi,
      trust_source: freelancer.verification_tier && freelancer.verification_tier !== "unverified" ? "verified_profile" as const : "self_reported" as const
    };
  }).sort((a, b) => b.score - a.score);
}

function estimateCreatorRoi(campaign: Campaign, platform?: CreatorPlatform): RoiEstimate {
  const expectedReach = Math.max(0, Math.round(platform?.avg_views ?? 0));
  const engagementRate = Number(platform?.engagement_rate ?? 2.5) / 100;
  const expectedEngagements = Math.round(expectedReach * engagementRate);
  const budget = campaign.budget_cents || 1;
  const syncedConfidence = Number(platform?.data_confidence ?? 0) / 100;
  return {
    expected_reach: expectedReach,
    expected_engagements: expectedEngagements,
    estimated_cpm_cents: expectedReach ? Math.round((budget / expectedReach) * 1000) : 0,
    estimated_cpe_cents: expectedEngagements ? Math.round(budget / expectedEngagements) : 0,
    confidence_score: platform?.avg_views ? Math.max(0.62, syncedConfidence) : 0.32
  };
}

function estimateFreelancerValue(campaign: Campaign, freelancer: FreelancerRecommendationInput, rates: ServiceRateInput[]): RoiEstimate {
  const hourlyRate = freelancer.hourly_rate_cents ?? freelancer.day_rate_cents ?? 0;
  const lowestProject = rates.length ? Math.min(...rates.map((rate) => rate.rate_cents || hourlyRate || 0)) : hourlyRate;
  const budget = campaign.budget_cents || 0;
  const budgetCoverage = lowestProject ? Math.min(100, Math.round((budget / lowestProject) * 100)) : 0;
  return {
    expected_reach: 0,
    expected_engagements: 0,
    estimated_cpm_cents: 0,
    estimated_cpe_cents: lowestProject,
    confidence_score: budgetCoverage >= 100 ? 0.58 : 0.36
  };
}

function creatorWatchouts(campaign: Campaign, creator: Creator, platform: CreatorPlatform | undefined, breakdown: ScoreBreakdown) {
  return [
    !platform?.avg_views ? "Missing average views, ROI estimate has low confidence." : "",
    campaign.platforms.length && !platform ? "No captured platform data for the requested channel." : "",
    breakdown.category_fit < 60 ? "Category fit is weak against the brief." : "",
    breakdown.budget_fit < 55 ? "Budget may be low for expected reach or deliverables." : "",
    creator.india_audience_percent < 40 ? "India audience share may be limited for this campaign." : ""
  ].filter(Boolean);
}

function freelancerWatchouts(campaign: Campaign, freelancer: FreelancerRecommendationInput, serviceRateCount: number) {
  return [
    serviceRateCount === 0 ? "No project-specific service rates listed yet." : "",
    !freelancer.portfolio_score ? "Portfolio score missing, review links manually." : "",
    campaign.freelancer_needs.length && !includesAny([freelancer.service_category, ...(freelancer.skills ?? [])].join(" "), campaign.freelancer_needs) ? "Service category may not directly match requested production need." : ""
  ].filter(Boolean);
}

function getCreatorBudgetFit(budgetCents: number, avgViews: number) {
  if (!budgetCents || !avgViews) return 50;
  const cpmCents = (budgetCents / avgViews) * 1000;
  if (cpmCents < 2500) return 88;
  if (cpmCents < 6500) return 74;
  if (cpmCents < 12000) return 58;
  return 38;
}

function getFreelancerBudgetFit(budgetCents: number, hourlyRateCents: number) {
  if (!budgetCents || !hourlyRateCents) return 55;
  const estimatedHours = budgetCents / hourlyRateCents;
  if (estimatedHours >= 20) return 88;
  if (estimatedHours >= 10) return 74;
  if (estimatedHours >= 4) return 58;
  return 36;
}

function weightedScore(score: ScoreBreakdown) {
  return Math.max(35, Math.min(96, Math.round(
    score.category_fit * 0.22 +
    score.audience_fit * 0.18 +
    score.platform_fit * 0.12 +
    score.city_fit * 0.16 +
    score.language_fit * 0.1 +
    score.budget_fit * 0.14 +
    score.data_confidence * 0.08
  )));
}

function trustScore(tier?: string, status?: string) {
  if (tier === "performance") return 18;
  if (tier === "social") return 12;
  if (tier === "profile" || status === "verified") return 7;
  if (tier === "reviewing" || status === "reviewing") return 3;
  if (tier === "rejected" || status === "rejected") return -18;
  return 0;
}

function creatorMatchType(campaign: Campaign, breakdown: ScoreBreakdown, creator: Creator) {
  if (breakdown.category_fit >= 80 && breakdown.audience_fit >= 70) return "Direct category fit";
  if (breakdown.audience_fit >= 75 && breakdown.category_fit < 70) return "Bridge audience fit";
  if (breakdown.city_fit >= 75 && includesAny(`${campaign.city_focus} ${campaign.region_focus}`, ["Bangalore", "Bengaluru"])) return "Bangalore activation fit";
  if (creator.verification_tier === "performance") return "Performance-backed fit";
  return "Pilot test fit";
}

function freelancerMatchType(campaign: Campaign, freelancer: FreelancerRecommendationInput, breakdown: ScoreBreakdown) {
  if (breakdown.category_fit >= 80 && breakdown.budget_fit >= 65) return "Production need fit";
  if (breakdown.city_fit >= 75) return "Local execution fit";
  if ((freelancer.verification_tier ?? "") === "performance") return "Performance-backed vendor";
  if (campaign.freelancer_needs.length === 0) return "Optional production support";
  return "Pilot vendor fit";
}

function creatorBestUseCase(matchType: string, campaign: Campaign, creator: Creator) {
  if (matchType === "Bridge audience fit") return `Use ${creator.display_name} to introduce the brand to ${campaign.target_audience || "a new audience"} without forcing a generic category ad.`;
  if (matchType === "Bangalore activation fit") return `Use for a city-first Bangalore launch, store/event push, or regional creator proof point.`;
  if (matchType === "Performance-backed fit") return `Use for a higher-confidence campaign where delivery reliability matters more than experimentation.`;
  if (matchType === "Direct category fit") return `Use for a straightforward sponsor integration where the creator's niche already matches the brief.`;
  return `Use as a smaller paid pilot before committing larger budget or exclusivity.`;
}

function freelancerBestUseCase(matchType: string, campaign: Campaign, freelancer: FreelancerRecommendationInput) {
  if (matchType === "Local execution fit") return `Use ${freelancer.display_name} for Bangalore/India production where speed, local context, and coordination matter.`;
  if (matchType === "Production need fit") return `Use for ${campaign.freelancer_needs.join(", ") || freelancer.service_category || "campaign production"} with clear scope and rate cards.`;
  if (matchType === "Performance-backed vendor") return `Use for critical production work where past Agently delivery should reduce execution risk.`;
  if (matchType === "Optional production support") return `Use if the campaign needs editing, design, shooting, or repurposing support after creator selection.`;
  return `Use for a small scoped project before increasing budget or campaign responsibility.`;
}

function creatorExpectedOutcome(campaign: Campaign, platform: CreatorPlatform | undefined, roi: RoiEstimate) {
  if (!platform?.avg_views) return "Outcome confidence is limited until average views and recent campaign data are verified.";
  const goal = campaign.campaign_goal || "campaign awareness";
  return `Expected to support ${goal} with about ${compactNumber(roi.expected_reach)} reach and ${compactNumber(roi.expected_engagements)} engagements before conversion tracking.`;
}

function freelancerExpectedOutcome(campaign: Campaign, freelancer: FreelancerRecommendationInput, rates: ServiceRateInput[]) {
  const listedRates = rates.map((rate) => rate.rate_cents || 0).filter(Boolean);
  const rateText = listedRates.length ? `Known project rate starts around ${currency(Math.min(...listedRates))}.` : "Project rate needs confirmation.";
  return `${freelancer.display_name} should improve campaign production quality for ${campaign.freelancer_needs.join(", ") || "creative execution"}. ${rateText}`;
}

function riskLevel(score: number, watchoutCount: number, confidence: number): CampaignRecommendation["risk_level"] {
  if (score >= 78 && watchoutCount <= 1 && confidence >= 70) return "low";
  if (score < 58 || watchoutCount >= 3 || confidence < 45) return "high";
  return "medium";
}

function creatorProofPoints(creator: Creator, platform: CreatorPlatform | undefined, breakdown: ScoreBreakdown) {
  return [
    `${breakdown.category_fit}/100 category fit`,
    `${breakdown.city_fit}/100 city fit`,
    platform ? `${compactNumber(platform.avg_views)} avg views on ${platform.platform}` : "Platform metrics missing",
    platform?.metric_source && platform.metric_source !== "self_reported" ? `Metrics source: ${platform.metric_source.replace("_", " ")}` : "Metrics source: self reported",
    creator.completed_deal_count ? `${creator.completed_deal_count} completed Agently deal${creator.completed_deal_count === 1 ? "" : "s"}` : "No completed Agently deals yet",
    creator.verification_tier ? `Trust tier: ${creator.verification_tier}` : "Trust tier: unverified"
  ];
}

function trustSortBoost(source: CampaignRecommendation["trust_source"]) {
  if (source === "api_synced") return 7;
  if (source === "verified_profile") return 3;
  return 0;
}

function freelancerProofPoints(freelancer: FreelancerRecommendationInput, rates: ServiceRateInput[], breakdown: ScoreBreakdown) {
  return [
    `${breakdown.category_fit}/100 skill fit`,
    `${breakdown.city_fit}/100 city fit`,
    rates.length ? `${rates.length} service rate card${rates.length === 1 ? "" : "s"} listed` : "No service rates listed",
    freelancer.completed_project_count ? `${freelancer.completed_project_count} completed Agently project${freelancer.completed_project_count === 1 ? "" : "s"}` : "No completed Agently projects yet",
    freelancer.verification_tier ? `Trust tier: ${freelancer.verification_tier}` : "Trust tier: unverified"
  ];
}

function completedWorkTrustBoost(count: number) {
  if (count >= 5) return 10;
  if (count >= 3) return 7;
  if (count >= 1) return 4;
  return 0;
}

function briefKeywords(campaign: Campaign) {
  return [
    ...campaign.creator_categories,
    ...campaign.freelancer_needs,
    campaign.campaign_goal,
    campaign.target_audience
  ].join(" ").split(/\W+/).filter((word) => word.length > 3);
}

function includesAny(text: string, values: string[]) {
  const haystack = text.toLowerCase();
  return values.some((value) => value && haystack.includes(value.toLowerCase()));
}

function compactNumber(value = 0) {
  return new Intl.NumberFormat("en-IN", { notation: "compact" }).format(value);
}

function currency(cents = 0) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(cents / 100);
}
