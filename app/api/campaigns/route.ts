import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const admin = createAdminClient();
  if (!admin) return NextResponse.json({ data: [], source: "demo" });

  const { data, error } = await admin.from("campaigns").select("*").order("created_at", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data, source: "supabase" });
}

export async function POST(request: Request) {
  const body = await request.json();
  const auth = await createClient();
  const { data: authData } = await auth.auth.getUser();
  if (!authData.user) return NextResponse.json({ error: "Login required." }, { status: 401 });

  const title = String(body.title ?? "").trim();
  if (!title) return NextResponse.json({ error: "Campaign title is required." }, { status: 400 });

  const admin = createAdminClient();
  if (!admin) return NextResponse.json({ error: "Supabase service role key is not configured." }, { status: 500 });

  const profileId = authData.user.id;
  const email = authData.user.email ?? "";
  const brandName = String(body.brand_name ?? authData.user.user_metadata?.full_name ?? "Brand").trim();
  let brandId = String(body.brand_id ?? "").trim() || null;

  if (!brandId) {
    const existing = await admin.from("brands").select("*").eq("contact_email", email).maybeSingle();
    if (existing.data?.id) {
      brandId = existing.data.id;
    } else {
      const created = await admin
        .from("brands")
        .insert({
          name: brandName,
          website: String(body.website ?? "").trim(),
          industry: String(body.brand_category ?? "").trim(),
          contact_email: email,
          status: "campaign_brief"
        })
        .select("*")
        .single();
      if (created.error) return NextResponse.json({ error: created.error.message }, { status: 500 });
      brandId = created.data.id;
    }
  }

  const { data: campaign, error } = await admin
    .from("campaigns")
    .insert({
      brand_id: brandId,
      profile_id: profileId,
      title,
      campaign_goal: String(body.campaign_goal ?? "").trim(),
      budget_cents: Math.round(Number(body.budget_inr ?? 0) * 100),
      city_focus: String(body.city_focus ?? "").trim(),
      region_focus: String(body.region_focus ?? "").trim(),
      campaign_length: String(body.campaign_length ?? "").trim(),
      target_audience: String(body.target_audience ?? "").trim(),
      platforms: splitList(body.platforms),
      creator_categories: splitList(body.creator_categories),
      freelancer_needs: splitList(body.freelancer_needs),
      languages: splitList(body.languages),
      visibility: String(body.visibility ?? "open"),
      status: "brief"
    })
    .select("*")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const invitedCreatorIds = toArray(body.invited_creator_ids);
  if (invitedCreatorIds.length) {
    await admin.from("campaign_invites").insert(
      invitedCreatorIds.map((creatorId) => ({
        campaign_id: campaign.id,
        creator_id: creatorId,
        status: "invited"
      }))
    );
  }
  return NextResponse.json({ data: campaign, source: "supabase" }, { status: 201 });
}

function splitList(value: unknown) {
  return String(value ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function toArray(value: unknown) {
  if (Array.isArray(value)) return value.map(String).filter(Boolean);
  const item = String(value ?? "").trim();
  return item ? [item] : [];
}
