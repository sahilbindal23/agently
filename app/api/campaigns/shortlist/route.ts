import { NextResponse } from "next/server";
import { trackEvent, userEventBase } from "@/lib/analytics/track";
import { applyLedgerEvent } from "@/lib/engines/outcome-ledger";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const body = await request.json();
  const campaignId = String(body.campaign_id ?? "").trim();
  const entityType = String(body.entity_type ?? "").trim();
  const entityId = String(body.entity_id ?? "").trim();

  if (!campaignId || !entityId || (entityType !== "creator" && entityType !== "freelancer")) {
    return NextResponse.json({ error: "Campaign, entity type, and entity are required." }, { status: 400 });
  }

  const auth = await createClient();
  const { data: authData } = await auth.auth.getUser();
  if (!authData.user) return NextResponse.json({ error: "Login required." }, { status: 401 });

  const admin = createAdminClient();
  if (!admin) return NextResponse.json({ error: "Supabase service role key is not configured." }, { status: 500 });

  const { data: campaign } = await admin.from("campaigns").select("id, profile_id").eq("id", campaignId).single();
  if (!campaign) return NextResponse.json({ error: "Campaign not found." }, { status: 404 });

  const { data: profile } = await admin.from("profiles").select("role").eq("id", authData.user.id).single();
  if (campaign.profile_id !== authData.user.id && profile?.role !== "admin") {
    return NextResponse.json({ error: "Not allowed to shortlist for this campaign." }, { status: 403 });
  }

  const { data, error } = await admin
    .from("campaign_shortlists")
    .upsert({
      campaign_id: campaignId,
      entity_type: entityType,
      entity_id: entityId,
      fit_score: Number(body.fit_score ?? 0),
      reason: String(body.reason ?? "").trim(),
      status: "shortlisted"
    }, { onConflict: "campaign_id,entity_type,entity_id" })
    .select("*")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  await trackEvent(admin, {
    ...userEventBase(authData.user, profile?.role),
    eventName: "talent_shortlisted",
    entityType,
    entityId,
    metadata: {
      campaign_id: campaignId,
      fit_score: Number(body.fit_score ?? 0),
      reason: String(body.reason ?? "").trim()
    }
  });
  await applyLedgerEvent(admin, {
    campaignId,
    entityType,
    entityId,
    eventName: "talent_shortlisted",
    outcomeLabel: "brand_interest"
  });
  return NextResponse.json({ data }, { status: 201 });
}
