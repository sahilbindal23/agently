import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const allowedStatuses = ["approved", "revision_requested"] as const;

export async function POST(request: Request) {
  const body = await request.json();
  const deliverableId = String(body.deliverable_id ?? "").trim();
  const status = String(body.status ?? "").trim() as typeof allowedStatuses[number];
  const reviewNotes = String(body.review_notes ?? "").trim();

  if (!deliverableId || !allowedStatuses.includes(status)) {
    return NextResponse.json({ error: "Deliverable and valid review status are required." }, { status: 400 });
  }

  const auth = await createClient();
  const { data: authData } = await auth.auth.getUser();
  if (!authData.user) return NextResponse.json({ error: "Login required." }, { status: 401 });

  const admin = createAdminClient();
  if (!admin) return NextResponse.json({ error: "Supabase service role key is not configured." }, { status: 500 });

  const { data: profile } = await admin.from("profiles").select("role").eq("id", authData.user.id).single();
  if (profile?.role !== "admin" && profile?.role !== "brand") {
    return NextResponse.json({ error: "Only brands or admins can review deliverables." }, { status: 403 });
  }

  const { data: deliverable } = await admin.from("deliverables").select("*").eq("id", deliverableId).single();
  if (!deliverable) return NextResponse.json({ error: "Deliverable not found." }, { status: 404 });

  const { data, error } = await admin
    .from("deliverables")
    .update({
      status,
      review_notes: reviewNotes,
      approved_at: status === "approved" ? new Date().toISOString() : null
    })
    .eq("id", deliverableId)
    .select("*")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  if (deliverable.deal_id) {
    await updateDealAfterReview(admin, String(deliverable.deal_id), status);
  }

  if (deliverable.freelancer_project_id) {
    await updateProjectAfterReview(admin, String(deliverable.freelancer_project_id), status);
  }

  return NextResponse.json({ data });
}

async function updateDealAfterReview(admin: NonNullable<ReturnType<typeof createAdminClient>>, dealId: string, status: "approved" | "revision_requested") {
  const nextDeliverableStatus = status === "approved" ? "approved" : "revision_requested";
  const { data: deal } = await admin
    .from("deals")
    .update(status === "approved"
      ? { deliverable_status: nextDeliverableStatus, stage: "approved", payment_status: "release_ready" }
      : { deliverable_status: nextDeliverableStatus, stage: "live" })
    .eq("id", dealId)
    .select("*")
    .single();

  if (status === "approved" && deal) {
    await admin.from("payments").upsert({
      deal_id: dealId,
      amount_cents: Number(deal.amount_cents ?? 0),
      platform_fee_cents: Math.round(Number(deal.amount_cents ?? 0) * 0.1),
      creator_payout_cents: Math.max(0, Number(deal.amount_cents ?? 0) - Math.round(Number(deal.amount_cents ?? 0) * 0.1)),
      status: "release_ready",
      funded_at: new Date().toISOString()
    }, { onConflict: "deal_id" });
  }
}

async function updateProjectAfterReview(admin: NonNullable<ReturnType<typeof createAdminClient>>, projectId: string, status: "approved" | "revision_requested") {
  await admin
    .from("freelancer_projects")
    .update(status === "approved"
      ? { deliverable_status: "approved", payment_status: "release_ready" }
      : { deliverable_status: "revision_requested" })
    .eq("id", projectId);
}
