import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const body = await request.json();
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return NextResponse.json({ error: "Login required." }, { status: 401 });

  const admin = createAdminClient();
  if (!admin) return NextResponse.json({ error: "Supabase service role key is not configured." }, { status: 500 });
  const { data: profile } = await admin.from("profiles").select("role").eq("id", data.user.id).maybeSingle();
  if (profile?.role === "brand") {
    return NextResponse.json({ error: "Brand accounts cannot create freelancer profiles." }, { status: 403 });
  }

  const { data: existingFreelancer } = await admin
    .from("freelancers")
    .select("*")
    .eq("profile_id", data.user.id)
    .maybeSingle();
  if (existingFreelancer) {
    return NextResponse.json({ data: existingFreelancer, next_url: "/freelancer-home" }, { status: 200 });
  }

  const skills = splitList(body.skills);
  const serviceCategory = String(body.service_category ?? "creative services").trim();
  const hourlyRateCents = Math.round(Number(body.hourly_rate_inr ?? 0) * 100);
  const portfolioLinks = splitLines(body.portfolio_links);

  let result = await admin
    .from("freelancers")
    .insert({
      profile_id: data.user.id,
      display_name: String(body.display_name ?? data.user.user_metadata?.full_name ?? "Freelancer").trim(),
      service_category: serviceCategory,
      bio: String(body.bio ?? "").trim(),
      home_city: String(body.home_city ?? "Bengaluru").trim(),
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
    result = await admin
      .from("freelancers")
      .insert({
        profile_id: data.user.id,
        display_name: String(body.display_name ?? data.user.user_metadata?.full_name ?? "Freelancer").trim(),
        service_category: serviceCategory,
        bio: String(body.bio ?? "").trim(),
        home_city: String(body.home_city ?? "Bengaluru").trim(),
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

  if (result.error || !result.data) {
    return NextResponse.json({ error: result.error?.message ?? "Could not create freelancer profile." }, { status: 500 });
  }

  const freelancer = result.data;
  if (portfolioLinks.length) {
    await admin.from("portfolio_items").insert(
      portfolioLinks.map((url, index) => ({
        freelancer_id: freelancer.id,
        title: `Portfolio item ${index + 1}`,
        url,
        media_type: serviceCategory,
        category: serviceCategory,
        brand_client: "",
        description: String(body.portfolio_notes ?? "").trim()
      }))
    );
  }

  const serviceRates = parseServiceRates(body.service_rates);
  if (serviceRates.length) {
    await admin.from("freelancer_service_rates").insert(
      serviceRates.map((rate) => ({
        freelancer_id: freelancer.id,
        service_name: rate.service_name,
        description: rate.description,
        rate_cents: rate.rate_cents,
        pricing_unit: "project"
      }))
    );
  }

  return NextResponse.json({ data: freelancer }, { status: 201 });
}

function splitList(value: unknown) {
  return String(value ?? "").split(",").map((item) => item.trim()).filter(Boolean);
}

function splitLines(value: unknown) {
  return String(value ?? "").split(/\r?\n|,/).map((item) => item.trim()).filter(Boolean);
}

function parseServiceRates(value: unknown) {
  return splitLines(value).map((line) => {
    const amountMatch = line.match(/(\d[\d,]*)/);
    const amount = amountMatch ? Number(amountMatch[1].replaceAll(",", "")) : 0;
    const serviceName = line.replace(/[-:]?\s*(inr|rs|rupees)?\s*\d[\d,]*\s*(inr|rs|rupees)?/i, "").trim();
    return { service_name: serviceName || line, description: line, rate_cents: Math.round(amount * 100) };
  }).filter((item) => item.service_name);
}
