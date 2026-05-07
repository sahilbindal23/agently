// Brand-side ROI projection. Combines:
//   1. Rate aggregates → expected campaign cost
//   2. Engagement aggregates → expected ER → expected impressions/reach
//   3. Conversion aggregates → CTR × CR × AOV → expected revenue
// Returns conservative (p25), expected (median), and optimistic (p75) scenarios.

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  getConversionAggregates,
  getEngagementAggregates,
  getRateAggregates,
  tierFromFollowers,
  type ConversionAggregate,
  type EngagementAggregate,
  type RateAggregate
} from "@/lib/benchmarks/observations";

export type RoiInput = {
  platform: string;
  niche: string;
  deliverable_type?: string;
  follower_count: number;
  /** How many of this deliverable the brand wants */
  deliverable_count?: number;
  /** Override cost if brand has a fixed offer they want to evaluate */
  fixed_cost_inr?: number;
  /** Override AOV if the brand knows their own */
  brand_aov_inr?: number;
  /** Reach-to-followers ratio override (default depends on platform) */
  reach_ratio?: number;
};

export type RoiScenario = {
  cost_inr: number;
  expected_reach: number;
  expected_engagement: number;
  expected_clicks: number;
  expected_conversions: number;
  expected_revenue_inr: number;
  roi_multiplier: number;
  net_inr: number;
};

export type RoiProjection = {
  conservative: RoiScenario;
  expected: RoiScenario;
  optimistic: RoiScenario;
  inputs_used: {
    platform: string;
    niche: string;
    tier: string;
    deliverable_type: string;
    deliverable_count: number;
    follower_count: number;
    rate_source: "internal_deal" | "observation_aggregate" | "fixed_input" | "no_data";
    engagement_source: "observation_aggregate" | "default";
    conversion_source: "observation_aggregate" | "default";
  };
  caveats: string[];
  matched_cells: {
    rate?: { p25: number; median: number; p75: number; observation_count: number; internal_deal_count: number };
    engagement?: { p25_pct: number; median_pct: number; p75_pct: number; observation_count: number };
    conversion?: { ctr_pct: number; conversion_rate_pct: number; aov_inr: number; observation_count: number };
  };
};

// Default reach-to-followers ratios when no engagement data is available
const DEFAULT_REACH_RATIO: Record<string, number> = {
  Instagram: 0.35, // ~35% of followers see organic posts on average
  YouTube: 0.30,
  Twitter: 0.20,
  LinkedIn: 0.25,
  TikTok: 0.50,
  Regional: 0.40
};

export async function projectROI(admin: SupabaseClient, input: RoiInput): Promise<RoiProjection> {
  const tier = tierFromFollowers(input.follower_count);
  const deliverableCount = Math.max(1, Number(input.deliverable_count ?? 1));
  const platform = input.platform;
  const niche = input.niche;
  const deliverableType = input.deliverable_type || "reel";
  const caveats: string[] = [];

  // 1. Rate lookup (cost)
  let rateMatches: RateAggregate[] = [];
  if (!input.fixed_cost_inr) {
    rateMatches = await getRateAggregates(admin, { platform, niche, deliverable_type: deliverableType, tier, limit: 5 });
    if (!rateMatches.length) rateMatches = await getRateAggregates(admin, { platform, niche, tier, limit: 5 });
    if (!rateMatches.length) rateMatches = await getRateAggregates(admin, { platform, niche, limit: 5 });
    if (!rateMatches.length) rateMatches = await getRateAggregates(admin, { platform, tier, limit: 5 });
  }
  const rateMatch = rateMatches[0];
  const rateSource: RoiProjection["inputs_used"]["rate_source"] = input.fixed_cost_inr
    ? "fixed_input"
    : rateMatch
    ? (Number(rateMatch.internal_deal_count ?? 0) > 0 ? "internal_deal" : "observation_aggregate")
    : "no_data";

  // 2. Engagement lookup (reach × ER)
  let engagementMatches: EngagementAggregate[] = await getEngagementAggregates(admin, { platform, niche, tier, limit: 5 });
  if (!engagementMatches.length) engagementMatches = await getEngagementAggregates(admin, { platform, tier, limit: 5 });
  if (!engagementMatches.length) engagementMatches = await getEngagementAggregates(admin, { platform, niche: "all", tier, limit: 5 });
  const erMatch = engagementMatches[0];
  const engagementSource: RoiProjection["inputs_used"]["engagement_source"] = erMatch ? "observation_aggregate" : "default";

  // 3. Conversion lookup (CTR × CR × AOV)
  let conversionMatches: ConversionAggregate[] = await getConversionAggregates(admin, { platform, niche, limit: 3 });
  if (!conversionMatches.length) conversionMatches = await getConversionAggregates(admin, { niche, limit: 3 });
  if (!conversionMatches.length) conversionMatches = await getConversionAggregates(admin, { platform, limit: 3 });
  const convMatch = conversionMatches[0];
  const conversionSource: RoiProjection["inputs_used"]["conversion_source"] = convMatch ? "observation_aggregate" : "default";

  // Reach assumptions
  const reachRatio = input.reach_ratio ?? DEFAULT_REACH_RATIO[platform] ?? 0.30;
  const expectedReach = Math.round(input.follower_count * reachRatio * deliverableCount);

  // Build three scenarios using p25/median/p75 of the underlying aggregates
  const buildScenario = (multiplier: "conservative" | "expected" | "optimistic"): RoiScenario => {
    const costInr = input.fixed_cost_inr
      ? input.fixed_cost_inr * deliverableCount
      : rateMatch
      ? Math.round((multiplier === "conservative" ? rateMatch.p75_cents : multiplier === "optimistic" ? rateMatch.p25_cents : rateMatch.weighted_mean_cents) * deliverableCount / 100)
      : Math.round(input.follower_count * 0.5 * deliverableCount);

    const erPct = erMatch
      ? (multiplier === "conservative" ? erMatch.p25_pct : multiplier === "optimistic" ? erMatch.p75_pct : erMatch.weighted_mean_pct)
      : (multiplier === "conservative" ? 1.5 : multiplier === "optimistic" ? 4.0 : 2.5);

    const ctrPct = convMatch
      ? (multiplier === "conservative" ? convMatch.p25_ctr_pct : multiplier === "optimistic" ? convMatch.p75_ctr_pct : convMatch.weighted_ctr_pct)
      : (multiplier === "conservative" ? 0.8 : multiplier === "optimistic" ? 2.5 : 1.5);

    const conversionRatePct = convMatch
      ? (multiplier === "conservative" ? convMatch.p25_conversion_pct : multiplier === "optimistic" ? convMatch.p75_conversion_pct : convMatch.weighted_conversion_rate_pct)
      : (multiplier === "conservative" ? 0.5 : multiplier === "optimistic" ? 3.0 : 1.5);

    const aovInr = input.brand_aov_inr ?? convMatch?.weighted_aov_inr ?? 1500;

    const expectedEngagement = Math.round(expectedReach * (erPct / 100));
    const expectedClicks = Math.round(expectedReach * (ctrPct / 100));
    const expectedConversions = Math.round(expectedClicks * (conversionRatePct / 100));
    const expectedRevenueInr = expectedConversions * aovInr;
    const roiMultiplier = costInr > 0 ? Number((expectedRevenueInr / costInr).toFixed(2)) : 0;

    return {
      cost_inr: costInr,
      expected_reach: expectedReach,
      expected_engagement: expectedEngagement,
      expected_clicks: expectedClicks,
      expected_conversions: expectedConversions,
      expected_revenue_inr: expectedRevenueInr,
      roi_multiplier: roiMultiplier,
      net_inr: expectedRevenueInr - costInr
    };
  };

  if (rateSource === "no_data") caveats.push("No rate benchmark match — cost is rough estimate from follower count. Provide a fixed offer or wait for more data.");
  if (engagementSource === "default") caveats.push("No engagement benchmark match — using platform defaults (1.5–4% ER range).");
  if (conversionSource === "default") caveats.push("No conversion funnel data — using platform defaults (CTR 0.8–2.5%, conversion 0.5–3%).");
  if (!input.brand_aov_inr && !convMatch) caveats.push("AOV defaulted to ₹1,500. Pass brand_aov_inr for a more accurate revenue projection.");
  if (rateSource === "internal_deal") caveats.push("Cost benchmark includes closed Agently deal data — highest signal available.");

  return {
    conservative: buildScenario("conservative"),
    expected: buildScenario("expected"),
    optimistic: buildScenario("optimistic"),
    inputs_used: {
      platform,
      niche,
      tier,
      deliverable_type: deliverableType,
      deliverable_count: deliverableCount,
      follower_count: input.follower_count,
      rate_source: rateSource,
      engagement_source: engagementSource,
      conversion_source: conversionSource
    },
    caveats,
    matched_cells: {
      rate: rateMatch ? {
        p25: Math.round(rateMatch.p25_cents / 100),
        median: Math.round(rateMatch.weighted_mean_cents / 100),
        p75: Math.round(rateMatch.p75_cents / 100),
        observation_count: rateMatch.observation_count,
        internal_deal_count: Number(rateMatch.internal_deal_count ?? 0)
      } : undefined,
      engagement: erMatch ? {
        p25_pct: Number(erMatch.p25_pct.toFixed(2)),
        median_pct: Number(erMatch.weighted_mean_pct.toFixed(2)),
        p75_pct: Number(erMatch.p75_pct.toFixed(2)),
        observation_count: erMatch.observation_count
      } : undefined,
      conversion: convMatch ? {
        ctr_pct: Number(convMatch.weighted_ctr_pct.toFixed(2)),
        conversion_rate_pct: Number(convMatch.weighted_conversion_rate_pct.toFixed(2)),
        aov_inr: convMatch.weighted_aov_inr,
        observation_count: convMatch.observation_count
      } : undefined
    }
  };
}
