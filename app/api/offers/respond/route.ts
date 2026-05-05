import { NextResponse } from "next/server";
import { z } from "zod";
import { trackEvent, userEventBase } from "@/lib/analytics/track";
import { offerRespondedEmail, sendEmail } from "@/lib/email/send";
import { applyLedgerEvent } from "@/lib/engines/outcome-ledger";
import { ensurePaymentRecordForEntity } from "@/lib/payments/workflow";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const counterSchema = z.object({
  amount_cents: z.coerce.number().int().min(0).optional(),
  scope: z.string().trim().max(2000).optional(),
  due_date: z.string().trim().max(50).optional(),
  usage_rights: z.string().trim().max(500).optional(),
  approval_terms: z.string().trim().max(500).optional()
}).nullish();

const schema = z.object({
  deal_id: z.string().trim().min(1, "Deal ID is required."),
  status: z.enum(["accepted", "changes_requested", "declined"]),
  response: z.string().trim().max(2000).optional().default(""),
  acknowledge_high_risk: z.boolean().optional().default(false),
  counter: counterSchema
});

export async function POST(request: Request) {
  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid request." }, { status: 400 });
  }
  const { deal_id: dealId, status, response, acknowledge_high_risk: acknowledgeHighRisk, counter } = parsed.data;
  const counterAmountCents = Number(counter?.amount_cents ?? 0) || null;
  const counterDeliverables = counter?.scope ?? "";
  const counterDueDate = counter?.due_date || null;
  const counterUsageRights = counter?.usage_rights ?? "";
  const counterApprovalTerms = counter?.approval_terms ?? "";

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

  if (status === "accepted" && !acknowledgeHighRisk) {
    const { data: contract } = await admin
      .from("contracts")
      .select("risk_level")
      .eq("deal_id", dealId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (contract?.risk_level === "high_risk") {
      return NextResponse.json({
        error: "This contract is high risk. Acknowledge the contract warning before accepting."
      }, { status: 409 });
    }
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
  const nextPaymentStatus = status === "accepted" && !["funded", "release_ready", "released"].includes(String(deal.payment_status ?? ""))
    ? "unpaid"
    : deal.payment_status;
  const { data, error } = await admin
    .from("deals")
    .update({
      offer_status: status,
      talent_response: response,
      responded_at: new Date().toISOString(),
      stage: nextStage,
      payment_status: nextPaymentStatus,
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
  if (status === "accepted") {
    await ensurePaymentRecordForEntity(admin, "deal", data, nextPaymentStatus);
  }
  await trackEvent(admin, {
    ...userEventBase(authData.user, profile?.role),
    eventName: status === "accepted" ? "offer_accepted" : status === "changes_requested" ? "offer_countered" : "offer_declined",
    entityType: "deal",
    entityId: dealId,
    metadata: {
      creator_id: deal.creator_id,
      brand_id: deal.brand_id,
      original_amount_cents: deal.amount_cents,
      counter_amount_cents: status === "changes_requested" ? counterAmountCents : null,
      has_response: Boolean(response)
    }
  });
  await applyLedgerEvent(admin, {
    amountCents: Number(deal.amount_cents ?? 0),
    campaignId: deal.campaign_id ? String(deal.campaign_id) : null,
    counterAmountCents,
    entityId: String(deal.creator_id),
    entityType: "creator",
    eventName: status === "accepted" ? "offer_accepted" : status === "changes_requested" ? "offer_countered" : "offer_declined",
    offerId: dealId,
    outcomeLabel: status === "accepted" ? "accepted" : status === "changes_requested" ? "countered" : "declined",
    responseStatus: status
  });
  const [{ data: brand }, { data: creatorProfileRow }] = await Promise.all([
    admin.from("brands").select("contact_email, name").eq("id", deal.brand_id).maybeSingle(),
    admin.from("profiles").select("email, full_name").eq("id", creator?.profile_id ?? "").maybeSingle()
  ]);
  if (brand?.contact_email) {
    sendEmail({
      to: brand.contact_email,
      subject: `${creatorProfileRow?.full_name ?? "Creator"} ${status === "accepted" ? "accepted" : status === "declined" ? "declined" : "countered"} your offer — ${deal.title}`,
      html: offerRespondedEmail({
        brandEmail: brand.contact_email,
        brandName: brand.name ?? "Brand",
        dealTitle: String(deal.title),
        status,
        creatorName: creatorProfileRow?.full_name ?? "The creator",
        responseNote: response || undefined
      })
    });
  }

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
