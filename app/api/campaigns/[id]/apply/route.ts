import { NextResponse } from "next/server";
import { trackEvent, userEventBase } from "@/lib/analytics/track";
import { writeAuditLog } from "@/lib/security/audit";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

// Creator applies to an open campaign.
//
// Constraints (enforced both here and at the RLS layer):
//   - Caller must be a creator with a profile in our system
//   - Target campaign must be visibility = 'open'
//   - One application per (campaign, creator) — unique constraint
//   - Idempotent: re-applying returns the existing row, no error

export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await createClient();
  const { data: authData } = await auth.auth.getUser();
  if (!authData.user) return NextResponse.json({ error: "Login required." }, { status: 401 });

  const admin = createAdminClient();
  if (!admin) return NextResponse.json({ error: "Supabase service role key is not configured." }, { status: 500 });

  const params = await context.params;
  const campaignId = String(params.id ?? "").trim();
  if (!campaignId) return NextResponse.json({ error: "Campaign id missing." }, { status: 400 });

  const { data: profile } = await admin
    .from("profiles")
    .select("role")
    .eq("id", authData.user.id)
    .maybeSingle();
  if (profile?.role !== "creator") {
    return NextResponse.json({ error: "Only creators can apply to campaigns." }, { status: 403 });
  }

  const { data: creator } = await admin
    .from("creators")
    .select("id, display_name")
    .eq("profile_id", authData.user.id)
    .maybeSingle();
  if (!creator) {
    return NextResponse.json({ error: "Complete your creator intake before applying to campaigns." }, { status: 404 });
  }

  const { data: campaign } = await admin
    .from("campaigns")
    .select("id, title, visibility, brand_id, profile_id")
    .eq("id", campaignId)
    .maybeSingle();
  if (!campaign) return NextResponse.json({ error: "Campaign not found." }, { status: 404 });
  if (campaign.visibility !== "open") {
    return NextResponse.json({ error: "This campaign is invite-only — wait for the brand to reach out." }, { status: 403 });
  }

  // Idempotent insert: if an application already exists, return it.
  const { data: existing } = await admin
    .from("campaign_invites")
    .select("id, status, source")
    .eq("campaign_id", campaignId)
    .eq("creator_id", creator.id)
    .maybeSingle();
  if (existing) {
    return NextResponse.json({
      status: "already_applied",
      application_id: existing.id,
      message: existing.source === "brand_invite"
        ? "This brand already invited you — check your offers."
        : "You've already applied to this campaign."
    });
  }

  const { data: inserted, error } = await admin
    .from("campaign_invites")
    .insert({
      campaign_id: campaignId,
      creator_id: creator.id,
      status: "applied",
      source: "creator_application"
    })
    .select("id")
    .single();
  if (error || !inserted) {
    return NextResponse.json({ error: error?.message ?? "Could not record application." }, { status: 500 });
  }

  // Telemetry for the brand-side dashboard + recommendation engine signals.
  await trackEvent(admin, {
    ...userEventBase(authData.user, "creator"),
    eventName: "campaign_application_submitted",
    entityType: "campaign",
    entityId: campaignId,
    metadata: {
      creator_id: creator.id,
      campaign_title: campaign.title,
      brand_id: campaign.brand_id
    }
  });

  await writeAuditLog(admin, {
    actorProfileId: authData.user.id,
    actorRole: "creator",
    action: "campaign_application_submitted",
    entityType: "campaign",
    entityId: campaignId,
    metadata: { creator_id: creator.id, application_id: inserted.id }
  });

  return NextResponse.json({
    status: "applied",
    application_id: inserted.id,
    message: "Application submitted. The brand will see it on their campaign dashboard."
  });
}
