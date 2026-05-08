// Guardrails for benchmark observations. Runs at write time on every
// rate_observation insert to prevent the self-learning loop from death-
// spiraling on outliers, manipulation, or anchor confirmation.
//
// Failure modes defended against:
//   1. Outlier poisoning - one extreme deal pulls the median in a thin cell
//   2. Anchor confirmation - brand offers at our suggestion, deal closes,
//      we "learn" our own output as ground truth
//   3. Race to bottom - cheap deals only, suggestions drop, cycle continues
//   4. Single-actor manipulation - one brand floods their own benchmark
//   5. Sparse-cell over-confidence - 1 observation reads as "market data"
//
// Each new observation gets a verdict: accept, flag, or reject. Flagged
// observations land in benchmark_anomalies for admin review and are
// excluded from public-source aggregations but still kept for internal-deal
// audits.

import type { SupabaseClient } from "@supabase/supabase-js";

export type GuardrailVerdict = {
  status: "normal" | "flagged" | "rejected";
  reasons: string[];
  baseline_median_cents: number | null;
  deviation_factor: number | null;
  confidence_adjustment: number; // multiplier in [0, 1] applied to incoming confidence
  severity: "low" | "medium" | "high";
};

export type RateObservationCandidate = {
  platform: string;
  niche: string;
  deliverable_type: string;
  tier: "nano" | "micro" | "mid" | "macro" | "mega" | "unknown";
  amount_cents: number;
  source_slug: string;
  brand_id?: string | null;
  raw_metadata?: Record<string, unknown> | null;
};

// Per-tier hard bounds in INR. Anything outside these is structurally
// suspicious — likely a data entry error or manipulation. Reject outright.
// Numbers are wide on purpose: we want to catch order-of-magnitude errors,
// not fine-grained pricing variation.
const TIER_BOUNDS_INR: Record<string, { min: number; max: number }> = {
  nano:   { min: 200,    max: 500_000 },        // 200 INR to 5 lakh
  micro:  { min: 1_000,  max: 2_000_000 },      // 1k to 20 lakh
  mid:    { min: 10_000, max: 8_000_000 },      // 10k to 80 lakh
  macro:  { min: 50_000, max: 25_000_000 },     // 50k to 2.5 cr
  mega:   { min: 200_000, max: 100_000_000 },   // 2 lakh to 10 cr
  unknown:{ min: 100,    max: 100_000_000 }     // very wide for unknown tier
};

// Std-dev multiplier above which we flag (not reject) outliers
const STD_DEV_FLAG_THRESHOLD = 3;

// Frequency cap: max observations per (source_brand, niche, tier) per 7 days.
// Prevents one brand pumping their own benchmark.
const PER_BRAND_WEEKLY_CAP = 5;

// Anchor match: if observation is within this % of our existing weighted_mean,
// flag it as potential anchor-confirmation and reduce confidence.
const ANCHOR_MATCH_PCT = 0.05; // within 5%

export async function evaluateRateObservation(
  admin: SupabaseClient,
  candidate: RateObservationCandidate
): Promise<GuardrailVerdict> {
  const reasons: string[] = [];
  let status: "normal" | "flagged" | "rejected" = "normal";
  let confidenceAdjustment = 1.0;
  let severity: "low" | "medium" | "high" = "low";

  const amountInr = candidate.amount_cents / 100;

  // 1. Hard tier bounds (reject)
  const bounds = TIER_BOUNDS_INR[candidate.tier] ?? TIER_BOUNDS_INR.unknown;
  if (amountInr < bounds.min) {
    reasons.push(`Below tier hard floor (₹${bounds.min} for ${candidate.tier})`);
    status = "rejected";
    severity = "high";
  } else if (amountInr > bounds.max) {
    reasons.push(`Above tier hard ceiling (₹${bounds.max} for ${candidate.tier})`);
    status = "rejected";
    severity = "high";
  }

  // 2. Outlier vs existing matview baseline (only if we have data to compare)
  let baselineMedianCents: number | null = null;
  let deviationFactor: number | null = null;
  if (status !== "rejected") {
    const { data: agg } = await admin
      .from("rate_benchmark_aggregates")
      .select("p50_cents, p25_cents, p75_cents, observation_count")
      .eq("platform", candidate.platform)
      .eq("niche", candidate.niche)
      .eq("tier", candidate.tier)
      .maybeSingle();
    if (agg && Number(agg.observation_count ?? 0) >= 5) {
      baselineMedianCents = Number(agg.p50_cents);
      const iqr = Math.max(1, Number(agg.p75_cents) - Number(agg.p25_cents));
      // Approximate std dev from IQR (IQR ≈ 1.349 σ for normal)
      const approxStdDev = iqr / 1.349;
      const distance = Math.abs(candidate.amount_cents - baselineMedianCents);
      deviationFactor = distance / Math.max(1, approxStdDev);
      if (deviationFactor > STD_DEV_FLAG_THRESHOLD) {
        reasons.push(`${deviationFactor.toFixed(1)}σ from existing median (₹${Math.round(baselineMedianCents / 100).toLocaleString("en-IN")} based on ${agg.observation_count} observations)`);
        status = "flagged";
        severity = severity === "low" ? "medium" : severity;
        confidenceAdjustment = Math.min(confidenceAdjustment, 0.3);
      }

      // 3. Anchor match check: deal closed at almost exactly our suggested median
      // Only meaningful when this is an internal_deal observation
      if (candidate.source_slug === "internal_deal" && baselineMedianCents > 0) {
        const pctDelta = Math.abs(candidate.amount_cents - baselineMedianCents) / baselineMedianCents;
        if (pctDelta <= ANCHOR_MATCH_PCT) {
          reasons.push(`Deal closed within ${(ANCHOR_MATCH_PCT * 100).toFixed(0)}% of our suggested median — likely anchor confirmation, weight reduced`);
          confidenceAdjustment = Math.min(confidenceAdjustment, 0.6);
          if (status === "normal") status = "flagged";
        }
      }
    }
  }

  // 4. Per-brand weekly frequency cap (only relevant for internal_deal where we know the brand)
  if (status !== "rejected" && candidate.source_slug === "internal_deal" && candidate.brand_id) {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    // Count observations from this brand for this cell in last 7 days
    // raw_metadata.brand_id is where we stored it in internal-deals.ts
    const { count } = await admin
      .from("rate_observations")
      .select("id", { count: "exact", head: true })
      .eq("platform", candidate.platform)
      .eq("niche", candidate.niche)
      .eq("tier", candidate.tier)
      .gte("observed_at", sevenDaysAgo)
      .filter("raw_metadata->>brand_id", "eq", candidate.brand_id);
    const weeklyCount = Number(count ?? 0);
    if (weeklyCount >= PER_BRAND_WEEKLY_CAP) {
      reasons.push(`Brand exceeded ${PER_BRAND_WEEKLY_CAP}/week cap for this cell (${weeklyCount} prior observations) — flagged for review`);
      status = "flagged";
      severity = "high";
      confidenceAdjustment = Math.min(confidenceAdjustment, 0.2);
    }
  }

  return {
    status,
    reasons,
    baseline_median_cents: baselineMedianCents,
    deviation_factor: deviationFactor,
    confidence_adjustment: confidenceAdjustment,
    severity
  };
}

// Records an anomaly row when guardrails flag or reject an observation.
// Called from recordRateObservation after the observation is inserted (or
// known to be skipped).
export async function recordAnomaly(
  admin: SupabaseClient,
  params: {
    observation_id: string | null;
    verdict: GuardrailVerdict;
    candidate: RateObservationCandidate;
  }
) {
  const { verdict, candidate, observation_id } = params;
  if (verdict.status === "normal") return;
  await admin.from("benchmark_anomalies").insert({
    observation_id,
    observation_kind: "rate_observation",
    reason: verdict.reasons.join("; "),
    severity: verdict.severity,
    amount_cents: candidate.amount_cents,
    baseline_median_cents: verdict.baseline_median_cents,
    deviation_factor: verdict.deviation_factor,
    source_slug: candidate.source_slug
  }).then((res) => {
    if (res.error) console.error("[guardrails] anomaly insert failed", res.error);
  });
}

export const GUARDRAIL_CONSTANTS = {
  TIER_BOUNDS_INR,
  STD_DEV_FLAG_THRESHOLD,
  PER_BRAND_WEEKLY_CAP,
  ANCHOR_MATCH_PCT
};
