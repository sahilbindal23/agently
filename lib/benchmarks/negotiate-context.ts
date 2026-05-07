// Builds a structured benchmark-context block for the negotiation copilot.
// Takes free-text offer description + optional explicit fields, extracts
// taxonomy, and queries the rate_benchmark_aggregates matview for matching
// market data so the AI grounds counters in real numbers.

import type { SupabaseClient } from "@supabase/supabase-js";
import { extractFromText, type ExtractedTaxonomy } from "@/lib/benchmarks/extract";
import { getEngagementAggregates, getRateAggregates, tierFromFollowers, type EngagementAggregate, type RateAggregate } from "@/lib/benchmarks/observations";

export type NegotiateInputContext = {
  offer_amount_cents?: number;
  deliverables?: string;
  contract_terms?: string;
  brand?: string;
  valuation_context?: string;
  talent_type?: "creator" | "freelancer";
  follower_count?: number;
  niche_hint?: string;
  platform_hint?: string;
};

export type BenchmarkContext = {
  extracted: ExtractedTaxonomy;
  tier: "nano" | "micro" | "mid" | "macro" | "mega" | "unknown";
  rate_matches: Array<{
    platform: string;
    niche: string;
    deliverable_type: string;
    tier: string | null;
    p25_inr: number;
    median_inr: number;
    p75_inr: number;
    observation_count: number;
    internal_deal_count: number;
  }>;
  engagement_match: { platform: string; tier: string | null; median_er_pct: number; observation_count: number } | null;
  offer_vs_market: {
    offer_inr: number;
    market_median_inr: number;
    pct_of_market: number;
    classification: "below_floor" | "below_median" | "at_market" | "above_market" | "no_data";
  } | null;
  summary: string;
};

export async function buildNegotiateContext(admin: SupabaseClient, input: NegotiateInputContext): Promise<BenchmarkContext> {
  const haystack = [input.deliverables, input.contract_terms, input.valuation_context, input.platform_hint, input.niche_hint].filter(Boolean).join(" ");
  const extracted = extractFromText(haystack);

  // Honor explicit hints if extraction failed
  const platform = extracted.platform !== "unknown" ? extracted.platform : (input.platform_hint || "unknown");
  const niche = extracted.niche !== "unknown" ? extracted.niche : (input.niche_hint || "unknown");
  const tier = tierFromFollowers(input.follower_count);

  // Pull aggregates: try most-specific match first, broaden as needed
  const allMatches: RateAggregate[] = [];
  const seen = new Set<string>();

  async function pullWithFilter(filter: Parameters<typeof getRateAggregates>[1]) {
    const rows = await getRateAggregates(admin, { ...filter, limit: 20 });
    for (const r of rows) {
      const key = `${r.platform}/${r.niche}/${r.deliverable_type}/${r.tier}/${r.city}`;
      if (seen.has(key)) continue;
      seen.add(key);
      allMatches.push(r);
    }
  }

  if (platform !== "unknown" && niche !== "unknown" && extracted.deliverable !== "unknown" && tier !== "unknown") {
    await pullWithFilter({ platform, niche, deliverable_type: extracted.deliverable, tier });
  }
  if (platform !== "unknown" && niche !== "unknown" && extracted.deliverable !== "unknown") {
    await pullWithFilter({ platform, niche, deliverable_type: extracted.deliverable });
  }
  if (platform !== "unknown" && niche !== "unknown") {
    await pullWithFilter({ platform, niche });
  }
  if (platform !== "unknown" && tier !== "unknown") {
    await pullWithFilter({ platform, tier });
  }
  if (platform !== "unknown") {
    await pullWithFilter({ platform });
  }

  const top = allMatches.slice(0, 6);

  // Engagement: tier-level if we have a tier
  let engagementMatch: BenchmarkContext["engagement_match"] = null;
  if (platform !== "unknown" && tier !== "unknown") {
    const engRows = await getEngagementAggregates(admin, { platform, tier, limit: 5 });
    const best: EngagementAggregate | undefined = engRows[0];
    if (best) {
      engagementMatch = {
        platform: best.platform,
        tier: best.tier,
        median_er_pct: Number((best.weighted_mean_pct ?? best.p50_pct).toFixed(2)),
        observation_count: best.observation_count
      };
    }
  }

  // Offer vs market classification
  let offerVsMarket: BenchmarkContext["offer_vs_market"] = null;
  if (input.offer_amount_cents && top.length) {
    const matchForOffer = top.find((m) =>
      (extracted.deliverable === "unknown" || m.deliverable_type === extracted.deliverable) &&
      (tier === "unknown" || !m.tier || m.tier === tier)
    ) ?? top[0];
    const offerInr = Math.round(input.offer_amount_cents / 100);
    const medianInr = Math.round(matchForOffer.weighted_mean_cents / 100);
    const p25Inr = Math.round(matchForOffer.p25_cents / 100);
    const p75Inr = Math.round(matchForOffer.p75_cents / 100);
    const pct = medianInr > 0 ? Math.round((offerInr / medianInr) * 100) : 0;
    let classification: NonNullable<BenchmarkContext["offer_vs_market"]>["classification"];
    if (offerInr < p25Inr) classification = "below_floor";
    else if (offerInr < medianInr) classification = "below_median";
    else if (offerInr <= p75Inr) classification = "at_market";
    else classification = "above_market";
    offerVsMarket = { offer_inr: offerInr, market_median_inr: medianInr, pct_of_market: pct, classification };
  } else if (input.offer_amount_cents && !top.length) {
    offerVsMarket = {
      offer_inr: Math.round(input.offer_amount_cents / 100),
      market_median_inr: 0,
      pct_of_market: 0,
      classification: "no_data"
    };
  }

  const summary = buildSummary({ extracted, tier, top, engagementMatch, offerVsMarket });

  return {
    extracted,
    tier,
    rate_matches: top.map((m) => ({
      platform: m.platform,
      niche: m.niche,
      deliverable_type: m.deliverable_type,
      tier: m.tier,
      p25_inr: Math.round(m.p25_cents / 100),
      median_inr: Math.round(m.weighted_mean_cents / 100),
      p75_inr: Math.round(m.p75_cents / 100),
      observation_count: m.observation_count,
      internal_deal_count: Number(m.internal_deal_count ?? 0)
    })),
    engagement_match: engagementMatch,
    offer_vs_market: offerVsMarket,
    summary
  };
}

function buildSummary({ extracted, tier, top, engagementMatch, offerVsMarket }: {
  extracted: ExtractedTaxonomy;
  tier: string;
  top: RateAggregate[];
  engagementMatch: BenchmarkContext["engagement_match"];
  offerVsMarket: BenchmarkContext["offer_vs_market"];
}) {
  if (!top.length) return "No close benchmark matches in the observations layer for this segment yet.";
  const internalCount = top.reduce((sum, m) => sum + Number(m.internal_deal_count ?? 0), 0);
  const segments = `${extracted.platform !== "unknown" ? extracted.platform : "any platform"} / ${extracted.niche !== "unknown" ? extracted.niche : "any niche"} / ${tier !== "unknown" ? tier + " tier" : "any tier"}`;
  const offerLine = offerVsMarket && offerVsMarket.classification !== "no_data"
    ? ` Offer is ${offerVsMarket.pct_of_market}% of market median (${offerVsMarket.classification.replace("_", " ")}).`
    : "";
  const erLine = engagementMatch ? ` Tier engagement baseline: ${engagementMatch.median_er_pct}%.` : "";
  return `Found ${top.length} matching benchmark cell${top.length === 1 ? "" : "s"} for ${segments}${internalCount > 0 ? ` including ${internalCount} closed Agently deal${internalCount === 1 ? "" : "s"}` : ""}.${offerLine}${erLine}`;
}
