import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth/session";
import { classifyScrapeAgainstSelfReport, fetchInstagramPublicMetrics, normalizeHandle } from "@/lib/social/instagram-public-scraper";
import { createAdminClient } from "@/lib/supabase/admin";

const schema = z.object({
  handle: z.string().trim().min(1).max(200),
  /** Override the 24h cache and force a fresh scrape (admin only) */
  force_refresh: z.boolean().optional().default(false)
});

const CACHE_TTL_HOURS = 24;

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Login required." }, { status: 401 });

  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid request." }, { status: 400 });

  const handle = normalizeHandle(parsed.data.handle);
  if (!handle) return NextResponse.json({ error: "Invalid Instagram handle." }, { status: 400 });

  const admin = createAdminClient();
  if (!admin) return NextResponse.json({ error: "Service role not configured." }, { status: 500 });

  // Check 24h cache - any creator_platform row tagged with this handle that
  // was scraped recently means we don't hit Instagram again.
  if (!parsed.data.force_refresh || user.role !== "admin") {
    const cached = await getCachedScrape(admin, handle);
    if (cached) return NextResponse.json({ data: cached, cached: true });
  }

  const result = await fetchInstagramPublicMetrics(handle);

  // Resolve which entity is doing this so we can write the result back
  const ownership = await resolveOwnership(admin, user.id, user.role);

  if (!result.ok) {
    // Still log the failed attempt so we have a paper trail
    if (ownership.creator_id) {
      await admin.from("creator_platforms").update({
        last_scrape_attempted_at: result.fetched_at,
        last_scrape_status: result.reason
      }).eq("creator_id", ownership.creator_id).eq("platform", "Instagram").eq("handle", handle).then(() => null, () => null);
    }
    return NextResponse.json({ data: result }, { status: 200 });
  }

  // Cross-check scraped followers against any self-reported number we have
  let consistencyVerdict: { verdict: string; delta_pct: number } | null = null;
  if (ownership.creator_id) {
    const { data: existing } = await admin
      .from("creator_platforms")
      .select("followers, metric_source")
      .eq("creator_id", ownership.creator_id)
      .eq("platform", "Instagram")
      .eq("handle", handle)
      .maybeSingle();
    consistencyVerdict = classifyScrapeAgainstSelfReport(result.followers ?? 0, existing?.followers ?? null);

    // Decide metric_source based on consistency:
    //   - within_tolerance / no_self_report  -> public_scrape  (trust scrape)
    //   - significant_difference             -> public_scrape_unconfirmed (flag)
    const metricSource = consistencyVerdict.verdict === "significant_difference"
      ? "public_scrape_unconfirmed"
      : "public_scrape";

    const updatePayload = {
      creator_id: ownership.creator_id,
      platform: "Instagram",
      handle,
      url: result.profile_url,
      followers: result.followers,
      metric_source: metricSource,
      last_scrape_attempted_at: result.fetched_at,
      last_scrape_status: "success",
      last_scrape_followers: result.followers,
      last_scrape_self_report_delta_pct: consistencyVerdict.delta_pct
    };

    // Upsert into creator_platforms
    if (existing) {
      await admin.from("creator_platforms").update(updatePayload).eq("creator_id", ownership.creator_id).eq("platform", "Instagram").eq("handle", handle);
    } else {
      await admin.from("creator_platforms").insert(updatePayload);
    }
  }

  return NextResponse.json({
    data: result,
    consistency: consistencyVerdict,
    cached: false
  });
}

async function getCachedScrape(admin: NonNullable<ReturnType<typeof createAdminClient>>, handle: string) {
  const cutoff = new Date(Date.now() - CACHE_TTL_HOURS * 60 * 60 * 1000).toISOString();
  const { data } = await admin
    .from("creator_platforms")
    .select("followers, last_scrape_attempted_at, last_scrape_status, last_scrape_followers, url")
    .eq("platform", "Instagram")
    .eq("handle", handle)
    .eq("last_scrape_status", "success")
    .gte("last_scrape_attempted_at", cutoff)
    .maybeSingle();
  if (!data || !data.last_scrape_attempted_at) return null;
  return {
    ok: true as const,
    handle,
    display_name: null,
    followers: Number(data.last_scrape_followers ?? data.followers ?? 0) || null,
    following: null,
    posts: null,
    profile_url: String(data.url ?? `https://www.instagram.com/${handle}/`),
    fetched_at: String(data.last_scrape_attempted_at),
    raw_description: ""
  };
}

async function resolveOwnership(
  admin: NonNullable<ReturnType<typeof createAdminClient>>,
  profileId: string,
  role: string | undefined
): Promise<{ creator_id: string | null; brand_id: string | null }> {
  if (role === "creator") {
    const { data: creator } = await admin.from("creators").select("id").eq("profile_id", profileId).maybeSingle();
    return { creator_id: creator ? String(creator.id) : null, brand_id: null };
  }
  if (role === "brand") {
    const { data: profile } = await admin.from("profiles").select("email").eq("id", profileId).maybeSingle();
    if (!profile?.email) return { creator_id: null, brand_id: null };
    const { data: brand } = await admin.from("brands").select("id").eq("contact_email", String(profile.email).toLowerCase()).maybeSingle();
    return { creator_id: null, brand_id: brand ? String(brand.id) : null };
  }
  return { creator_id: null, brand_id: null };
}
