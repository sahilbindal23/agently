import { NextResponse } from "next/server";
import { buildMockSocialSnapshot } from "@/lib/social/mock-sync";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const body = await request.json();
  const accountId = String(body.account_id ?? "").trim();
  if (!accountId) return NextResponse.json({ error: "Connected account is required." }, { status: 400 });

  const auth = await createClient();
  const { data: authData } = await auth.auth.getUser();
  if (!authData.user) return NextResponse.json({ error: "Login required." }, { status: 401 });

  const admin = createAdminClient();
  if (!admin) return NextResponse.json({ error: "Supabase service role key is not configured." }, { status: 500 });

  const { data: account } = await admin.from("connected_social_accounts").select("*").eq("id", accountId).single();
  if (!account) return NextResponse.json({ error: "Connected account not found." }, { status: 404 });
  if (account.profile_id !== authData.user.id) {
    const { data: profile } = await admin.from("profiles").select("role").eq("id", authData.user.id).single();
    if (profile?.role !== "admin") return NextResponse.json({ error: "Not allowed to sync this account." }, { status: 403 });
  }

  const [{ data: creator }, { data: platforms }] = await Promise.all([
    admin.from("creators").select("*").eq("id", account.creator_id).single(),
    admin.from("creator_platforms").select("*").eq("creator_id", account.creator_id)
  ]);
  if (!creator) return NextResponse.json({ error: "Creator not found." }, { status: 404 });

  const matchingPlatform = (platforms ?? []).find((platform) => providerMatchesPlatform(String(account.provider), String(platform.platform)));
  const snapshot = buildMockSocialSnapshot({
    provider: account.provider,
    handle: String(account.handle ?? ""),
    creator,
    platform: matchingPlatform
  });

  const { data: inserted, error } = await admin
    .from("social_metric_snapshots")
    .insert({
      connected_account_id: account.id,
      creator_id: account.creator_id,
      provider: account.provider,
      ...snapshot
    })
    .select("*")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const latestSignals = await getCreatorLatestSignals(admin, String(account.creator_id));
  await Promise.all([
    admin.from("connected_social_accounts").update({ last_synced_at: new Date().toISOString(), status: "synced" }).eq("id", account.id),
    admin.from("creators").update({
      india_audience_percent: latestSignals.indiaAudience,
      monetization_score: latestSignals.monetizationScore,
      valuation_score: latestSignals.valuationScore,
      verification_status: "verified",
      verification_tier: latestSignals.highConfidence ? "social" : "profile"
    }).eq("id", account.creator_id)
  ]);

  return NextResponse.json({ data: inserted, summary: latestSignals });
}

function providerMatchesPlatform(provider: string, platform: string) {
  return platform.toLowerCase().includes(provider === "youtube" ? "youtube" : provider);
}

async function getCreatorLatestSignals(admin: NonNullable<ReturnType<typeof createAdminClient>>, creatorId: string) {
  const { data } = await admin
    .from("social_metric_snapshots")
    .select("*")
    .eq("creator_id", creatorId)
    .order("synced_at", { ascending: false });

  const snapshots = data ?? [];
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
