import type { SupabaseClient } from "@supabase/supabase-js";
import type { ValuationInput } from "@/lib/ai/valuation";

export type RateBenchmark = {
  id: string;
  platform: string;
  niche: string;
  deliverable_type: string;
  city: string;
  market: string;
  follower_min: number | null;
  follower_max: number | null;
  avg_view_min: number | null;
  avg_view_max: number | null;
  low_cents: number;
  base_cents: number;
  high_cents: number;
  source_type: string;
  source_label: string | null;
  confidence_score: number;
  notes: string | null;
  created_at?: string;
};

export type BenchmarkBlend = {
  blended_low_estimate_cents: number;
  blended_base_estimate_cents: number;
  blended_high_estimate_cents: number;
  benchmark_confidence_score: number;
  benchmark_match_count: number;
  benchmark_summary: string;
  matched_benchmarks: Array<{
    id: string;
    platform: string;
    niche: string;
    deliverable_type: string;
    city: string;
    low_cents: number;
    base_cents: number;
    high_cents: number;
    confidence_score: number;
    source_label: string | null;
  }>;
};

type EstimateBand = {
  low_estimate_cents: number;
  base_estimate_cents: number;
  high_estimate_cents: number;
  confidence_score?: number;
};

export async function getRateBenchmarks(admin: SupabaseClient | null, limit = 250) {
  if (!admin) return [] as RateBenchmark[];

  try {
    const { data } = await admin
      .from("rate_benchmarks")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(limit);
    return (data ?? []) as RateBenchmark[];
  } catch {
    return [] as RateBenchmark[];
  }
}

export async function getBenchmarkBlend(admin: SupabaseClient | null, input: ValuationInput, rulesEstimate: EstimateBand) {
  const benchmarks = await getRateBenchmarks(admin, 500);
  const matches = benchmarks
    .map((benchmark) => ({ benchmark, score: benchmarkMatchScore(benchmark, input) }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);

  if (!matches.length) return null;

  const totalWeight = matches.reduce((sum, item) => sum + item.score * Number(item.benchmark.confidence_score ?? 0.5), 0);
  const weighted = (key: "low_cents" | "base_cents" | "high_cents") => {
    if (!totalWeight) return 0;
    return Math.round(matches.reduce((sum, item) => {
      const confidence = Number(item.benchmark.confidence_score ?? 0.5);
      return sum + Number(item.benchmark[key] ?? 0) * item.score * confidence;
    }, 0) / totalWeight);
  };
  const benchmarkLow = weighted("low_cents");
  const benchmarkBase = weighted("base_cents");
  const benchmarkHigh = weighted("high_cents");
  const benchmarkConfidence = Math.min(0.9, matches.reduce((sum, item) => sum + Number(item.benchmark.confidence_score ?? 0), 0) / matches.length);
  const rulesWeight = 0.55;
  const benchmarkWeight = Math.min(0.7, Math.max(0.35, benchmarkConfidence));

  return {
    blended_low_estimate_cents: blend(rulesEstimate.low_estimate_cents, benchmarkLow, rulesWeight, benchmarkWeight),
    blended_base_estimate_cents: blend(rulesEstimate.base_estimate_cents, benchmarkBase, rulesWeight, benchmarkWeight),
    blended_high_estimate_cents: blend(rulesEstimate.high_estimate_cents, benchmarkHigh, rulesWeight, benchmarkWeight),
    benchmark_confidence_score: Number(benchmarkConfidence.toFixed(2)),
    benchmark_match_count: matches.length,
    benchmark_summary: `Matched ${matches.length} benchmark${matches.length === 1 ? "" : "s"} for ${input.platform || "platform"} / ${input.niche || "niche"} / ${input.deliverable_type || "deliverable"} in India-first markets.`,
    matched_benchmarks: matches.map(({ benchmark }) => ({
      id: benchmark.id,
      platform: benchmark.platform,
      niche: benchmark.niche,
      deliverable_type: benchmark.deliverable_type,
      city: benchmark.city,
      low_cents: benchmark.low_cents,
      base_cents: benchmark.base_cents,
      high_cents: benchmark.high_cents,
      confidence_score: Number(benchmark.confidence_score ?? 0),
      source_label: benchmark.source_label
    }))
  } satisfies BenchmarkBlend;
}

function benchmarkMatchScore(benchmark: RateBenchmark, input: ValuationInput) {
  let score = 0;
  const platform = normalize(input.platform);
  const niche = normalize(input.niche);
  const deliverable = normalize(input.deliverable_type ?? "");
  const city = Number(input.bangalore_fit ?? 0) > 0 ? "bengaluru" : "";
  const benchmarkPlatform = normalize(benchmark.platform);
  const benchmarkNiche = normalize(benchmark.niche);
  const benchmarkDeliverable = normalize(benchmark.deliverable_type);

  if (platform && (benchmarkPlatform.includes(platform) || platform.includes(benchmarkPlatform))) score += 4;
  if (niche && keywordOverlap(benchmarkNiche, niche)) score += 4;
  if (deliverable && keywordOverlap(benchmarkDeliverable, deliverable)) score += 3;
  if (normalize(benchmark.market).includes("india")) score += 1;
  if (["bengaluru", "bangalore"].includes(normalize(benchmark.city)) && (city || Number(input.bangalore_fit ?? 0) >= 45)) score += 1;

  const followers = Number(input.followers ?? 0);
  const avgViews = Number(input.avg_views ?? 0);
  if (followers && inRange(followers, benchmark.follower_min, benchmark.follower_max)) score += 2;
  if (avgViews && inRange(avgViews, benchmark.avg_view_min, benchmark.avg_view_max)) score += 3;
  if (score < 5) return 0;
  return score;
}

function blend(rulesValue: number, benchmarkValue: number, rulesWeight: number, benchmarkWeight: number) {
  if (!benchmarkValue) return rulesValue;
  return Math.round((rulesValue * rulesWeight + benchmarkValue * benchmarkWeight) / (rulesWeight + benchmarkWeight));
}

function inRange(value: number, min: number | null, max: number | null) {
  const aboveMin = min === null || min === undefined || value >= min;
  const belowMax = max === null || max === undefined || value <= max;
  return aboveMin && belowMax;
}

function normalize(value: string) {
  return String(value ?? "").trim().toLowerCase();
}

function keywordOverlap(a: string, b: string) {
  const aTokens = new Set(a.split(/[^a-z0-9]+/).filter((token) => token.length > 2));
  return b.split(/[^a-z0-9]+/).filter((token) => token.length > 2).some((token) => aTokens.has(token));
}
