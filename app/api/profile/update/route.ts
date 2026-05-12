import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export async function PATCH(request: Request) {
  const body = await request.json();
  const auth = await createClient();
  const { data: authData } = await auth.auth.getUser();
  if (!authData.user) return NextResponse.json({ error: "Login required." }, { status: 401 });

  const admin = createAdminClient();
  if (!admin) return NextResponse.json({ error: "Supabase service role key is not configured." }, { status: 500 });

  const { data: profile } = await admin.from("profiles").select("*").eq("id", authData.user.id).single();
  const role = String(profile?.role ?? authData.user.user_metadata?.role ?? "");

  if (role === "creator") return updateCreator(admin, authData.user.id, body);
  if (role === "freelancer") return updateFreelancer(admin, authData.user.id, body);
  if (role === "brand") return updateBrand(admin, authData.user.id, authData.user.email ?? "", body);
  if (role === "admin") return NextResponse.json({ error: "Admin profile editing is not part of this prototype screen yet." }, { status: 400 });

  return NextResponse.json({ error: "Unknown profile role." }, { status: 400 });
}

async function updateCreator(admin: NonNullable<ReturnType<typeof createAdminClient>>, userId: string, body: Record<string, unknown>) {
  const { data: creator } = await admin.from("creators").select("*").eq("profile_id", userId).maybeSingle();
  if (!creator) return NextResponse.json({ error: "Creator profile not found." }, { status: 404 });

  const payload = {
    display_name: text(body.display_name),
    primary_niche: text(body.primary_niche),
    bio: text(body.bio),
    country: text(body.country) || "IN",
    home_city: text(body.home_city),
    languages: list(body.languages),
    top_indian_cities: list(body.top_indian_cities),
    audience_age_range: text(body.audience_age_range),
    content_style: text(body.content_style),
    prior_sponsor_categories: list(body.prior_sponsor_categories)
  };

  const { data, error } = await admin.from("creators").update(payload).eq("id", creator.id).select("*").single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ data, next_url: "/creator-home" });
}

async function updateFreelancer(admin: NonNullable<ReturnType<typeof createAdminClient>>, userId: string, body: Record<string, unknown>) {
  const { data: freelancer } = await admin.from("freelancers").select("*").eq("profile_id", userId).maybeSingle();
  if (!freelancer) return NextResponse.json({ error: "Freelancer profile not found." }, { status: 404 });

  const skills = list(body.skills);
  const portfolioItems = parsePortfolio(body.portfolio_items);
  const payload = {
    display_name: text(body.display_name),
    service_category: text(body.service_category),
    bio: text(body.bio),
    home_city: text(body.home_city),
    service_regions: list(body.service_regions),
    languages: list(body.languages),
    skills,
    hourly_rate_cents: Math.round(number(body.hourly_rate_inr) * 100),
    availability_status: text(body.availability_status),
    portfolio_score: Math.min(100, 45 + portfolioItems.length * 12 + skills.length * 5)
  };

  const { data, error } = await admin.from("freelancers").update(payload).eq("id", freelancer.id).select("*").single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const serviceRates = parseServiceRates(body.service_rates);
  await admin.from("freelancer_service_rates").delete().eq("freelancer_id", freelancer.id);
  if (serviceRates.length) {
    await admin.from("freelancer_service_rates").insert(serviceRates.map((rate) => ({ ...rate, freelancer_id: freelancer.id })));
  }

  await admin.from("portfolio_items").delete().eq("freelancer_id", freelancer.id);
  if (portfolioItems.length) {
    await admin.from("portfolio_items").insert(portfolioItems.map((item) => ({ ...item, freelancer_id: freelancer.id })));
  }

  return NextResponse.json({ data, next_url: "/freelancer-home" });
}

async function updateBrand(admin: NonNullable<ReturnType<typeof createAdminClient>>, userId: string, email: string, body: Record<string, unknown>) {
  const { data: existing } = await admin.from("brands").select("*").eq("contact_email", email).maybeSingle();
  const payload = {
    name: text(body.name),
    website: text(body.website),
    industry: text(body.industry),
    contact_email: email,
    status: text(body.status) || "enrolled"
  };

  const result = existing?.id
    ? await admin.from("brands").update(payload).eq("id", existing.id).select("*").single()
    : await admin.from("brands").insert(payload).select("*").single();

  if (result.error || !result.data) {
    return NextResponse.json({ error: result.error?.message ?? "Could not update brand." }, { status: 500 });
  }

  const auditInput = {
    campaign_goal: text(body.campaign_goal),
    target_audience: text(body.target_audience),
    category: payload.industry,
    city_focus: text(body.city_focus),
    brand_notes: text(body.brand_notes)
  };

  await admin.from("brand_audits").insert({
    brand_id: result.data.id,
    profile_id: userId,
    input: auditInput,
    result: {
      audit_type: "brand_profile_edit",
      outreach_brief: auditInput.campaign_goal || "Brand profile updated for campaign matching.",
      ideal_creator_archetypes: list(body.ideal_creator_archetypes),
      creator_size_band: text(body.creator_size_band) || "micro to mid-market creators",
      bangalore_launch_fit_score: 70
    },
    source: "profile_edit"
  });

  return NextResponse.json({ data: result.data, next_url: "/brand-home" });
}

function text(value: unknown) {
  return String(value ?? "").trim();
}

function number(value: unknown) {
  return Number(value ?? 0);
}

function list(value: unknown) {
  return text(value).split(",").map((item) => item.trim()).filter(Boolean);
}

function lines(value: unknown) {
  return text(value).split(/\r?\n/).map((item) => item.trim()).filter(Boolean);
}

function parseServiceRates(value: unknown) {
  return lines(value).map((line) => {
    const [serviceName, description, rateInr, pricingUnit] = line.split("|").map((item) => item.trim());
    return {
      service_name: serviceName || "Service",
      description: description || line,
      rate_cents: Math.round(Number(rateInr ?? 0) * 100),
      pricing_unit: pricingUnit || "project"
    };
  });
}

function parsePortfolio(value: unknown) {
  return lines(value).map((line, index) => {
    const [title, url, category, brandClient, description] = line.split("|").map((item) => item.trim());
    return {
      title: title || `Portfolio item ${index + 1}`,
      url: url || "",
      media_type: category || "portfolio",
      category: category || "",
      brand_client: brandClient || "",
      description: description || ""
    };
  }).filter((item) => item.url);
}
