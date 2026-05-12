import { NextResponse } from "next/server";
import { trackEvent, userEventBase } from "@/lib/analytics/track";
import { applyLedgerEvent } from "@/lib/engines/outcome-ledger";
import { notifyFreelancerProjectSent } from "@/lib/email/workflow";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const body = await request.json();
  const campaignId = String(body.campaign_id ?? "").trim();
  const freelancerId = String(body.freelancer_id ?? "").trim();
  const title = String(body.title ?? "").trim();
  const amountCents = Math.round(Number(body.amount_inr ?? 0) * 100);

  if (!campaignId || !freelancerId || !title || !amountCents) {
    return NextResponse.json({ error: "Campaign, freelancer, title, and amount are required." }, { status: 400 });
  }

  const auth = await createClient();
  const { data: authData } = await auth.auth.getUser();
  if (!authData.user) return NextResponse.json({ error: "Login required." }, { status: 401 });

  const admin = createAdminClient();
  if (!admin) return NextResponse.json({ error: "Supabase service role key is not configured." }, { status: 500 });

  const { data: campaign } = await admin.from("campaigns").select("*").eq("id", campaignId).single();
  if (!campaign) return NextResponse.json({ error: "Campaign not found." }, { status: 404 });

  const { data: profile } = await admin.from("profiles").select("role").eq("id", authData.user.id).single();
  if (campaign.profile_id !== authData.user.id && profile?.role !== "admin") {
    return NextResponse.json({ error: "Not allowed to create a project from this campaign." }, { status: 403 });
  }

  const { data, error } = await admin
    .from("freelancer_projects")
    .insert({
      campaign_id: campaignId,
      freelancer_id: freelancerId,
      brand_id: campaign.brand_id,
      title,
      scope: String(body.scope ?? "").trim(),
      amount_cents: amountCents,
      currency: "inr",
      due_date: body.due_date || null,
      usage_context: String(body.usage_context ?? "").trim(),
      approval_terms: String(body.approval_terms ?? "").trim(),
      status: "submitted",
      payment_status: "unpaid",
      notes: String(body.notes ?? "").trim()
    })
    .select("*")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  await trackEvent(admin, {
    ...userEventBase(authData.user, profile?.role),
    eventName: "freelancer_project_sent",
    entityType: "freelancer_project",
    entityId: data.id,
    metadata: {
      campaign_id: campaignId,
      freelancer_id: freelancerId,
      brand_id: campaign.brand_id,
      amount_cents: amountCents
    }
  });
  await applyLedgerEvent(admin, {
    amountCents,
    campaignId,
    entityId: freelancerId,
    entityType: "freelancer",
    eventName: "freelancer_project_sent",
    freelancerProjectId: data.id,
    outcomeLabel: "offer_sent"
  });
  await notifyFreelancerProjectSent(admin, String(data.id));
  return NextResponse.json({ data }, { status: 201 });
}
