import { NextResponse } from "next/server";
import { z } from "zod";
import { trackEvent, userEventBase } from "@/lib/analytics/track";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const campaignSchema = z.object({
  brand_id: z.string().uuid().optional().or(z.literal("")),
  brand_name: z.string().trim().max(120).optional().or(z.literal("")),
  website: z.string().trim().max(240).optional().or(z.literal("")),
  brand_category: z.string().trim().max(100).optional().or(z.literal("")),
  title: z.string().trim().min(1).max(160),
  campaign_goal: z.string().trim().max(2000).optional().or(z.literal("")),
  budget_inr: z.coerce.number().min(0).max(100_000_000).optional(),
  city_focus: z.string().trim().max(120).optional().or(z.literal("")),
  region_focus: z.string().trim().max(120).optional().or(z.literal("")),
  campaign_length: z.string().trim().max(120).optional().or(z.literal("")),
  target_audience: z.string().trim().max(1200).optional().or(z.literal("")),
  platforms: z.union([z.string(), z.array(z.string())]).optional(),
  creator_categories: z.union([z.string(), z.array(z.string())]).optional(),
  freelancer_needs: z.union([z.string(), z.array(z.string())]).optional(),
  languages: z.union([z.string(), z.array(z.string())]).optional(),
  visibility: z.enum(["open", "invite_only"]).optional(),
  invited_creator_ids: z.union([z.string(), z.array(z.string().uuid())]).optional()
});

export async function GET() {
  const auth = await createClient();
  const { data: authData } = await auth.auth.getUser();
  if (!authData.user) return NextResponse.json({ error: "Login required." }, { status: 401 });

  const admin = createAdminClient();
  if (!admin) return NextResponse.json({ error: "Supabase service role key is not configured." }, { status: 500 });

  const role = await getRole(admin, authData.user.id);
  let query = admin.from("campaigns").select("*").order("created_at", { ascending: false });
  if (role === "brand") query = query.eq("profile_id", authData.user.id);
  if (role !== "admin" && role !== "brand") query = query.eq("visibility", "open");

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data: data ?? [], source: "supabase" });
}

export async function POST(request: Request) {
  const auth = await createClient();
  const { data: authData } = await auth.auth.getUser();
  if (!authData.user) return NextResponse.json({ error: "Login required." }, { status: 401 });

  const admin = createAdminClient();
  if (!admin) return NextResponse.json({ error: "Supabase service role key is not configured." }, { status: 500 });

  const role = await getRole(admin, authData.user.id);
  if (role !== "brand" && role !== "admin") {
    return NextResponse.json({ error: "Only brands or admins can create campaigns." }, { status: 403 });
  }

  const parsed = campaignSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid campaign payload." }, { status: 400 });
  }
  const body = parsed.data;

  const profileId = authData.user.id;
  const email = authData.user.email ?? "";
  const brandName = String(body.brand_name ?? authData.user.user_metadata?.full_name ?? "Brand").trim();
  const brandId = await resolveBrandId(admin, {
    requestedBrandId: body.brand_id || "",
    role,
    profileId,
    email,
    brandName,
    website: body.website ?? "",
    industry: body.brand_category ?? ""
  });
  if ("error" in brandId) return NextResponse.json({ error: brandId.error }, { status: brandId.status });

  const { data: campaign, error } = await admin
    .from("campaigns")
    .insert({
      brand_id: brandId.id,
      profile_id: profileId,
      title: body.title,
      campaign_goal: body.campaign_goal ?? "",
      budget_cents: Math.round(Number(body.budget_inr ?? 0) * 100),
      city_focus: body.city_focus ?? "",
      region_focus: body.region_focus ?? "",
      campaign_length: body.campaign_length ?? "",
      target_audience: body.target_audience ?? "",
      platforms: splitList(body.platforms),
      creator_categories: splitList(body.creator_categories),
      freelancer_needs: splitList(body.freelancer_needs),
      languages: splitList(body.languages),
      visibility: body.visibility ?? "open",
      status: "brief"
    })
    .select("*")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const invitedCreatorIds = toUuidArray(body.invited_creator_ids);
  if (invitedCreatorIds.length) {
    await admin.from("campaign_invites").insert(
      invitedCreatorIds.map((creatorId) => ({
        campaign_id: campaign.id,
        creator_id: creatorId,
        status: "invited"
      }))
    );
  }
  await trackEvent(admin, {
    ...userEventBase(authData.user, role),
    eventName: "campaign_created",
    entityType: "campaign",
    entityId: campaign.id,
    metadata: {
      budget_cents: campaign.budget_cents,
      visibility: campaign.visibility,
      city_focus: campaign.city_focus,
      region_focus: campaign.region_focus,
      creator_categories: campaign.creator_categories,
      freelancer_needs: campaign.freelancer_needs,
      invited_creator_count: invitedCreatorIds.length
    }
  });
  return NextResponse.json({ data: campaign, source: "supabase" }, { status: 201 });
}

async function getRole(admin: NonNullable<ReturnType<typeof createAdminClient>>, profileId: string) {
  const { data } = await admin.from("profiles").select("role").eq("id", profileId).maybeSingle();
  return String(data?.role ?? "");
}

async function resolveBrandId(
  admin: NonNullable<ReturnType<typeof createAdminClient>>,
  input: { requestedBrandId: string; role: string; profileId: string; email: string; brandName: string; website: string; industry: string }
): Promise<{ id: string } | { error: string; status: number }> {
  if (input.requestedBrandId) {
    if (input.role !== "admin") return { error: "Brands cannot assign campaigns to another brand id.", status: 403 };
    const { data: brand } = await admin.from("brands").select("id").eq("id", input.requestedBrandId).maybeSingle();
    if (!brand) return { error: "Brand not found.", status: 404 };
    return { id: String(brand.id) };
  }

  const existing = await admin.from("brands").select("*").eq("contact_email", input.email).maybeSingle();
  if (existing.data?.id) return { id: String(existing.data.id) };

  const created = await admin
    .from("brands")
    .insert({
      name: input.brandName || "Brand",
      website: input.website,
      industry: input.industry,
      contact_email: input.email,
      status: "campaign_brief"
    })
    .select("id")
    .single();
  if (created.error || !created.data) return { error: created.error?.message ?? "Could not create brand.", status: 500 };
  return { id: String(created.data.id) };
}

function splitList(value: unknown) {
  if (Array.isArray(value)) return value.map(String).map((item) => item.trim()).filter(Boolean);
  return String(value ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function toUuidArray(value: unknown) {
  const values = Array.isArray(value) ? value : String(value ?? "").trim() ? [String(value)] : [];
  return values.map(String).filter((item) => z.string().uuid().safeParse(item).success);
}
