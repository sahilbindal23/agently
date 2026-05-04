import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const allowedStatuses = ["accepted", "changes_requested", "declined"] as const;

export async function POST(request: Request) {
  const body = await request.json();
  const dealId = String(body.deal_id ?? "").trim();
  const status = String(body.status ?? "").trim() as typeof allowedStatuses[number];
  const response = String(body.response ?? "").trim();
  const counter = body.counter && typeof body.counter === "object" ? body.counter as Record<string, unknown> : {};
  const counterAmountCents = Number(counter.amount_cents ?? 0) || null;
  const counterDeliverables = String(counter.scope ?? "").trim();
  const counterDueDate = String(counter.due_date ?? "").trim() || null;
  const counterUsageRights = String(counter.usage_rights ?? "").trim();
  const counterApprovalTerms = String(counter.approval_terms ?? "").trim();

  if (!dealId || !allowedStatuses.includes(status)) {
    return NextResponse.json({ error: "Deal and valid response status are required." }, { status: 400 });
  }

  const auth = await createClient();
  const { data: authData } = await auth.auth.getUser();
  if (!authData.user) return NextResponse.json({ error: "Login required." }, { status: 401 });

  const admin = createAdminClient();
  if (!admin) return NextResponse.json({ error: "Supabase service role key is not configured." }, { status: 500 });

  const { data: deal } = await admin.from("deals").select("*").eq("id", dealId).single();
  if (!deal) return NextResponse.json({ error: "Offer not found." }, { status: 404 });

  const { data: creator } = await admin.from("creators").select("profile_id").eq("id", deal.creator_id).single();
  const { data: profile } = await admin.from("profiles").select("role").eq("id", authData.user.id).single();
  if (creator?.profile_id !== authData.user.id && profile?.role !== "admin") {
    return NextResponse.json({ error: "Not allowed to respond to this offer." }, { status: 403 });
  }

  const counterSummary = status === "changes_requested" ? formatCounterSummary({
    amountCents: counterAmountCents,
    scope: counterDeliverables,
    dueDate: counterDueDate,
    usageRights: counterUsageRights,
    approvalTerms: counterApprovalTerms,
    reason: response
  }) : "";
  const nextStage = status === "accepted" ? "negotiating" : deal.stage;
  const { data, error } = await admin
    .from("deals")
    .update({
      offer_status: status,
      talent_response: response,
      responded_at: new Date().toISOString(),
      stage: nextStage,
      counter_status: status === "changes_requested" ? "pending_brand_review" : deal.counter_status ?? "none",
      counter_amount_cents: status === "changes_requested" ? counterAmountCents : deal.counter_amount_cents,
      counter_deliverables: status === "changes_requested" ? counterDeliverables : deal.counter_deliverables,
      counter_due_date: status === "changes_requested" ? counterDueDate : deal.counter_due_date,
      counter_usage_rights: status === "changes_requested" ? counterUsageRights : deal.counter_usage_rights,
      counter_approval_terms: status === "changes_requested" ? counterApprovalTerms : deal.counter_approval_terms,
      counter_reason: status === "changes_requested" ? response : deal.counter_reason,
      counter_created_at: status === "changes_requested" ? new Date().toISOString() : deal.counter_created_at,
      notes: [deal.notes, response ? `Talent response: ${response}` : "", counterSummary].filter(Boolean).join("\n")
    })
    .eq("id", dealId)
    .select("*")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data });
}

function formatCounterSummary({
  amountCents,
  scope,
  dueDate,
  usageRights,
  approvalTerms,
  reason
}: {
  amountCents: number | null;
  scope: string;
  dueDate: string | null;
  usageRights: string;
  approvalTerms: string;
  reason: string;
}) {
  return [
    "Structured counter submitted:",
    amountCents ? `Counter amount: INR ${Math.round(amountCents / 100)}` : "",
    scope ? `Revised deliverables: ${scope}` : "",
    dueDate ? `Requested due date: ${dueDate}` : "",
    usageRights ? `Usage rights: ${usageRights}` : "",
    approvalTerms ? `Approval terms: ${approvalTerms}` : "",
    reason ? `Reason: ${reason}` : ""
  ].filter(Boolean).join("\n");
}
