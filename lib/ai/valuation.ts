export type ValuationInput = {
  platform: string;
  avg_views: number;
  followers: number;
  engagement_rate: number;
  india_audience_percent?: number;
  bangalore_fit?: number;
  niche: string;
  deliverable_type?: string;
  deliverable_count?: number;
  revisions?: number;
  turnaround_days?: number;
};

export function rulesBasedValuation(input: ValuationInput) {
  const platform = input.platform.toLowerCase();
  const deliverable = String(input.deliverable_type ?? "").toLowerCase();
  const indiaAudience = Number(input.india_audience_percent ?? 60);
  const bangaloreFit = Number(input.bangalore_fit ?? 55);
  const deliverableCount = Math.max(1, Number(input.deliverable_count ?? 1));
  let baseInr = 0;
  const adjustments: string[] = [];
  const chargeExtras: string[] = [];
  let packageRecommendation = "Creator-friendly package with clear deliverables, one revision round, and payment funded before publishing.";

  if (platform.includes("youtube")) {
    const cpv = deliverable.includes("dedicated") ? 0.9 : 0.38;
    baseInr = input.avg_views * cpv;
    if (deliverable.includes("dedicated")) baseInr *= 1.9;
    packageRecommendation = deliverable.includes("dedicated")
      ? "Dedicated YouTube video with pinned comment and one revision round. Negotiate usage rights and exclusivity separately in the offer."
      : "90-second YouTube integration with pinned comment and one revision round. Negotiate usage rights separately in the offer.";
  } else if (platform.includes("instagram")) {
    if (deliverable.includes("story")) {
      baseInr = Math.max(input.followers * 0.012 * Math.max(0.8, input.engagement_rate / 5), input.avg_views * 0.28);
      packageRecommendation = "Three-story frame package with link sticker and one revision round. Negotiate usage rights separately in the offer.";
    } else {
      baseInr = Math.max(input.avg_views * 0.65, input.followers * 0.18);
      packageRecommendation = "One Reel plus three story frames with one revision round. Negotiate usage rights and exclusivity separately in the offer.";
    }
  } else if (platform.includes("tiktok") || platform.includes("short")) {
    baseInr = Math.max(input.avg_views * 0.45, input.followers * 0.035);
    packageRecommendation = "One short-form sponsored video with one revision round. Negotiate usage rights separately in the offer.";
  } else {
    baseInr = Math.max(input.avg_views * 0.4, input.followers * 0.025);
  }

  baseInr *= deliverableCount === 1 ? 1 : 1 + (deliverableCount - 1) * 0.72;

  if (indiaAudience >= 80) {
    baseInr *= 1.18;
    adjustments.push("Strong India audience share supports a premium.");
  } else if (indiaAudience < 45) {
    baseInr *= 0.82;
    adjustments.push("India audience share is not yet strong enough for a full India-market premium.");
  }

  if (bangaloreFit >= 80) {
    baseInr *= 1.12;
    adjustments.push("Bangalore fit adds local launch value.");
  } else if (bangaloreFit < 45) {
    baseInr *= 0.9;
    adjustments.push("Bangalore relevance needs validation before pricing aggressively.");
  }

  if (input.engagement_rate >= 5) {
    baseInr *= 1.12;
    adjustments.push("High engagement rate improves sponsor confidence.");
  } else if (input.engagement_rate < 2) {
    baseInr *= 0.86;
    adjustments.push("Low engagement reduces confidence.");
  }

  const categoryMultiplier = categoryDemandMultiplier(input.niche);
  baseInr *= categoryMultiplier.multiplier;
  adjustments.push(categoryMultiplier.reason);

  // Commercial-rights multipliers (usage rights, exclusivity) intentionally
  // removed. Those are case-by-case commercial terms a creator should
  // negotiate in the offer flow, not baked into a base sponsorship
  // estimate. Keeping them in the model encouraged users to think of the
  // estimate as a final price rather than a starting band.

  const revisions = Number(input.revisions ?? 1);
  if (revisions > 1) {
    baseInr *= 1 + Math.min(0.24, (revisions - 1) * 0.08);
    chargeExtras.push("More than one revision should increase price.");
  }

  const turnaround = Number(input.turnaround_days ?? 14);
  if (turnaround > 0 && turnaround < 5) {
    baseInr *= 1.18;
    chargeExtras.push("Tight turnaround should carry a rush fee.");
  }

  const base = Math.round(baseInr * 100);
  const confidence = getConfidence(input, indiaAudience, bangaloreFit);

  return {
    low_estimate_cents: Math.round(base * 0.75),
    base_estimate_cents: base,
    high_estimate_cents: Math.round(base * 1.45),
    confidence_score: Number(confidence.toFixed(2)),
    currency: "inr",
    package_recommendation: packageRecommendation,
    negotiation_floor_cents: Math.round(base * 0.68),
    charge_extra_for: chargeExtras,
    adjustments,
    rationale: `${input.platform} ${input.deliverable_type ?? "sponsored deliverable"} estimate based on Indian market heuristics: average views, followers, engagement, ${indiaAudience}% India audience, ${bangaloreFit}/100 Bangalore fit, category demand, revision rounds, and turnaround. Commercial-rights terms (usage, paid usage, exclusivity) are excluded - those should be negotiated case-by-case in the offer. This is a starting band until Agently has enough closed Bangalore/India deal outcomes to calibrate the model.`
  };
}

function categoryDemandMultiplier(niche: string) {
  const value = niche.toLowerCase();
  if (value.includes("fintech") || value.includes("finance")) return { multiplier: 1.28, reason: "Fintech and finance categories usually support higher CAC-backed budgets." };
  if (value.includes("beauty") || value.includes("fashion")) return { multiplier: 1.15, reason: "Fashion and beauty have strong creator-commerce fit in Indian metros." };
  if (value.includes("gaming") || value.includes("tech")) return { multiplier: 1.12, reason: "Gaming and tech can pay well when purchase intent is clear." };
  if (value.includes("food") || value.includes("cafe") || value.includes("restaurant")) return { multiplier: 0.92, reason: "Local food and cafe campaigns can be valuable but are often budget-sensitive." };
  if (value.includes("education") || value.includes("career")) return { multiplier: 1.08, reason: "Education and career brands can pay when lead quality is strong." };
  return { multiplier: 1, reason: "Category demand set to neutral until more closed deal data is available." };
}

function getConfidence(input: ValuationInput, indiaAudience: number, bangaloreFit: number) {
  let confidence = 0.48;
  if (input.avg_views > 0) confidence += 0.12;
  if (input.followers > 0) confidence += 0.08;
  if (input.engagement_rate > 0) confidence += 0.08;
  if (indiaAudience >= 60) confidence += 0.08;
  if (bangaloreFit >= 60) confidence += 0.08;
  if (input.deliverable_type) confidence += 0.04;
  return Math.min(0.86, confidence);
}
