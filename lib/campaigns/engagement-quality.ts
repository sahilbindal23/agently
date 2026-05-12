// Engagement-quality and real-audience scoring.
//
// The product bet here: bought followers and engagement pods are a real
// problem in the Indian creator market, and a marketplace that can flag
// them is more useful to brands than one that just ranks raw follower
// counts. So we add two computed dimensions to the ranking engine:
//
//   1. audience_fit (V2)        — blends Phyllo demographics (geo, city,
//                                  age range) with the legacy topic
//                                  keyword overlap. Real demographic
//                                  match scored higher than keyword
//                                  match when snapshots exist.
//   2. engagement_quality (new) — anti-bot health score from three
//                                  sub-signals: ER vs follower-tier
//                                  sanity, view-to-follower ratio,
//                                  engagement consistency across
//                                  historical snapshots.
//
// Both work off social_metric_snapshots rows. When a creator has no
// snapshots (fresh sign-up before Phyllo sync), we fall back to legacy
// behavior so they aren't ranked into oblivion on day 1.

import type { Campaign, Creator } from "@/types";

export type SocialMetricSnapshot = {
  creator_id: string | null;
  provider: string;
  followers: number;
  avg_views_30d: number;
  engagement_rate_30d: number;
  india_audience_percent: number;
  bangalore_audience_percent: number;
  top_cities: string[];
  audience_age_range: string | null;
  synced_at: string;
};

// Pick the most recent snapshot per provider for a creator. The history
// stays available for variance/consistency calculations.
export function latestPerProvider(snapshots: SocialMetricSnapshot[]): SocialMetricSnapshot[] {
  const byProvider = new Map<string, SocialMetricSnapshot>();
  for (const snap of snapshots) {
    const existing = byProvider.get(snap.provider);
    if (!existing || new Date(snap.synced_at).getTime() > new Date(existing.synced_at).getTime()) {
      byProvider.set(snap.provider, snap);
    }
  }
  return Array.from(byProvider.values());
}

// ============================================================================
// audience_fit V2
// ============================================================================

/**
 * Score how well a creator's actual audience matches the campaign brief.
 *
 * When snapshots are available: 70% demographic match + 30% topic keyword.
 * When snapshots are missing:   100% topic keyword (legacy behavior).
 *
 * Returned score is 35-95 so it's comparable to the other breakdown values.
 */
export function audienceFitScore(params: {
  campaign: Campaign;
  creator: Creator;
  snapshots: SocialMetricSnapshot[];
  topicKeywordHit: boolean;
}): number {
  const topicScore = params.topicKeywordHit ? 82 : 52;
  const latest = latestPerProvider(params.snapshots);
  if (!latest.length) return topicScore;

  // Average demographic signals across providers — a creator who has
  // strong India audience on YouTube but not Instagram still gets credit.
  const indiaAudience = avg(latest.map((s) => s.india_audience_percent));
  const bangaloreAudience = avg(latest.map((s) => s.bangalore_audience_percent));
  const allTopCities = latest.flatMap((s) => s.top_cities ?? []).map((c) => c.toLowerCase());

  // India focus is implicit for every Agently campaign (we're India-first).
  // Score linearly: 0% audience → 35, 50% → ~65, 80%+ → ~90.
  const indiaScore = clamp(35 + indiaAudience * 0.7, 35, 95);

  // City overlap: if the campaign has a specific city focus that maps to
  // a real city, check whether the creator's audience is concentrated
  // there. Otherwise this signal is neutral.
  const cityFocus = (params.campaign.city_focus || "").toLowerCase().trim();
  let cityScore = 70;
  if (cityFocus) {
    const isBangaloreCampaign = cityFocus.includes("bangalore") || cityFocus.includes("bengaluru") || cityFocus.includes("blr");
    if (isBangaloreCampaign && bangaloreAudience > 0) {
      cityScore = clamp(35 + bangaloreAudience * 0.9, 35, 95);
    } else if (allTopCities.some((c) => c.includes(cityFocus) || cityFocus.includes(c))) {
      cityScore = 85;
    } else if (allTopCities.length) {
      cityScore = 55;
    }
  }

  // Age range overlap: campaigns often hint at a target age in the
  // target_audience text ("18-34", "Gen Z", "millennials"). Match
  // against the creator's snapshot audience_age_range. Soft signal —
  // contributes when both sides have data.
  const ageScore = ageRangeOverlapScore(params.campaign.target_audience, latest);

  // Demographic blend: India weighted most heavily, then city, then age.
  const demographicScore = (indiaScore * 0.55) + (cityScore * 0.25) + (ageScore * 0.20);

  // Final blend: 70% real demographics, 30% topic keyword.
  return Math.round(clamp(demographicScore * 0.7 + topicScore * 0.3, 35, 95));
}

function ageRangeOverlapScore(targetAudienceText: string, latest: SocialMetricSnapshot[]): number {
  const text = (targetAudienceText || "").toLowerCase();
  if (!text) return 70;
  const targetBuckets = extractAgeBucketsFromText(text);
  if (!targetBuckets.size) return 70;

  const creatorBuckets = new Set<string>();
  for (const snap of latest) {
    for (const bucket of extractAgeBucketsFromText((snap.audience_age_range ?? "").toLowerCase())) {
      creatorBuckets.add(bucket);
    }
  }
  if (!creatorBuckets.size) return 65;

  let overlap = 0;
  for (const bucket of targetBuckets) {
    if (creatorBuckets.has(bucket)) overlap += 1;
  }
  if (overlap === 0) return 50;
  // 1 bucket overlap → 75, 2+ → 88
  return overlap >= 2 ? 88 : 75;
}

function extractAgeBucketsFromText(text: string): Set<string> {
  const buckets = new Set<string>();
  if (!text) return buckets;
  if (/\b18-?24\b|\bgen ?z\b|\bcollege\b|\bstudent\b/.test(text)) buckets.add("18-24");
  if (/\b25-?34\b|\bmillennial\b|\byoung professional/.test(text)) buckets.add("25-34");
  if (/\b35-?44\b/.test(text)) buckets.add("35-44");
  if (/\b45-?54\b/.test(text)) buckets.add("45-54");
  if (/\b55\+|\b55-?64\b|\bsenior\b/.test(text)) buckets.add("55+");
  return buckets;
}

// ============================================================================
// engagement_quality (anti-bot)
// ============================================================================

/**
 * Anti-bot engagement health. Returns 35-95.
 *
 * Three sub-signals, averaged:
 *   1. ER vs follower-tier sanity — does the engagement rate fall in the
 *      expected band for that follower count? Too high suggests bought
 *      engagement, too low suggests dead audience.
 *   2. View-to-follower ratio — bought followers don't watch. Healthy
 *      ratio depends on platform but a global heuristic still flags the
 *      worst cases.
 *   3. Engagement consistency — variance of engagement_rate_30d across
 *      historical snapshots. Real audiences hold steady; bot purchases
 *      spike then decay. Skipped when <2 snapshots exist for the creator.
 *
 * When no snapshots exist, returns 60 (neutral) so creators aren't
 * penalized for being new.
 */
export function engagementQualityScore(snapshots: SocialMetricSnapshot[]): {
  score: number;
  reasons: string[];
} {
  if (!snapshots.length) {
    return { score: 60, reasons: ["No synced metrics yet — engagement quality not yet measurable."] };
  }

  const latest = latestPerProvider(snapshots);
  const reasons: string[] = [];

  // Sub-signal 1: ER sanity by follower tier
  const erScores = latest.map((s) => engagementRateSanity(s.followers, s.engagement_rate_30d));
  const erSanityScore = avg(erScores.map((s) => s.score));
  for (const e of erScores) {
    if (e.flag) reasons.push(e.flag);
  }

  // Sub-signal 2: view-to-follower ratio
  const viewScores = latest.map((s) => viewToFollowerScore(s.followers, s.avg_views_30d));
  const viewScore = avg(viewScores.map((s) => s.score));
  for (const v of viewScores) {
    if (v.flag) reasons.push(v.flag);
  }

  // Sub-signal 3: consistency (variance across history)
  const consistency = consistencyScore(snapshots);
  if (consistency.note) reasons.push(consistency.note);

  // Weight the sub-signals — ER sanity is the strongest single bot signal,
  // view ratio is fairly noisy across platforms, consistency requires history.
  const blended = consistency.applicable
    ? erSanityScore * 0.45 + viewScore * 0.30 + consistency.score * 0.25
    : erSanityScore * 0.6 + viewScore * 0.4;

  return {
    score: Math.round(clamp(blended, 35, 95)),
    reasons: reasons.slice(0, 4)
  };
}

function engagementRateSanity(followers: number, engagementRate: number): { score: number; flag?: string } {
  if (followers <= 0) return { score: 50 };
  const er = engagementRate;
  // Expected bands per follower tier. Inverse correlation is well documented
  // across IG/YT data — creators with 1M+ followers don't sustain 8% ER
  // organically.
  const band = followers < 10_000 ? { low: 6, high: 14, mid: 9 }
    : followers < 100_000 ? { low: 3, high: 9, mid: 5.5 }
    : followers < 1_000_000 ? { low: 1.5, high: 6, mid: 3 }
    : { low: 0.5, high: 3.5, mid: 1.8 };

  if (er <= 0) return { score: 35, flag: "Engagement rate is zero or missing — unable to score quality." };
  if (er < band.low * 0.5) return { score: 40, flag: `Engagement rate ${er.toFixed(1)}% is unusually low for ${compactNumber(followers)} followers — possible bought followers without genuine audience.` };
  if (er < band.low) return { score: 60 };
  if (er <= band.high) {
    const proximity = 1 - Math.abs(er - band.mid) / (band.high - band.low);
    return { score: 70 + Math.round(proximity * 25) };
  }
  if (er <= band.high * 1.5) return { score: 60, flag: `Engagement rate ${er.toFixed(1)}% is above the typical band for this follower count — verify it isn't pod activity.` };
  return { score: 40, flag: `Engagement rate ${er.toFixed(1)}% is far above the typical band — strong signal of engagement pods or bought engagement.` };
}

function viewToFollowerScore(followers: number, avgViews: number): { score: number; flag?: string } {
  if (followers <= 0 || avgViews <= 0) return { score: 55 };
  const ratio = avgViews / followers;
  // Tiers based on observed IG/YT data for India:
  //   <0.03  → almost certainly inflated followers
  //   0.03-0.10 → low but possible for older audience / lurkers
  //   0.10-0.35 → healthy
  //   0.35+ → exceptional, viral hits
  if (ratio < 0.03) return { score: 40, flag: `Only ${(ratio * 100).toFixed(1)}% of followers watch content — likely inflated follower count.` };
  if (ratio < 0.10) return { score: 60 };
  if (ratio < 0.35) return { score: 85 };
  return { score: 92 };
}

function consistencyScore(snapshots: SocialMetricSnapshot[]): {
  applicable: boolean;
  score: number;
  note?: string;
} {
  // Need at least 2 snapshots from the same provider to measure variance.
  const byProvider = new Map<string, SocialMetricSnapshot[]>();
  for (const snap of snapshots) {
    const list = byProvider.get(snap.provider) ?? [];
    list.push(snap);
    byProvider.set(snap.provider, list);
  }
  const eligibleHistories = Array.from(byProvider.values()).filter((list) => list.length >= 2);
  if (!eligibleHistories.length) {
    return { applicable: false, score: 60 };
  }

  const variances = eligibleHistories.map((history) => {
    const ers = history.map((s) => Number(s.engagement_rate_30d) || 0);
    const mean = ers.reduce((sum, v) => sum + v, 0) / ers.length;
    if (mean <= 0) return 0;
    const variance = ers.reduce((sum, v) => sum + (v - mean) ** 2, 0) / ers.length;
    const coefficientOfVariation = Math.sqrt(variance) / mean;
    return coefficientOfVariation;
  });

  const avgCv = avg(variances);
  // CV interpretation:
  //   <0.15  → very stable, real audience
  //   0.15-0.35 → normal fluctuation
  //   >0.35 → spiky, possibly bot purchases or content luck
  if (avgCv < 0.15) return { applicable: true, score: 90 };
  if (avgCv < 0.35) return { applicable: true, score: 75 };
  if (avgCv < 0.6) return { applicable: true, score: 55, note: "Engagement varies sharply across recent snapshots — could indicate bot purchases or content luck swings." };
  return { applicable: true, score: 40, note: "Engagement is highly volatile across snapshots — investigate before relying on this creator for performance campaigns." };
}

// ============================================================================
// helpers
// ============================================================================

function clamp(n: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, n));
}

function avg(values: number[]): number {
  if (!values.length) return 0;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

function compactNumber(value = 0) {
  return new Intl.NumberFormat("en-IN", { notation: "compact" }).format(value);
}
