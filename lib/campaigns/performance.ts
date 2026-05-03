import type { CampaignRecommendation } from "@/lib/campaigns/recommendations";
import type { Campaign, CampaignShortlist } from "@/types";

type ProjectionInput = Pick<CampaignRecommendation, "id" | "name" | "roi_estimate" | "risk_level" | "score" | "watchouts">;

export type CampaignPerformanceProjection = {
  projectedReach: number;
  projectedEngagements: number;
  projectedCpmCents: number;
  projectedCostPerEngagementCents: number;
  confidenceScore: number;
  riskNotes: string[];
  improvementLevers: string[];
  creatorCount: number;
  freelancerCount: number;
  productionContribution: string;
};

export function projectCampaignPerformance({
  campaign,
  creatorRecommendations,
  freelancerRecommendations,
  shortlists = []
}: {
  campaign: Pick<Campaign, "budget_cents" | "campaign_goal" | "creator_categories" | "freelancer_needs" | "city_focus" | "region_focus">;
  creatorRecommendations: ProjectionInput[];
  freelancerRecommendations: ProjectionInput[];
  shortlists?: Pick<CampaignShortlist, "entity_id" | "entity_type">[];
}): CampaignPerformanceProjection {
  const shortlistedCreators = pickSelected(creatorRecommendations, shortlists, "creator");
  const shortlistedFreelancers = pickSelected(freelancerRecommendations, shortlists, "freelancer");
  const creators = shortlistedCreators.length ? shortlistedCreators : creatorRecommendations.slice(0, 3);
  const freelancers = shortlistedFreelancers.length ? shortlistedFreelancers : freelancerRecommendations.slice(0, 2);

  const projectedReach = creators.reduce((sum, item) => sum + Math.max(0, Number(item.roi_estimate.expected_reach ?? 0)), 0);
  const projectedEngagements = creators.reduce((sum, item) => sum + Math.max(0, Number(item.roi_estimate.expected_engagements ?? 0)), 0);
  const spend = Math.max(0, Number(campaign.budget_cents ?? 0));
  const projectedCpmCents = projectedReach ? Math.round((spend / projectedReach) * 1000) : 0;
  const projectedCostPerEngagementCents = projectedEngagements ? Math.round(spend / projectedEngagements) : 0;
  const confidenceScore = confidenceFromInputs(creators, freelancers, shortlists.length > 0);
  const riskNotes = buildRiskNotes(campaign, creators, freelancers, projectedReach, projectedEngagements);

  return {
    projectedReach,
    projectedEngagements,
    projectedCpmCents,
    projectedCostPerEngagementCents,
    confidenceScore,
    riskNotes,
    improvementLevers: buildImprovementLevers(campaign, creators, freelancers, projectedReach),
    creatorCount: creators.length,
    freelancerCount: freelancers.length,
    productionContribution: productionContribution(campaign.freelancer_needs, freelancers.length)
  };
}

function pickSelected(items: ProjectionInput[], shortlists: Pick<CampaignShortlist, "entity_id" | "entity_type">[], type: "creator" | "freelancer") {
  const ids = new Set(shortlists.filter((item) => item.entity_type === type).map((item) => item.entity_id));
  return items.filter((item) => ids.has(item.id));
}

function confidenceFromInputs(creators: ProjectionInput[], freelancers: ProjectionInput[], usingShortlist: boolean) {
  const creatorConfidence = average(creators.map((item) => Number(item.roi_estimate.confidence_score ?? 0) * 100));
  const fitConfidence = average([...creators, ...freelancers].map((item) => Number(item.score ?? 0)));
  const shortlistBoost = usingShortlist ? 8 : 0;
  return Math.max(20, Math.min(92, Math.round(creatorConfidence * 0.55 + fitConfidence * 0.35 + shortlistBoost)));
}

function buildRiskNotes(
  campaign: Pick<Campaign, "budget_cents" | "city_focus" | "region_focus">,
  creators: ProjectionInput[],
  freelancers: ProjectionInput[],
  projectedReach: number,
  projectedEngagements: number
) {
  const notes = new Set<string>();
  if (!projectedReach) notes.add("Reach estimate is low because selected creators are missing average-view data.");
  if (!projectedEngagements) notes.add("Engagement projection needs verified engagement rates before the campaign is funded.");
  if (!campaign.budget_cents) notes.add("Budget is missing, so CPM and cost-per-engagement are planning placeholders.");
  if (!campaign.city_focus && !campaign.region_focus) notes.add("Add city or region focus to improve Bangalore/India relevance scoring.");
  creators.filter((item) => item.risk_level !== "low").slice(0, 2).forEach((item) => notes.add(`${item.name} has ${item.risk_level} recommendation risk; review watchouts before sending an offer.`));
  freelancers.filter((item) => item.risk_level === "high").slice(0, 1).forEach((item) => notes.add(`${item.name} may need tighter scope before production work starts.`));
  creators.flatMap((item) => item.watchouts ?? []).slice(0, 2).forEach((watchout) => notes.add(watchout));
  return Array.from(notes).slice(0, 4);
}

function buildImprovementLevers(
  campaign: Pick<Campaign, "campaign_goal" | "creator_categories" | "freelancer_needs" | "city_focus" | "region_focus">,
  creators: ProjectionInput[],
  freelancers: ProjectionInput[],
  projectedReach: number
) {
  const levers = new Set<string>();
  if (creators.length < 3) levers.add("Shortlist at least three creators to avoid depending on one audience pocket.");
  if (projectedReach < 100000) levers.add("Add one higher-view creator or broaden the creator category to increase reach.");
  if (!freelancers.length && campaign.freelancer_needs.length) levers.add("Add a freelancer for editing/design support so creator assets can be repurposed.");
  if (!campaign.city_focus && !campaign.region_focus) levers.add("Set Bangalore, Bengaluru, or India as the focus market to tighten local fit.");
  if (!campaign.campaign_goal) levers.add("Add a sharper campaign goal so Agently can distinguish awareness, conversion, and launch-fit talent.");
  if (average(creators.map((item) => item.score)) < 75) levers.add("Improve fit by narrowing niche, language, or target audience instead of only increasing budget.");
  if (!levers.size) levers.add("Keep shortlisted creators, confirm usage rights, and use message threads to clarify deliverables before sending offers.");
  return Array.from(levers).slice(0, 4);
}

function productionContribution(needs: string[], freelancerCount: number) {
  if (!freelancerCount) return needs.length ? "Production needs are listed, but no freelancer is selected yet." : "No freelancer support is selected for this projection.";
  if (needs.length) return `${freelancerCount} freelancer${freelancerCount === 1 ? "" : "s"} can support ${needs.slice(0, 3).join(", ")}.`;
  return `${freelancerCount} freelancer${freelancerCount === 1 ? "" : "s"} can support editing, design, or campaign asset production if needed.`;
}

function average(values: number[]) {
  const filtered = values.filter((value) => Number.isFinite(value) && value > 0);
  return filtered.length ? filtered.reduce((sum, value) => sum + value, 0) / filtered.length : 0;
}
