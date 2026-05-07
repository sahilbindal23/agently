import type { SupabaseClient } from "@supabase/supabase-js";

export type BenchmarkSource = {
  id: string;
  slug: string;
  name: string;
  kind: "public_report" | "paid_dataset" | "survey" | "internal_deal" | "human_curated" | "industry_news";
  reliability_score: number;
  url: string | null;
};

export type RateObservationInput = {
  source_slug: string;
  platform: string;
  niche?: string;
  deliverable_type?: string;
  tier?: "nano" | "micro" | "mid" | "macro" | "mega" | "unknown";
  city?: string;
  market?: string;
  language?: string;
  follower_count?: number | null;
  avg_views_count?: number | null;
  amount_cents: number;
  confidence?: number;
  deal_id?: string | null;
  freelancer_project_id?: string | null;
  observed_at?: string;
  raw_metadata?: Record<string, unknown>;
  dedupe_key?: string;
};

export type EngagementObservationInput = {
  source_slug: string;
  platform: string;
  niche?: string;
  tier?: "nano" | "micro" | "mid" | "macro" | "mega" | "unknown";
  language?: string;
  follower_count?: number | null;
  engagement_rate_pct: number;
  confidence?: number;
  observed_at?: string;
  raw_metadata?: Record<string, unknown>;
  dedupe_key?: string;
};

export type RateAggregate = {
  platform: string;
  niche: string;
  deliverable_type: string;
  tier: string | null;
  city: string;
  market: string;
  observation_count: number;
  total_weight: number;
  p25_cents: number;
  p50_cents: number;
  p75_cents: number;
  weighted_mean_cents: number;
  latest_observation_at: string;
  avg_weight: number;
  internal_deal_count: number;
};

export type EngagementAggregate = {
  platform: string;
  niche: string;
  tier: string | null;
  observation_count: number;
  p25_pct: number;
  p50_pct: number;
  p75_pct: number;
  weighted_mean_pct: number;
  latest_observation_at: string;
  total_weight: number;
};

export type ConversionObservationInput = {
  source_slug: string;
  platform?: string;
  niche?: string;
  ctr_pct: number;
  conversion_rate_pct: number;
  aov_inr: number;
  confidence?: number;
  deal_id?: string | null;
  observed_at?: string;
  raw_metadata?: Record<string, unknown>;
  dedupe_key?: string;
};

export type ConversionAggregate = {
  platform: string;
  niche: string;
  observation_count: number;
  weighted_ctr_pct: number;
  weighted_conversion_rate_pct: number;
  weighted_aov_inr: number;
  p25_ctr_pct: number;
  p50_ctr_pct: number;
  p75_ctr_pct: number;
  p25_conversion_pct: number;
  p50_conversion_pct: number;
  p75_conversion_pct: number;
  latest_observation_at: string;
  internal_deal_count: number;
  total_weight: number;
};

const sourceCache = new Map<string, BenchmarkSource>();

async function resolveSource(admin: SupabaseClient, slug: string): Promise<BenchmarkSource | null> {
  const cached = sourceCache.get(slug);
  if (cached) return cached;
  const { data } = await admin.from("benchmark_sources").select("*").eq("slug", slug).maybeSingle();
  if (!data) return null;
  const source = data as BenchmarkSource;
  sourceCache.set(slug, source);
  return source;
}

export async function recordRateObservation(admin: SupabaseClient, input: RateObservationInput) {
  const source = await resolveSource(admin, input.source_slug);
  if (!source) throw new Error(`Unknown benchmark source slug: ${input.source_slug}`);

  const row = {
    source_id: source.id,
    platform: input.platform,
    niche: input.niche ?? "unknown",
    deliverable_type: input.deliverable_type ?? "unknown",
    tier: input.tier ?? "unknown",
    city: input.city ?? "unknown",
    market: input.market ?? "India",
    language: input.language ?? "unknown",
    follower_count: input.follower_count ?? null,
    avg_views_count: input.avg_views_count ?? null,
    amount_cents: input.amount_cents,
    confidence: input.confidence ?? 0.5,
    deal_id: input.deal_id ?? null,
    freelancer_project_id: input.freelancer_project_id ?? null,
    observed_at: input.observed_at ?? new Date().toISOString(),
    raw_metadata: input.raw_metadata ?? null,
    dedupe_key: input.dedupe_key ?? null
  };

  const query = input.dedupe_key
    ? admin.from("rate_observations").upsert(row, { onConflict: "dedupe_key", ignoreDuplicates: true })
    : admin.from("rate_observations").insert(row);
  const { error } = await query;
  if (error) throw new Error(`Failed to record rate observation: ${error.message}`);
}

export async function recordEngagementObservation(admin: SupabaseClient, input: EngagementObservationInput) {
  const source = await resolveSource(admin, input.source_slug);
  if (!source) throw new Error(`Unknown benchmark source slug: ${input.source_slug}`);

  const row = {
    source_id: source.id,
    platform: input.platform,
    niche: input.niche ?? "unknown",
    tier: input.tier ?? "unknown",
    language: input.language ?? "unknown",
    follower_count: input.follower_count ?? null,
    engagement_rate_pct: input.engagement_rate_pct,
    confidence: input.confidence ?? 0.5,
    observed_at: input.observed_at ?? new Date().toISOString(),
    raw_metadata: input.raw_metadata ?? null,
    dedupe_key: input.dedupe_key ?? null
  };

  const query = input.dedupe_key
    ? admin.from("engagement_observations").upsert(row, { onConflict: "dedupe_key", ignoreDuplicates: true })
    : admin.from("engagement_observations").insert(row);
  const { error } = await query;
  if (error) throw new Error(`Failed to record engagement observation: ${error.message}`);
}

export async function refreshBenchmarkAggregates(admin: SupabaseClient) {
  await admin.rpc("refresh_benchmark_aggregates").throwOnError();
}

export async function getRateAggregates(admin: SupabaseClient, filter: {
  platform?: string;
  niche?: string;
  deliverable_type?: string;
  tier?: string;
  city?: string;
  limit?: number;
}): Promise<RateAggregate[]> {
  let query = admin.from("rate_benchmark_aggregates").select("*");
  if (filter.platform) query = query.eq("platform", filter.platform);
  if (filter.niche) query = query.eq("niche", filter.niche);
  if (filter.deliverable_type) query = query.eq("deliverable_type", filter.deliverable_type);
  if (filter.tier) query = query.eq("tier", filter.tier);
  if (filter.city) query = query.eq("city", filter.city);
  query = query.order("total_weight", { ascending: false }).limit(filter.limit ?? 50);
  const { data, error } = await query;
  if (error) return [];
  return (data ?? []) as RateAggregate[];
}

export async function getEngagementAggregates(admin: SupabaseClient, filter: {
  platform?: string;
  niche?: string;
  tier?: string;
  limit?: number;
}): Promise<EngagementAggregate[]> {
  let query = admin.from("engagement_benchmark_aggregates").select("*");
  if (filter.platform) query = query.eq("platform", filter.platform);
  if (filter.niche) query = query.eq("niche", filter.niche);
  if (filter.tier) query = query.eq("tier", filter.tier);
  query = query.order("total_weight", { ascending: false }).limit(filter.limit ?? 50);
  const { data, error } = await query;
  if (error) return [];
  return (data ?? []) as EngagementAggregate[];
}

export async function recordConversionObservation(admin: SupabaseClient, input: ConversionObservationInput) {
  const source = await resolveSource(admin, input.source_slug);
  if (!source) throw new Error(`Unknown benchmark source slug: ${input.source_slug}`);

  const row = {
    source_id: source.id,
    platform: input.platform ?? "unknown",
    niche: input.niche ?? "unknown",
    ctr_pct: input.ctr_pct,
    conversion_rate_pct: input.conversion_rate_pct,
    aov_inr: input.aov_inr,
    confidence: input.confidence ?? 0.5,
    deal_id: input.deal_id ?? null,
    observed_at: input.observed_at ?? new Date().toISOString(),
    raw_metadata: input.raw_metadata ?? null,
    dedupe_key: input.dedupe_key ?? null
  };

  const query = input.dedupe_key
    ? admin.from("conversion_observations").upsert(row, { onConflict: "dedupe_key", ignoreDuplicates: true })
    : admin.from("conversion_observations").insert(row);
  const { error } = await query;
  if (error) throw new Error(`Failed to record conversion observation: ${error.message}`);
}

export async function getConversionAggregates(admin: SupabaseClient, filter: {
  platform?: string;
  niche?: string;
  limit?: number;
}): Promise<ConversionAggregate[]> {
  let query = admin.from("conversion_benchmark_aggregates").select("*");
  if (filter.platform) query = query.eq("platform", filter.platform);
  if (filter.niche) query = query.eq("niche", filter.niche);
  query = query.order("total_weight", { ascending: false }).limit(filter.limit ?? 50);
  const { data, error } = await query;
  if (error) return [];
  return (data ?? []) as ConversionAggregate[];
}

export function tierFromFollowers(followers: number | null | undefined): "nano" | "micro" | "mid" | "macro" | "mega" | "unknown" {
  if (!followers || followers <= 0) return "unknown";
  if (followers < 10_000) return "nano";
  if (followers < 100_000) return "micro";
  if (followers < 500_000) return "mid";
  if (followers < 1_000_000) return "macro";
  return "mega";
}
