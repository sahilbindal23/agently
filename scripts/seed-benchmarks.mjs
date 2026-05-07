#!/usr/bin/env node
// Seed the rate_observations + engagement_observations tables from
// data/benchmarks/india-creator-benchmarks.json. Idempotent via dedupe_key.
//
// Usage:  node scripts/seed-benchmarks.mjs
// Requires: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY in env.

import { readFileSync } from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in env.");
  process.exit(1);
}

const admin = createClient(url, key, { auth: { persistSession: false } });
const file = JSON.parse(readFileSync(path.resolve("data/benchmarks/india-creator-benchmarks.json"), "utf-8"));

// Map source flags from JSON to benchmark_sources slugs
function sourceSlugFor(row) {
  if (row.source === "verified" && /qoruz/i.test(row.source_url ?? "")) return "qoruz_2025";
  if (row.source === "verified" && /buzzincontent|groupm.?inca/i.test(row.source_url ?? "")) return "groupm_inca_2022";
  if (row.source === "verified" && /bcg/i.test(row.source_url ?? "")) return "bcg_waves_2025";
  if (row.source === "verified") return "qoruz_2025";
  if (row.source === "estimated") return "india_priors_v1";
  return "india_priors_v1";
}

function tierFromName(tier) {
  return ["nano", "micro", "mid", "macro", "mega"].includes(tier) ? tier : "unknown";
}

// Resolve source ids
const { data: sources, error: srcErr } = await admin.from("benchmark_sources").select("id, slug");
if (srcErr) { console.error(srcErr); process.exit(1); }
const sourceIdBySlug = new Map(sources.map((s) => [s.slug, s.id]));

let rateInserts = 0, engInserts = 0, skipped = 0;

// 1. rate_cards → rate_observations (one per row using median_inr, with p25/p75 metadata)
for (const card of file.rate_cards ?? []) {
  const sourceId = sourceIdBySlug.get(sourceSlugFor(card));
  if (!sourceId) { skipped++; continue; }
  const dedupeKey = `seed:rate:${card.platform}/${card.tier}/${card.niche}/${card.deliverable_type}/${card.source}`;
  const confidence = card.source === "verified" ? 0.85 : card.source === "estimated" ? 0.30 : 0.50;
  const { error } = await admin.from("rate_observations").upsert({
    source_id: sourceId,
    platform: card.platform === "instagram" ? "Instagram" : card.platform === "youtube" ? "YouTube" : card.platform === "twitter" ? "Twitter" : card.platform,
    niche: card.niche,
    deliverable_type: card.deliverable_type,
    tier: tierFromName(card.tier),
    city: "unknown",
    market: "India",
    amount_cents: Math.round(Number(card.median_inr ?? 0) * 100),
    confidence,
    dedupe_key: dedupeKey,
    raw_metadata: {
      seed_source: "india-creator-benchmarks.json",
      original_source_flag: card.source,
      original_source_url: card.source_url,
      low_inr: card.low_inr,
      high_inr: card.high_inr,
      notes: card.notes
    }
  }, { onConflict: "dedupe_key", ignoreDuplicates: true });
  if (error) console.error("rate insert err:", error.message);
  else rateInserts++;
}

// 2. engagement_benchmarks (niche-level) → engagement_observations
for (const eng of file.engagement_benchmarks ?? []) {
  const sourceId = sourceIdBySlug.get(sourceSlugFor(eng));
  if (!sourceId) { skipped++; continue; }
  const dedupeKey = `seed:eng:${eng.platform}/${eng.tier}/${eng.niche}/${eng.source}`;
  const confidence = eng.source === "verified" ? 0.85 : eng.source === "estimated" ? 0.30 : 0.50;
  const { error } = await admin.from("engagement_observations").upsert({
    source_id: sourceId,
    platform: eng.platform === "instagram" ? "Instagram" : eng.platform === "youtube" ? "YouTube" : eng.platform === "twitter" ? "Twitter" : eng.platform,
    niche: eng.niche,
    tier: tierFromName(eng.tier),
    engagement_rate_pct: Number(eng.median_er_pct ?? 0),
    confidence,
    dedupe_key: dedupeKey,
    raw_metadata: {
      seed_source: "india-creator-benchmarks.json",
      original_source_flag: eng.source,
      p25_pct: eng.p25_er_pct,
      p75_pct: eng.p75_er_pct,
      notes: eng.notes
    }
  }, { onConflict: "dedupe_key", ignoreDuplicates: true });
  if (error) console.error("eng insert err:", error.message);
  else engInserts++;
}

// 3. verified_tier_engagement_qoruz_2025 → high-confidence engagement observations
const qoruz = file.verified_tier_engagement_qoruz_2025;
if (qoruz) {
  const qoruzId = sourceIdBySlug.get("qoruz_2025");
  if (qoruzId) {
    for (const platform of ["instagram", "youtube", "twitter"]) {
      const platformLabel = platform === "instagram" ? "Instagram" : platform === "youtube" ? "YouTube" : "Twitter";
      for (const row of qoruz[platform] ?? []) {
        const dedupeKey = `seed:qoruz_tier_eng:${platform}/${row.tier}`;
        const { error } = await admin.from("engagement_observations").upsert({
          source_id: qoruzId,
          platform: platformLabel,
          niche: "all",
          tier: tierFromName(row.tier),
          engagement_rate_pct: Number(row.median_er_pct),
          confidence: 0.90,
          observed_at: qoruz.publication_date ? new Date(qoruz.publication_date).toISOString() : new Date().toISOString(),
          dedupe_key: dedupeKey,
          raw_metadata: { seed_source: "verified_tier_engagement_qoruz_2025", verified_at: qoruz.verified_at }
        }, { onConflict: "dedupe_key", ignoreDuplicates: true });
        if (error) console.error("qoruz tier eng insert err:", error.message);
        else engInserts++;
      }
    }
  }
}

// 4. Refresh the materialized views
const { error: refreshErr } = await admin.rpc("refresh_benchmark_aggregates");
if (refreshErr) console.error("refresh err:", refreshErr.message);

console.log(JSON.stringify({ rate_observations_seeded: rateInserts, engagement_observations_seeded: engInserts, skipped, refreshed: !refreshErr }, null, 2));
