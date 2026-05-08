import type { SupabaseClient } from "@supabase/supabase-js";
import { extractFromText } from "@/lib/benchmarks/extract";
import { recordRateObservation, tierFromFollowers } from "@/lib/benchmarks/observations";

type Row = Record<string, unknown>;

export async function recordObservationFromDeal(admin: SupabaseClient, dealId: string) {
  const { data: deal } = await admin.from("deals").select("*").eq("id", dealId).maybeSingle();
  if (!deal) return;
  if (Number(deal.amount_cents ?? 0) <= 0) return;
  if (String(deal.payment_status ?? "") !== "released") return;

  const { data: creator } = deal.creator_id
    ? await admin.from("creators").select("id, primary_niche, home_city").eq("id", deal.creator_id).maybeSingle()
    : { data: null as Row | null };
  const { data: platforms } = deal.creator_id
    ? await admin.from("creator_platforms").select("platform, followers, avg_views").eq("creator_id", deal.creator_id)
    : { data: [] as Row[] };

  const haystack = `${String(deal.title ?? "")} ${String(deal.deliverables ?? "")} ${String(deal.notes ?? "")}`;
  const extracted = extractFromText(haystack);

  // Prefer creator's primary niche if extraction found nothing
  const niche = extracted.niche !== "unknown"
    ? extracted.niche
    : (creator?.primary_niche ? String(creator.primary_niche).toLowerCase() : "unknown");

  // Pick the platform row that matches the extracted platform, else the highest-follower one
  const platformRow = (platforms ?? []).find((p) => String(p.platform ?? "").toLowerCase() === extracted.platform.toLowerCase())
    ?? (platforms ?? []).sort((a, b) => Number(b.followers ?? 0) - Number(a.followers ?? 0))[0];
  const followers = platformRow ? Number(platformRow.followers ?? 0) : null;
  const avgViews = platformRow ? Number(platformRow.avg_views ?? 0) : null;

  await recordRateObservation(admin, {
    source_slug: "internal_deal",
    platform: extracted.platform,
    niche,
    deliverable_type: extracted.deliverable,
    tier: tierFromFollowers(followers),
    city: creator?.home_city ? String(creator.home_city).toLowerCase() : "unknown",
    market: "India",
    follower_count: followers,
    avg_views_count: avgViews,
    amount_cents: Number(deal.amount_cents),
    confidence: 1.0,
    deal_id: dealId,
    observed_at: deal.responded_at ? String(deal.responded_at) : new Date().toISOString(),
    dedupe_key: `deal:${dealId}`,
    raw_metadata: {
      deal_title: deal.title,
      brand_id: deal.brand_id,
      creator_id: deal.creator_id,
      campaign_id: deal.campaign_id,
      extraction: extracted
    }
  });
}

export async function recordObservationFromFreelancerProject(admin: SupabaseClient, projectId: string) {
  const { data: project } = await admin.from("freelancer_projects").select("*").eq("id", projectId).maybeSingle();
  if (!project) return;
  if (Number(project.amount_cents ?? 0) <= 0) return;
  if (String(project.payment_status ?? "") !== "released") return;

  const { data: freelancer } = project.freelancer_id
    ? await admin.from("freelancers").select("id, service_category, home_city").eq("id", project.freelancer_id).maybeSingle()
    : { data: null as Row | null };

  const haystack = `${String(project.title ?? "")} ${String(project.scope ?? "")} ${String(project.notes ?? "")}`;
  const extracted = extractFromText(haystack);
  const niche = extracted.niche !== "unknown"
    ? extracted.niche
    : (freelancer?.service_category ? String(freelancer.service_category).toLowerCase() : "unknown");

  await recordRateObservation(admin, {
    source_slug: "internal_deal",
    platform: extracted.platform === "unknown" ? "Freelancer" : extracted.platform,
    niche,
    deliverable_type: extracted.deliverable,
    tier: "unknown",
    city: freelancer?.home_city ? String(freelancer.home_city).toLowerCase() : "unknown",
    market: "India",
    amount_cents: Number(project.amount_cents),
    confidence: 1.0,
    freelancer_project_id: projectId,
    observed_at: project.responded_at ? String(project.responded_at) : new Date().toISOString(),
    dedupe_key: `freelancer_project:${projectId}`,
    raw_metadata: {
      project_title: project.title,
      brand_id: project.brand_id,
      freelancer_id: project.freelancer_id,
      extraction: extracted
    }
  });
}
