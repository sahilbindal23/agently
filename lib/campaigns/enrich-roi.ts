// Enriches CampaignRecommendation rows with a benchmark-grounded ROI projection
// pulled from the observations layer. Runs after rankCreators so it doesn't
// change the existing scoring path; just attaches a projected_roi field for
// the recommendation card to surface to brands.

import type { SupabaseClient } from "@supabase/supabase-js";
import { projectROI, type RoiProjection } from "@/lib/benchmarks/roi";
import type { CampaignRecommendation } from "@/lib/campaigns/recommendations";

export type ProjectedRoiSummary = {
  expected_revenue_inr: number;
  expected_cost_inr: number;
  expected_roi_multiplier: number;
  conservative_roi_multiplier: number;
  optimistic_roi_multiplier: number;
  rate_source: RoiProjection["inputs_used"]["rate_source"];
  has_internal_deal_data: boolean;
  matched_niche: string;
  matched_platform: string;
  matched_tier: string;
};

type CreatorLike = {
  id: string;
  primary_niche?: string | null;
};

type PlatformLike = {
  creator_id: string;
  platform: string;
  followers?: number | null;
};

const DELIVERABLE_BY_PLATFORM: Record<string, string> = {
  Instagram: "reel",
  YouTube: "long_form",
  Twitter: "thread",
  LinkedIn: "static_post",
  TikTok: "short",
  Regional: "short"
};

function normalizePlatform(raw: string | null | undefined): string {
  const v = String(raw ?? "").toLowerCase();
  if (v.includes("instagram") || v === "ig") return "Instagram";
  if (v.includes("youtube") || v === "yt") return "YouTube";
  if (v.includes("twitter") || v === "x") return "Twitter";
  if (v.includes("linkedin")) return "LinkedIn";
  if (v.includes("tiktok")) return "TikTok";
  if (v.includes("moj") || v.includes("josh") || v.includes("sharechat")) return "Regional";
  return raw || "Instagram";
}

export async function enrichRecommendationsWithRoi(
  admin: SupabaseClient,
  recommendations: CampaignRecommendation[],
  creators: CreatorLike[],
  platforms: PlatformLike[],
  brandAovInr?: number
): Promise<Array<CampaignRecommendation & { projected_roi?: ProjectedRoiSummary }>> {
  const platformByCreator = new Map<string, PlatformLike>();
  for (const p of platforms) {
    const existing = platformByCreator.get(p.creator_id);
    if (!existing || Number(p.followers ?? 0) > Number(existing.followers ?? 0)) {
      platformByCreator.set(p.creator_id, p);
    }
  }
  const creatorById = new Map(creators.map((c) => [c.id, c]));

  return Promise.all(
    recommendations.map(async (rec) => {
      const creator = creatorById.get(rec.id);
      const dominantPlatform = platformByCreator.get(rec.id);
      if (!creator || !dominantPlatform) return rec;

      const platform = normalizePlatform(dominantPlatform.platform);
      const niche = String(creator.primary_niche ?? "").toLowerCase().split(/\s+/)[0] || "lifestyle";
      const followerCount = Number(dominantPlatform.followers ?? 0);
      if (!followerCount) return rec;

      try {
        const projection = await projectROI(admin, {
          platform,
          niche,
          deliverable_type: DELIVERABLE_BY_PLATFORM[platform] ?? "reel",
          follower_count: followerCount,
          deliverable_count: 1,
          brand_aov_inr: brandAovInr
        });
        const summary: ProjectedRoiSummary = {
          expected_revenue_inr: projection.expected.expected_revenue_inr,
          expected_cost_inr: projection.expected.cost_inr,
          expected_roi_multiplier: projection.expected.roi_multiplier,
          conservative_roi_multiplier: projection.conservative.roi_multiplier,
          optimistic_roi_multiplier: projection.optimistic.roi_multiplier,
          rate_source: projection.inputs_used.rate_source,
          has_internal_deal_data: Number(projection.matched_cells.rate?.internal_deal_count ?? 0) > 0,
          matched_niche: niche,
          matched_platform: platform,
          matched_tier: projection.inputs_used.tier
        };
        return { ...rec, projected_roi: summary };
      } catch {
        return rec;
      }
    })
  );
}
