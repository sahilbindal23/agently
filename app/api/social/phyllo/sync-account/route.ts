import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth/session";
import { fetchAccountProfile, phylloPlatformName } from "@/lib/social/phyllo-client";
import { createAdminClient } from "@/lib/supabase/admin";

const schema = z.object({
  account_id: z.string().trim().min(1),
  work_platform_id: z.string().trim().min(1)
});

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Login required." }, { status: 401 });

  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid request." }, { status: 400 });

  const admin = createAdminClient();
  if (!admin) return NextResponse.json({ error: "Service role not configured." }, { status: 500 });

  // Fetch the fresh profile from Phyllo
  const profile = await fetchAccountProfile(parsed.data.account_id);
  if (!profile.ok) {
    return NextResponse.json({ error: `Phyllo profile fetch failed: ${profile.error}` }, { status: 502 });
  }

  // Map work_platform_id -> our provider string
  const provider = phylloPlatformName(profile.work_platform_id || parsed.data.work_platform_id);
  if (!provider) {
    return NextResponse.json({ error: `Unsupported Phyllo work_platform_id ${parsed.data.work_platform_id}` }, { status: 400 });
  }

  // Resolve which entity (creator/brand/freelancer) this connection belongs to
  const role = user.role;
  let entityKey: "creator_id" | "brand_id" | "freelancer_id" = "creator_id";
  let entityId: string | null = null;
  if (role === "brand") {
    const { data: brand } = await admin.from("brands").select("id").eq("contact_email", String(user.email).toLowerCase()).maybeSingle();
    if (!brand) return NextResponse.json({ error: "Brand intake required before connecting socials." }, { status: 404 });
    entityKey = "brand_id"; entityId = String(brand.id);
  } else if (role === "freelancer") {
    const { data: freelancer } = await admin.from("freelancers").select("id").eq("profile_id", user.id).maybeSingle();
    if (!freelancer) return NextResponse.json({ error: "Freelancer profile required before connecting socials." }, { status: 404 });
    entityKey = "freelancer_id"; entityId = String(freelancer.id);
  } else if (role === "creator") {
    const { data: creator } = await admin.from("creators").select("id").eq("profile_id", user.id).maybeSingle();
    if (!creator) return NextResponse.json({ error: "Creator profile required before connecting socials." }, { status: 404 });
    entityKey = "creator_id"; entityId = String(creator.id);
  } else {
    return NextResponse.json({ error: "This role cannot connect social accounts." }, { status: 403 });
  }

  const handle = profile.platform_username ?? "phyllo-account";
  const accountUrl = profile.url ?? "";
  const sourceTag = `phyllo_${provider}`;
  const followers = profile.followers ?? null;

  // Lookup-then-update-or-insert (partial unique indexes don't satisfy
  // Postgres ON CONFLICT - same pattern as the manual connect route).
  const { data: existing } = await admin
    .from("connected_social_accounts")
    .select("id")
    .eq("phyllo_account_id", profile.account_id)
    .maybeSingle();

  const payload = {
    profile_id: user.id,
    [entityKey]: entityId,
    provider,
    handle,
    account_url: accountUrl,
    platform_account_id: profile.account_id,
    phyllo_account_id: profile.account_id,
    phyllo_work_platform_id: profile.work_platform_id,
    status: "oauth_connected",
    scopes: ["IDENTITY", "ENGAGEMENT"]
  };

  let row: Record<string, unknown> | null = null;
  let saveError: { message: string } | null = null;
  if (existing?.id) {
    const r = await admin.from("connected_social_accounts").update(payload).eq("id", existing.id).select("*").single();
    row = r.data; saveError = r.error;
  } else {
    const r = await admin.from("connected_social_accounts").insert(payload).select("*").single();
    row = r.data; saveError = r.error;
  }
  if (saveError || !row) return NextResponse.json({ error: saveError?.message ?? "Could not save connection." }, { status: 500 });

  // For creators, also mirror the metrics into creator_platforms so the
  // marketplace cards and recommendation engine read fresh numbers.
  if (entityKey === "creator_id" && entityId) {
    const platformLabel = provider === "instagram" ? "Instagram" : provider === "youtube" ? "YouTube" : provider === "facebook" ? "Facebook" : provider === "twitter" ? "Twitter" : provider;
    const platformRow = {
      creator_id: entityId,
      platform: platformLabel,
      handle,
      url: accountUrl,
      followers,
      metric_source: sourceTag,
      last_scrape_attempted_at: new Date().toISOString(),
      last_scrape_status: "success",
      last_scrape_followers: followers
    };
    const { data: existingPlatform } = await admin
      .from("creator_platforms")
      .select("id")
      .eq("creator_id", entityId)
      .eq("platform", platformLabel)
      .eq("handle", handle)
      .maybeSingle();
    if (existingPlatform?.id) {
      await admin.from("creator_platforms").update(platformRow).eq("id", existingPlatform.id);
    } else {
      await admin.from("creator_platforms").insert(platformRow);
    }
  }

  return NextResponse.json({
    data: {
      account_id: profile.account_id,
      provider,
      handle,
      followers,
      following: profile.following,
      content_count: profile.content_count,
      is_verified: profile.is_verified,
      profile_url: accountUrl
    }
  });
}
