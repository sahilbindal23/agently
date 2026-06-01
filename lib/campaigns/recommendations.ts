import { audienceFitScore, engagementQualityScore, latestPerProvider, type SocialMetricSnapshot } from "@/lib/campaigns/engagement-quality";
import { categoryTierLabel, gradedCategoryFit, nicheRelations, normalizeNiche, type CategoryMatchTier } from "@/lib/campaigns/niche-adjacency";
import { getCityFit, getCreatorLanguages } from "@/lib/utils/creator-metrics";
import { isTrustedMetricSource, socialTrustFromSource } from "@/lib/social/trust";
import type { Brand, Campaign, Creator, CreatorPlatform } from "@/types";

export type { SocialMetricSnapshot } from "@/lib/campaigns/engagement-quality";

export type FreelancerRecommendationInput = {
  id: string;
  is_demo?: boolean;
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
  engagement_quality: number;
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
  // Tier from gradedCategoryFit — populated for creator recommendations
  // so the UI can show WHY a creator ranked where they did. Undefined
  // for freelancer recommendations since freelancers use skill-based
  // matching, not the niche graph.
  category_match_tier?: CategoryMatchTier;
  best_use_case: string;
  expected_outcome: string;
  risk_level: "low" | "medium" | "high";
  proof_points: string[];
  marketplace_signals?: string[];
  score_breakdown: ScoreBreakdown;
  watchouts: string[];
  roi_estimate: RoiEstimate;
  trust_source: "api_synced" | "verified_profile" | "self_reported";
  metric_source?: string;
};

export type RecommendationEventSignal = {
  event_name: string;
  entity_type: string | null;
  entity_id: string | null;
  metadata: Record<string, unknown> | null;
  created_at?: string | null;
};

type TrustSource = CampaignRecommendation["trust_source"];

export function rankCreators(
  campaign: Campaign,
  creators: Creator[],
  platforms: CreatorPlatform[],
  snapshots: SocialMetricSnapshot[] = [],
  brand?: Brand | null
): CampaignRecommendation[] {
  const briefText = briefKeywords(campaign);
  return creators.map((creator) => {
    const creatorPlatforms = platforms.filter((platform) => platform.creator_id === creator.id);
    const primary = creatorPlatforms[0];
    const creatorSnapshots = snapshots.filter((snap) => snap.creator_id === creator.id);
    const platformFit = campaign.platforms.length && creatorPlatforms.some((platform) => includesAny(platform.platform, campaign.platforms)) ? 88 : campaign.platforms.length ? 45 : 70;
    // Graded category fit replaces the previous binary 90/48 cliff so a
    // tech reviewer ranks above a lifestyle reviewer on a tech brief.
    // The tier is preserved on the recommendation row for the UI label.
    const { score: categoryFit, tier: categoryMatchTier } = gradedCategoryFit({
      creatorNiche: creator.primary_niche,
      creatorContentStyle: creator.content_style,
      campaignCategories: campaign.creator_categories ?? [],
      brandIndustry: brand?.industry ?? null
    });
    // audience_fit V2: blend Phyllo demographic snapshots with the legacy
    // topic-keyword check. Falls back to keyword-only when no snapshots.
    const topicKeywordHit = includesAny(`${creator.primary_niche} ${creator.bio} ${creator.content_style}`, briefText);
    const audienceFit = audienceFitScore({ campaign, creator, snapshots: creatorSnapshots, topicKeywordHit });
    // engagement_quality (anti-bot): ER sanity, view-to-follower ratio,
    // consistency across history. Stays neutral when no snapshots exist.
    const engagementQualityResult = engagementQualityScore(creatorSnapshots);
    const engagementQuality = engagementQualityResult.score;
    const languageFit = campaign.languages.length && creator.languages.some((language) => includesAny(language, campaign.languages)) ? 86 : campaign.languages.length ? 42 : 68;
    // City fit is now dynamic against the campaign's targeted city, using
    // both intake-declared cities and Phyllo audience top_cities. When the
    // campaign has no city focus, falls back to a general India relevance.
    const phylloTopCities = latestPerProvider(creatorSnapshots).flatMap((s) => s.top_cities ?? []);
    const cityFit = getCityFit(creator, campaign.city_focus, phylloTopCities);
    const budgetFit = getCreatorBudgetFit(campaign.budget_cents, primary?.avg_views ?? 0);
    const trustBoost = trustScore(creator.verification_tier, creator.verification_status) + completedWorkTrustBoost(Number(creator.completed_deal_count ?? 0));
    const syncedMetrics = isTrustedMetricSource(primary?.metric_source);
    const trustSource: TrustSource = syncedMetrics ? "api_synced" : isVerifiedTier(creator.verification_tier, creator.verification_status) ? "verified_profile" : "self_reported";
    const sourceConfidence = syncedMetrics ? 82 : primary?.metric_source ? 38 : 42;
    const dataConfidence = Math.min(96, Math.max(primary?.data_confidence ?? 0, sourceConfidence) + trustBoost + (syncedMetrics ? 7 : 0));
    const scoreBreakdown = {
      category_fit: categoryFit,
      audience_fit: audienceFit,
      engagement_quality: engagementQuality,
      platform_fit: platformFit,
      city_fit: cityFit,
      language_fit: languageFit,
      budget_fit: budgetFit,
      data_confidence: dataConfidence
    };
    // Two-sided matching: nudge the brand-side fit score by the creator's
    // own stated preferences so we don't surface talent that would decline
    // (wrong category, budget below their floor, not taking work). Neutral
    // when the creator hasn't set any preferences.
    const preference = mutualPreferenceAdjustment(campaign, creator, brand);
    const score = Math.max(35, Math.min(96, weightedScore(scoreBreakdown) + preference.points));
    const roi = estimateCreatorRoi(campaign, primary);
    // engagement_quality (anti-bot) bot-signal reasons are intentionally
    // NOT bubbled into watchouts right now — we're keeping the early
    // marketplace welcoming to creators rather than surfacing engagement
    // quality concerns at recommendation time. The score still influences
    // ranking under the hood (10% weight). Surface this later when the
    // product is ready to position anti-bot as a brand-facing feature.
    void engagementQualityResult; // kept in scope for future reactivation
    const watchouts = [...creatorWatchouts(campaign, creator, primary, scoreBreakdown), ...preference.watchouts];
    const matchType = creatorMatchType(campaign, scoreBreakdown, creator, categoryMatchTier);
    const proofPoints = preference.proofs.length
      ? [...creatorProofPoints(creator, primary, scoreBreakdown), ...preference.proofs]
      : creatorProofPoints(creator, primary, scoreBreakdown);

    return {
      id: creator.id,
      name: creator.display_name,
      image_url: creator.image_url ?? null,
      subtitle: `${creator.primary_niche} - ${primary ? `${primary.platform}, ${compactNumber(primary.followers)} followers` : getCreatorLanguages(creator)}`,
      score,
      reason: `${creator.display_name} fits through ${creator.primary_niche.toLowerCase()}, ${creator.home_city || "India"} relevance, and ${creator.content_style || "audience"} style.`,
      match_type: matchType,
      category_match_tier: categoryMatchTier,
      best_use_case: creatorBestUseCase(matchType, campaign, creator),
      expected_outcome: creatorExpectedOutcome(campaign, primary, roi),
      risk_level: riskLevel(score, watchouts.length, scoreBreakdown.data_confidence),
      proof_points: proofPoints,
      score_breakdown: scoreBreakdown,
      watchouts,
      roi_estimate: roi,
      trust_source: trustSource,
      metric_source: primary?.metric_source
    };
  }).sort((a, b) => recommendationSortScore(b) - recommendationSortScore(a));
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
      // Freelancers don't have audience metrics — engagement_quality stays
      // neutral so the dimension exists in the breakdown shape but doesn't
      // bias the ranking against vendors.
      engagement_quality: 60,
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
      trust_source: isVerifiedTier(freelancer.verification_tier, freelancer.verification_status) ? "verified_profile" as const : "self_reported" as const
    };
  }).sort((a, b) => b.score - a.score);
}

export function applyEventInformedRanking(
  recommendations: CampaignRecommendation[],
  type: "creator" | "freelancer",
  events: RecommendationEventSignal[],
  campaignId?: string
) {
  return recommendations
    .map((recommendation) => {
      const signals = eventsForRecommendation(events, type, recommendation.id);
      const adjustment = eventAdjustment(signals, campaignId);
      const score = Math.max(35, Math.min(98, recommendation.score + adjustment.points));
      return {
        ...recommendation,
        score,
        marketplace_signals: adjustment.labels,
        proof_points: adjustment.labels.length
          ? [...recommendation.proof_points, ...adjustment.labels.slice(0, 2)]
          : recommendation.proof_points
      };
    })
    .sort((a, b) => recommendationSortScore(b) - recommendationSortScore(a));
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

// Mutual (two-sided) preference adjustment. The weighted brand-side score
// answers "does this creator fit the brief"; this answers "would the creator
// take it". Returns a bounded score delta plus watchouts / proof points to
// surface so the brand sees WHY a well-matched creator was deprioritized.
// Neutral (0, no labels) when the creator has stated no preferences, so
// existing creators rank exactly as before.
function mutualPreferenceAdjustment(campaign: Campaign, creator: Creator, brand?: Brand | null) {
  const watchouts: string[] = [];
  const proofs: string[] = [];
  let points = 0;

  const campaignKeys = new Set((campaign.creator_categories ?? []).map(normalizeNiche).filter(Boolean));
  const brandIndustry = String(brand?.industry ?? "").toLowerCase().trim();
  const preferred = (creator.preferred_categories ?? []).map(normalizeNiche).filter(Boolean);
  const excluded = (creator.excluded_categories ?? []).map(normalizeNiche).filter(Boolean);

  // Excluded category — the creator explicitly opted out (alcohol, gambling,
  // etc.). Strong penalty so it sinks to the bottom, with a clear watchout.
  if (excluded.some((key) => preferenceMatchesCampaign(key, campaignKeys, brandIndustry))) {
    points -= 40;
    watchouts.push("Creator has excluded this category from brand work.");
  } else if (preferred.some((key) => preferenceMatchesCampaign(key, campaignKeys, brandIndustry))) {
    // Actively-sought category — small boost + proof point.
    points += 6;
    proofs.push("Actively seeking this category");
  }

  // Budget floor — below the creator's stated minimum they likely decline.
  const floor = Number(creator.min_deal_cents ?? 0);
  if (floor > 0 && campaign.budget_cents > 0 && campaign.budget_cents < floor) {
    points -= 12;
    watchouts.push(`Brief budget is below the creator's stated minimum (${currency(floor)}).`);
  }

  // Not currently taking new brand offers.
  if (creator.open_to_offers === false) {
    points -= 16;
    watchouts.push("Creator is not currently taking new brand offers.");
  }

  return { points: Math.max(-40, Math.min(8, points)), watchouts, proofs };
}

// A creator preference key matches a campaign when it appears in the brief's
// requested categories, OR aligns with the brand's industry — directly
// (substring) or through the niche → industry graph.
function preferenceMatchesCampaign(key: string, campaignKeys: Set<string>, brandIndustry: string) {
  if (!key) return false;
  if (campaignKeys.has(key)) return true;
  if (brandIndustry) {
    if (brandIndustry.includes(key) || key.includes(brandIndustry)) return true;
    const industries = nicheRelations(key).industries;
    if (industries.some((industry) => brandIndustry.includes(industry) || industry.includes(brandIndustry))) return true;
  }
  return false;
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
  // Weight rationale (sums to 1.00):
  //   - audience_fit deliberately capped at 0.12 because audience numbers
  //     are the most botable signal on social platforms today. A creator
  //     with bought followers in the right city should not outrank one
  //     with real, engaged viewers.
  //   - engagement_quality (new, 0.10) absorbs the weight cut from
  //     audience_fit. ER-vs-follower-tier, view-to-follower ratio, and
  //     consistency across snapshots are harder to fake than raw demographics.
  //   - city_fit stays at 0.08 (Bangalore is a wedge, not a constraint).
  //   - category_fit keeps the largest single weight at 0.24.
  return Math.max(35, Math.min(96, Math.round(
    score.category_fit * 0.24 +
    score.audience_fit * 0.12 +
    score.engagement_quality * 0.10 +
    score.platform_fit * 0.12 +
    score.city_fit * 0.08 +
    score.language_fit * 0.12 +
    score.budget_fit * 0.14 +
    score.data_confidence * 0.08
  )));
}

// Collapsed verification model: two tiers.
//
//   "verified"   → admin/Phyllo confirmed the creator (any non-unverified,
//                  non-reviewing, non-rejected DB value maps here, so legacy
//                  "performance" / "social" / "profile" rows still get the
//                  boost without a backfill migration)
//   "unverified" → no signal yet
//
// We keep "reviewing" and "rejected" as transient states so admins can see
// what's mid-flight or actively blocked — they don't earn the boost.
export function isVerifiedTier(tier?: string | null, status?: string | null) {
  if (!tier && !status) return false;
  if (tier === "rejected" || status === "rejected") return false;
  if (tier === "reviewing" || status === "reviewing") return false;
  if (tier === "unverified" || (!tier && status !== "verified")) return false;
  return true;
}

function trustScore(tier?: string, status?: string) {
  if (tier === "rejected" || status === "rejected") return -18;
  if (tier === "reviewing" || status === "reviewing") return 3;
  if (isVerifiedTier(tier, status)) return 10;
  return 0;
}

function creatorMatchType(
  campaign: Campaign,
  breakdown: ScoreBreakdown,
  creator: Creator,
  categoryMatchTier?: CategoryMatchTier
) {
  // Prefer the graded-categoryFit label when it gives us a concrete
  // tier (direct/industry/adjacent). The categoryFit score and the
  // label now move together, so brands no longer see "Direct category
  // fit" on a lifestyle-only-keyword-overlap match.
  if (categoryMatchTier === "direct") return categoryTierLabel("direct");
  if (categoryMatchTier === "industry") return categoryTierLabel("industry");

  if (breakdown.audience_fit >= 75 && breakdown.category_fit < 70) return "Bridge audience fit";
  if (breakdown.city_fit >= 75 && includesAny(`${campaign.city_focus} ${campaign.region_focus}`, ["Bangalore", "Bengaluru"])) return "Bangalore activation fit";

  if (categoryMatchTier === "adjacent") return categoryTierLabel("adjacent");
  if (categoryMatchTier === "style") return categoryTierLabel("style");

  if (isVerifiedTier(creator.verification_tier, creator.verification_status)) return "Verified creator fit";
  return "Pilot test fit";
}

function freelancerMatchType(campaign: Campaign, freelancer: FreelancerRecommendationInput, breakdown: ScoreBreakdown) {
  if (breakdown.category_fit >= 80 && breakdown.budget_fit >= 65) return "Production need fit";
  if (breakdown.city_fit >= 75) return "Local execution fit";
  if (isVerifiedTier(freelancer.verification_tier, freelancer.verification_status)) return "Verified vendor fit";
  if (campaign.freelancer_needs.length === 0) return "Optional production support";
  return "Pilot vendor fit";
}

function creatorBestUseCase(matchType: string, campaign: Campaign, creator: Creator) {
  if (matchType === "Bridge audience fit") return `Use ${creator.display_name} to introduce the brand to ${campaign.target_audience || "a new audience"} without forcing a generic category ad.`;
  if (matchType === "Bangalore activation fit") return `Use for a city-first Bangalore launch, store/event push, or regional creator proof point.`;
  if (matchType === "Verified creator fit") return `Use for a higher-confidence campaign where the creator's profile has been verified by Agently.`;
  if (matchType === "Direct category fit") return `Use for a straightforward sponsor integration where the creator's niche already matches the brief.`;
  return `Use as a smaller paid pilot before committing larger budget or exclusivity.`;
}

function freelancerBestUseCase(matchType: string, campaign: Campaign, freelancer: FreelancerRecommendationInput) {
  if (matchType === "Local execution fit") return `Use ${freelancer.display_name} for Bangalore/India production where speed, local context, and coordination matter.`;
  if (matchType === "Production need fit") return `Use for ${campaign.freelancer_needs.join(", ") || freelancer.service_category || "campaign production"} with clear scope and rate cards.`;
  if (matchType === "Verified vendor fit") return `Use for higher-confidence production where Agently has verified the freelancer profile.`;
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
  const trust = socialTrustFromSource(platform?.metric_source);
  // engagement_quality (anti-bot) is computed in the engine and influences
  // ranking, but we intentionally don't surface the score or sub-signals
  // here. Early-stage product decision: keep creator-facing copy
  // encouraging, not gatekeeping. When closed-deal data justifies
  // launching this as a brand-facing differentiator, add it back.
  return [
    `${breakdown.category_fit}/100 category fit`,
    `${breakdown.audience_fit}/100 audience fit`,
    platform ? `${compactNumber(platform.avg_views)} avg views on ${platform.platform}` : "Platform metrics missing",
    `Metrics trust: ${trust.label}`,
    isVerifiedTier(creator.verification_tier, creator.verification_status) ? "Verified by Agently" : "Unverified"
  ];
}

function trustSortBoost(source: CampaignRecommendation["trust_source"]) {
  if (source === "api_synced") return 7;
  if (source === "verified_profile") return 3;
  return 0;
}

function recommendationSortScore(recommendation: CampaignRecommendation) {
  const socialTrust = socialTrustFromSource(recommendation.metric_source);
  return recommendation.score + trustSortBoost(recommendation.trust_source) + (socialTrust.trusted ? 3 : 0);
}

function freelancerProofPoints(freelancer: FreelancerRecommendationInput, rates: ServiceRateInput[], breakdown: ScoreBreakdown) {
  return [
    `${breakdown.category_fit}/100 skill fit`,
    `${breakdown.city_fit}/100 city fit`,
    rates.length ? `${rates.length} service rate card${rates.length === 1 ? "" : "s"} listed` : "No service rates listed",
    isVerifiedTier(freelancer.verification_tier, freelancer.verification_status) ? "Verified by Agently" : "Unverified"
  ];
}

function eventsForRecommendation(events: RecommendationEventSignal[], type: "creator" | "freelancer", id: string) {
  const metadataKey = type === "creator" ? "creator_id" : "freelancer_id";
  return events.filter((event) => {
    if (event.entity_type === type && event.entity_id === id) return true;
    return String(event.metadata?.[metadataKey] ?? "") === id;
  });
}

function eventAdjustment(events: RecommendationEventSignal[], campaignId?: string) {
  let points = 0;
  const labels = new Set<string>();
  const recentEvents = events.filter((event) => isRecentEnough(event.created_at));

  for (const event of recentEvents) {
    const sameCampaign = campaignId && String(event.metadata?.campaign_id ?? "") === campaignId;
    switch (event.event_name) {
      case "talent_shortlisted":
        points += sameCampaign ? 2 : 1;
        labels.add(sameCampaign ? "Shortlist interest signal" : "Recent brand interest");
        break;
      case "talent_unshortlisted":
        points -= sameCampaign ? 2 : 1;
        labels.add("Recently unshortlisted");
        break;
      case "offer_sent":
      case "freelancer_project_sent":
        points += 2;
        labels.add("Brand offer activity");
        break;
      case "offer_accepted":
      case "freelancer_project_accepted":
        points += 8;
        labels.add("Accepted prior Agently offer");
        break;
      case "offer_countered":
      case "freelancer_project_countered":
        points += 1;
        labels.add("Negotiation-active talent");
        break;
      case "offer_declined":
      case "freelancer_project_declined":
        points -= declinePenalty(event);
        labels.add("Declined offer context");
        break;
      case "counter_accepted":
        points += 5;
        labels.add("Counter terms accepted");
        break;
      case "counter_declined":
        points -= 3;
        labels.add("Counter friction");
        break;
      case "deliverable_approved":
        points += 7;
        labels.add("Approved delivery history");
        break;
      case "deliverable_revision_requested":
        points -= revisionPenalty(event);
        labels.add("Revision requested");
        break;
      case "payment_status_updated":
        if (event.metadata?.status === "released" || event.metadata?.status === "release_ready") {
          points += 8;
          labels.add("Protected payout progressed");
        } else if (event.metadata?.status === "funded") {
          points += 4;
          labels.add("Funded workflow history");
        }
        break;
    }
  }

  return {
    labels: Array.from(labels).slice(0, 4),
    points: Math.max(-10, Math.min(14, points))
  };
}

function isRecentEnough(value: string | null | undefined) {
  if (!value) return true;
  const created = new Date(value).getTime();
  if (!Number.isFinite(created)) return true;
  return Date.now() - created <= 45 * 24 * 60 * 60 * 1000;
}

function declinePenalty(event: RecommendationEventSignal) {
  const amount = Number(event.metadata?.amount_cents ?? event.metadata?.offer_amount_cents ?? 0);
  const median = Number(event.metadata?.median_rate_cents ?? event.metadata?.benchmark_base_cents ?? 0);
  if (amount > 0 && median > 0 && amount < median * 0.65) return 0;
  if (String(event.metadata?.decline_reason ?? "").toLowerCase().includes("low")) return 0;
  return 2;
}

function revisionPenalty(event: RecommendationEventSignal) {
  const reason = String(event.metadata?.reason ?? event.metadata?.revision_reason ?? "").toLowerCase();
  if (reason.includes("brand") || reason.includes("scope") || reason.includes("brief") || reason.includes("unclear")) return 0;
  return 1;
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
