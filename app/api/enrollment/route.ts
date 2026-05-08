import { NextResponse } from "next/server";
import { auditBrand, auditCreator } from "@/lib/ai/audits";
import { classifyEmailWebsiteMatch } from "@/lib/auth/domain-match";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

type EnrollmentRole = "creator" | "brand" | "freelancer";

export async function POST(request: Request) {
  const body = await request.json();
  const role = String(body.role ?? "creator") as EnrollmentRole;

  if (role !== "creator" && role !== "brand" && role !== "freelancer") {
    return NextResponse.json({ error: "Role must be creator, brand, or freelancer." }, { status: 400 });
  }

  const auth = await createClient();
  const { data: authData } = await auth.auth.getUser();
  if (!authData.user) {
    return NextResponse.json({ error: "Create an account before completing intake." }, { status: 401 });
  }

  const supabase = createAdminClient();
  if (!supabase) {
    return NextResponse.json({ error: "Supabase service role key is not configured." }, { status: 500 });
  }

  const profilePayload = {
    id: authData.user.id,
    email: authData.user.email ?? "",
    full_name: String(authData.user.user_metadata?.full_name ?? "Agently user"),
    role
  };
  const { error: profileError } = await supabase
    .from("profiles")
    .upsert(profilePayload, { onConflict: "id" });
  if (profileError) {
    return NextResponse.json({ error: profileError.message }, { status: 500 });
  }

  await supabase.auth.admin.updateUserById(authData.user.id, {
    user_metadata: {
      ...authData.user.user_metadata,
      role,
      intake_completed: true
    }
  });

  if (role === "creator") {
    const audit = auditCreator(body);
    return createCreatorEnrollment(supabase, body, profilePayload.id, audit);
  }

  if (role === "freelancer") {
    return createFreelancerEnrollment(supabase, body, profilePayload.id);
  }

  const audit = auditBrand(body);
  return createBrandEnrollment(supabase, body, profilePayload.id, profilePayload.email, audit);
}

async function createCreatorEnrollment(
  supabase: NonNullable<ReturnType<typeof createAdminClient>>,
  body: Record<string, unknown>,
  profileId: string,
  audit: ReturnType<typeof auditCreator>,
) {
  const creatorPayload = {
    profile_id: profileId,
    display_name: String(body.creator_name ?? body.full_name ?? "Creator").trim(),
    primary_niche: firstItem(audit.detected_categories) || "needs_classification",
    bio: String(body.sample_posts ?? "").trim(),
    country: "IN",
    us_audience_percent: 0,
    india_audience_percent: audit.india_relevance_score,
    home_city: String(body.city_focus ?? "Bengaluru").trim(),
    languages: audit.detected_languages?.filter((item) => item !== "needs_validation") ?? [],
    top_indian_cities: audit.local_signals?.filter((item) => ["bangalore", "bengaluru", "indiranagar", "koramangala", "whitefield", "hsr"].includes(item)) ?? ["Bengaluru"],
    audience_age_range: "",
    content_style: audit.content_style_summary,
    prior_sponsor_categories: audit.brand_fit_categories ?? [],
    monetization_score: audit.sponsor_readiness_score,
    valuation_score: Math.round((audit.sponsor_readiness_score + audit.bangalore_relevance_score) / 2)
  };

  let creatorResult = await supabase.from("creators").insert(creatorPayload).select("*").single();

  if (creatorResult.error?.message.toLowerCase().includes("column")) {
    creatorResult = await supabase
      .from("creators")
      .insert({
        profile_id: profileId,
        display_name: creatorPayload.display_name,
        primary_niche: creatorPayload.primary_niche,
        bio: creatorPayload.bio,
        country: "IN",
        us_audience_percent: 0,
        monetization_score: creatorPayload.monetization_score,
        valuation_score: creatorPayload.valuation_score
      })
      .select("*")
      .single();
  }

  if (creatorResult.error || !creatorResult.data) {
    return NextResponse.json({ error: creatorResult.error?.message ?? "Could not create creator profile." }, { status: 500 });
  }

  const platforms = [
    { platform: "Instagram", url: body.instagram_url },
    { platform: "YouTube", url: body.youtube_url },
    { platform: "TikTok", url: body.tiktok_url }
  ].filter((item) => String(item.url ?? "").trim());

  if (platforms.length) {
    await supabase.from("creator_platforms").insert(
      platforms.map((item) => ({
        creator_id: creatorResult.data.id,
        platform: item.platform,
        url: String(item.url),
        handle: String(item.url),
        followers: 0,
        avg_views: 0,
        engagement_rate: 0,
        posting_frequency: ""
      }))
    );
  }

  await supabase.from("creator_audits").insert({
    creator_id: creatorResult.data.id,
    profile_id: profileId,
    input: body,
    result: audit,
    source: "rules_fallback"
  });

  return NextResponse.json({
    role: "creator",
    profile_id: profileId,
    creator_id: creatorResult.data.id,
    audit: { ...audit, source: "rules_fallback" },
    next_url: "/creator-home"
  }, { status: 201 });
}

async function createBrandEnrollment(
  supabase: NonNullable<ReturnType<typeof createAdminClient>>,
  body: Record<string, unknown>,
  profileId: string,
  profileEmail: string,
  audit: ReturnType<typeof auditBrand>
) {
  const websiteUrl = String(body.website_url ?? "").trim();
  const domainMatch = classifyEmailWebsiteMatch(profileEmail, websiteUrl);
  // Auto-verify when the brand's contact email is on the same domain as
  // their stated website (e.g. marketing@nykaa.com + nykaa.com). Public
  // inboxes (gmail/yahoo) and mismatches stay 'unverified' for manual review.
  const initialVerificationStatus = domainMatch === "match" ? "verified" : "unverified";
  const verifiedAt = domainMatch === "match" ? new Date().toISOString() : null;

  const { data: brand, error: brandError } = await supabase
    .from("brands")
    .insert({
      name: String(body.brand_name ?? body.full_name ?? "Brand").trim(),
      website: websiteUrl,
      industry: String(body.category ?? audit.detected_category ?? "").trim(),
      contact_email: profileEmail,
      status: "enrolled",
      verification_status: initialVerificationStatus,
      verified_at: verifiedAt,
      verification_notes: domainMatch === "match"
        ? "Auto-verified: contact email domain matches website domain."
        : domainMatch === "public_inbox"
        ? "Public inbox provider — manual verification required for verified status."
        : domainMatch === "mismatch"
        ? "Email domain does not match website domain — manual verification required."
        : null
    })
    .select("*")
    .single();

  if (brandError || !brand) {
    return NextResponse.json({ error: brandError?.message ?? "Could not create brand profile." }, { status: 500 });
  }

  await supabase.from("brand_audits").insert({
    brand_id: brand.id,
    profile_id: profileId,
    input: body,
    result: audit,
    source: "rules_fallback"
  });

  return NextResponse.json({
    role: "brand",
    profile_id: profileId,
    brand_id: brand.id,
    audit: { ...audit, source: "rules_fallback" },
    next_url: "/brand-home"
  }, { status: 201 });
}

async function createFreelancerEnrollment(
  supabase: NonNullable<ReturnType<typeof createAdminClient>>,
  body: Record<string, unknown>,
  profileId: string
) {
  const freelancer = await insertFreelancerProfile(supabase, body, profileId);
  if (!freelancer) {
    return NextResponse.json({ error: "Could not create freelancer profile. Run migrations 005_freelancers.sql and 006_hybrid_talent_and_service_rates.sql first." }, { status: 500 });
  }

  return NextResponse.json({
    role: "freelancer",
    profile_id: profileId,
    freelancer_id: freelancer.id,
    audit: {
      audit_type: "freelancer_portfolio_intake",
      portfolio_score: freelancer.portfolio_score,
      service_category: freelancer.service_category,
      skills: freelancer.skills,
      source: "rules_fallback"
    },
    next_url: "/freelancer-home"
  }, { status: 201 });
}

async function insertFreelancerProfile(
  supabase: NonNullable<ReturnType<typeof createAdminClient>>,
  body: Record<string, unknown>,
  profileId: string
) {
  const skills = splitList(body.skills);
  const serviceCategory = String(body.service_category ?? "creative services").trim();
  const portfolioLinks = splitLines(body.portfolio_links);
  const hourlyRateCents = Math.round(Number(body.hourly_rate_inr ?? 0) * 100);

  let result = await supabase
    .from("freelancers")
    .insert({
      profile_id: profileId,
      display_name: String(body.freelancer_name ?? body.creator_name ?? body.full_name ?? "Freelancer").trim(),
      service_category: serviceCategory,
      bio: String(body.freelancer_bio ?? "").trim(),
      home_city: String(body.city_focus ?? "Bengaluru").trim(),
      service_regions: splitList(body.service_regions),
      languages: splitList(body.languages),
      skills,
      starting_rate_cents: 0,
      day_rate_cents: hourlyRateCents,
      hourly_rate_cents: hourlyRateCents,
      availability_status: String(body.availability_status ?? "available").trim(),
      rating_score: 0,
      portfolio_score: Math.min(100, 45 + portfolioLinks.length * 12 + skills.length * 5)
    })
    .select("*")
    .single();

  if (result.error?.message.toLowerCase().includes("hourly_rate_cents")) {
    result = await supabase
      .from("freelancers")
      .insert({
        profile_id: profileId,
        display_name: String(body.freelancer_name ?? body.creator_name ?? body.full_name ?? "Freelancer").trim(),
        service_category: serviceCategory,
        bio: String(body.freelancer_bio ?? "").trim(),
        home_city: String(body.city_focus ?? "Bengaluru").trim(),
        service_regions: splitList(body.service_regions),
        languages: splitList(body.languages),
        skills,
        starting_rate_cents: 0,
        day_rate_cents: hourlyRateCents,
        availability_status: String(body.availability_status ?? "available").trim(),
        rating_score: 0,
        portfolio_score: Math.min(100, 45 + portfolioLinks.length * 12 + skills.length * 5)
      })
      .select("*")
      .single();
  }

  if (result.error || !result.data) return null;

  if (portfolioLinks.length) {
    await supabase.from("portfolio_items").insert(
      portfolioLinks.map((url, index) => ({
        freelancer_id: result.data.id,
        title: `Portfolio item ${index + 1}`,
        url,
        media_type: String(body.service_category ?? "portfolio"),
        category: serviceCategory,
        brand_client: "",
        description: String(body.portfolio_notes ?? "").trim()
      }))
    );
  }

  const serviceRates = parseServiceRates(body.service_rates);
  if (serviceRates.length) {
    await supabase.from("freelancer_service_rates").insert(
      serviceRates.map((rate) => ({
        freelancer_id: result.data.id,
        service_name: rate.service_name,
        description: rate.description,
        rate_cents: rate.rate_cents,
        pricing_unit: "project"
      }))
    );
  }

  return result.data;
}

function firstItem(items?: string[]) {
  return items?.[0] ?? "";
}

function splitList(value: unknown) {
  return String(value ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function splitLines(value: unknown) {
  return String(value ?? "")
    .split(/\r?\n|,/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function parseServiceRates(value: unknown) {
  return splitLines(value).map((line) => {
    const amountMatch = line.match(/(\d[\d,]*)/);
    const amount = amountMatch ? Number(amountMatch[1].replaceAll(",", "")) : 0;
    const serviceName = line
      .replace(/[-:]?\s*(inr|rs|rupees)?\s*\d[\d,]*\s*(inr|rs|rupees)?/i, "")
      .trim();

    return {
      service_name: serviceName || line,
      description: line,
      rate_cents: Math.round(amount * 100)
    };
  }).filter((item) => item.service_name);
}
