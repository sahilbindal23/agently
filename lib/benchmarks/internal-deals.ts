import type { SupabaseClient } from "@supabase/supabase-js";
import { recordRateObservation, tierFromFollowers } from "@/lib/benchmarks/observations";

type Row = Record<string, unknown>;

const PLATFORM_KEYWORDS: Array<{ pattern: RegExp; platform: string }> = [
  { pattern: /\binstagram|insta|ig\b|reel|story|stories\b/i, platform: "Instagram" },
  { pattern: /\byoutube|yt\b|vlog/i, platform: "YouTube" },
  { pattern: /\btwitter|x\.com|tweet|thread\b/i, platform: "Twitter" },
  { pattern: /\blinkedin|li post\b/i, platform: "LinkedIn" },
  { pattern: /\btiktok|tt\b/i, platform: "TikTok" },
  { pattern: /\bmoj|josh|sharechat\b/i, platform: "Regional" }
];

const DELIVERABLE_KEYWORDS: Array<{ pattern: RegExp; deliverable: string }> = [
  { pattern: /\breel(s)?\b/i, deliverable: "reel" },
  { pattern: /\bshort(s)?\b/i, deliverable: "short" },
  { pattern: /\bstory|stories\b/i, deliverable: "story" },
  { pattern: /\bstatic|carousel|post\b/i, deliverable: "static_post" },
  { pattern: /\blong[- ]?form|dedicated|integration\b/i, deliverable: "long_form" },
  { pattern: /\bthread|tweet\b/i, deliverable: "thread" },
  { pattern: /\bpodcast\b/i, deliverable: "podcast" }
];

const NICHE_KEYWORDS: Array<{ pattern: RegExp; niche: string }> = [
  { pattern: /\bfashion|apparel|clothing|outfit\b/i, niche: "fashion" },
  { pattern: /\bbeauty|skincare|cosmetic|makeup\b/i, niche: "beauty" },
  { pattern: /\bfood|restaurant|cafe|recipe|cooking\b/i, niche: "food" },
  { pattern: /\btech|gadget|review|smartphone|laptop\b/i, niche: "tech" },
  { pattern: /\bfitness|gym|workout|wellness\b/i, niche: "fitness" },
  { pattern: /\bfinance|stock|invest|sip|mutual fund|fintech\b/i, niche: "finance" },
  { pattern: /\bgaming|esport|stream\b/i, niche: "gaming" },
  { pattern: /\btravel|hotel|trip|destination\b/i, niche: "travel" },
  { pattern: /\bparenting|baby|kids|family\b/i, niche: "parenting" },
  { pattern: /\bcomedy|funny|prank|skit\b/i, niche: "comedy" },
  { pattern: /\beducation|edtech|tutorial|learn\b/i, niche: "education" },
  { pattern: /\blifestyle|vlog|day in\b/i, niche: "lifestyle" }
];

function extractFromText(text: string) {
  const platform = PLATFORM_KEYWORDS.find((entry) => entry.pattern.test(text))?.platform ?? "unknown";
  const deliverable = DELIVERABLE_KEYWORDS.find((entry) => entry.pattern.test(text))?.deliverable ?? "unknown";
  const niche = NICHE_KEYWORDS.find((entry) => entry.pattern.test(text))?.niche ?? "unknown";
  return { platform, deliverable, niche };
}

export async function recordObservationFromDeal(admin: SupabaseClient, dealId: string) {
  const { data: deal } = await admin.from("deals").select("*").eq("id", dealId).maybeSingle();
  if (!deal) return;
  if (Number(deal.amount_cents ?? 0) <= 0) return;
  if (String(deal.payment_status ?? "") !== "released") return;

  const { data: creator } = deal.creator_id
    ? await admin.from("creators").select("id, primary_niche, home_city").eq("id", deal.creator_id).maybeSingle()
    : { data: null as Row | null };
  const { data: platforms } = deal.creator_id
    ? await admin.from("creator_platforms").select("platform, follower_count, average_views").eq("creator_id", deal.creator_id)
    : { data: [] as Row[] };

  const haystack = `${String(deal.title ?? "")} ${String(deal.deliverables ?? "")} ${String(deal.notes ?? "")}`;
  const extracted = extractFromText(haystack);

  // Prefer creator's primary niche if extraction found nothing
  const niche = extracted.niche !== "unknown"
    ? extracted.niche
    : (creator?.primary_niche ? String(creator.primary_niche).toLowerCase() : "unknown");

  // Pick the platform row that matches the extracted platform, else the highest-follower one
  const platformRow = (platforms ?? []).find((p) => String(p.platform ?? "").toLowerCase() === extracted.platform.toLowerCase())
    ?? (platforms ?? []).sort((a, b) => Number(b.follower_count ?? 0) - Number(a.follower_count ?? 0))[0];
  const followers = platformRow ? Number(platformRow.follower_count ?? 0) : null;
  const avgViews = platformRow ? Number(platformRow.average_views ?? 0) : null;

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
