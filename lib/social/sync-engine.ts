import type { createAdminClient } from "@/lib/supabase/admin";

type AdminClient = NonNullable<ReturnType<typeof createAdminClient>>;

export async function refreshCreatorScoresFromSnapshots(admin: AdminClient, creatorId: string) {
  const latestSignals = await getCreatorLatestSignals(admin, creatorId);
  // Verification tiers collapsed to 2: a creator with API-synced metrics
  // (Phyllo, etc.) is "verified", everything else stays where it was.
  // Storing the literal "verified" keeps the legacy isVerifiedTier()
  // helper happy and matches the new admin UX.
  await admin.from("creators").update({
    india_audience_percent: latestSignals.indiaAudience,
    monetization_score: latestSignals.monetizationScore,
    valuation_score: latestSignals.valuationScore,
    verification_status: "verified",
    verification_tier: "verified"
  }).eq("id", creatorId);
  return latestSignals;
}

export async function getCreatorLatestSignals(admin: AdminClient, creatorId: string) {
  const { data } = await admin
    .from("social_metric_snapshots")
    .select("*")
    .eq("creator_id", creatorId)
    .order("synced_at", { ascending: false });

  const snapshots = (data ?? []).filter((item) => isTrustedSnapshotSource(String(item.source ?? "")));
  const totalFollowers = snapshots.reduce((sum, item) => sum + Number(item.followers ?? 0), 0);
  const totalViews = snapshots.reduce((sum, item) => sum + Number(item.avg_views_30d ?? 0), 0);
  const avgEngagement = snapshots.length
    ? snapshots.reduce((sum, item) => sum + Number(item.engagement_rate_30d ?? 0), 0) / snapshots.length
    : 0;
  const indiaAudience = snapshots.length
    ? Math.round(snapshots.reduce((sum, item) => sum + Number(item.india_audience_percent ?? 0), 0) / snapshots.length)
    : 0;
  const bangaloreAudience = snapshots.length
    ? Math.round(snapshots.reduce((sum, item) => sum + Number(item.bangalore_audience_percent ?? 0), 0) / snapshots.length)
    : 0;

  return {
    indiaAudience,
    monetizationScore: Math.max(35, Math.min(96, Math.round(38 + Math.log10(Math.max(10, totalViews)) * 9 + avgEngagement * 3 + indiaAudience * 0.12))),
    valuationScore: Math.max(35, Math.min(96, Math.round(35 + Math.log10(Math.max(10, totalFollowers)) * 8 + Math.log10(Math.max(10, totalViews)) * 6 + bangaloreAudience * 0.14))),
    highConfidence: snapshots.length >= 1 && totalViews > 0
  };
}

function isTrustedSnapshotSource(source: string) {
  if (!source) return false;
  if (source === "mock_api") return true;
  if (source.includes("api") && !source.includes("no_creator") && !source.includes("permission") && !source.includes("setup_required")) return true;
  return false;
}
