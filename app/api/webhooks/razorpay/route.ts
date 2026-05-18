import { NextResponse } from "next/server";
import { trackEvent } from "@/lib/analytics/track";
import { notifyPaymentStatusChanged } from "@/lib/email/workflow";
import { applyLedgerEvent } from "@/lib/engines/outcome-ledger";
import { verifyRazorpayWebhookSignature } from "@/lib/razorpay/client";
import { createAdminClient } from "@/lib/supabase/admin";
import { runWorkflowAutomations } from "@/lib/workflow/automation";

type RazorpayPaymentEntity = {
  id?: string;
  order_id?: string;
  status?: string;
  amount?: number;
  currency?: string;
  notes?: Record<string, string>;
  error_code?: string;
  error_description?: string;
  error_source?: string;
  error_step?: string;
  error_reason?: string;
};

type RazorpayWebhookBody = {
  event?: string;
  payload?: {
    order?: { entity?: { id?: string; notes?: Record<string, string> } };
    payment?: { entity?: RazorpayPaymentEntity };
  };
};

type AdminClient = NonNullable<ReturnType<typeof createAdminClient>>;
type EntityType = "deal" | "freelancer_project";

export async function POST(request: Request) {
  const body = await request.text();
  const signature = request.headers.get("x-razorpay-signature") ?? "";

  if (!process.env.RAZORPAY_WEBHOOK_SECRET || !signature) {
    return NextResponse.json({ received: true, mode: "demo_noop" });
  }

  if (!verifyRazorpayWebhookSignature(body, signature)) {
    return NextResponse.json({ error: "Invalid webhook signature." }, { status: 400 });
  }

  const event = JSON.parse(body) as RazorpayWebhookBody;
  const payment = event.payload?.payment?.entity;
  const order = event.payload?.order?.entity;
  const orderId = payment?.order_id || order?.id || null;
  const paymentId = payment?.id ?? null;
  const notes = payment?.notes || order?.notes || {};
  const entityType: EntityType = notes.entity_type === "freelancer_project" ? "freelancer_project" : "deal";
  const entityId = notes.entity_id;

  if (event.event === "payment.captured" || event.event === "order.paid") {
    if (orderId && entityId) {
      await markFunded(entityType, entityId, orderId, paymentId, event);
      return NextResponse.json({ received: true, action: "mark_funded", entity_type: entityType, entity_id: entityId, razorpay_order_id: orderId });
    }
  }

  if (event.event === "payment.failed") {
    if (entityId) {
      await markFailed(entityType, entityId, orderId, paymentId, payment);
      return NextResponse.json({ received: true, action: "mark_failed", entity_type: entityType, entity_id: entityId, razorpay_order_id: orderId });
    }
  }

  // Other events (refund.*, etc.) just acknowledged for now. Add
  // handlers here as the workflow needs them.
  return NextResponse.json({ received: true, event: event.event ?? null });
}

async function markFunded(
  entityType: EntityType,
  entityId: string,
  orderId: string,
  paymentId: string | null,
  payload: RazorpayWebhookBody
) {
  const admin = createAdminClient();
  if (!admin) return;
  const table = entityType === "deal" ? "deals" : "freelancer_projects";
  const paymentColumn = entityType === "deal" ? "deal_id" : "freelancer_project_id";
  const fundedAt = new Date().toISOString();

  // Idempotency: the synchronous verify-razorpay handler usually marks
  // funded first because it runs inside the user's checkout callback.
  // The webhook is a backup for cases where the user closed the tab
  // before the redirect fired. Don't re-fire analytics / email /
  // automations if the sync path already handled this.
  const { data: row } = await admin.from(table).select("*").eq("id", entityId).single();
  const alreadyFunded = ["funded", "release_ready", "released"].includes(String(row?.payment_status ?? ""));

  await admin.from(table).update({ payment_status: "funded" }).eq("id", entityId);
  await admin
    .from("payments")
    .update({
      provider: "razorpay",
      provider_payload: payload as unknown as Record<string, unknown>,
      razorpay_order_id: orderId,
      razorpay_payment_id: paymentId,
      status: "funded",
      funded_at: fundedAt
    })
    .eq(paymentColumn, entityId)
    .eq("razorpay_order_id", orderId);

  if (!alreadyFunded && row) {
    await trackEvent(admin, {
      eventName: "payment_status_updated",
      entityType,
      entityId,
      metadata: {
        status: "funded",
        source: "razorpay_webhook",
        razorpay_order_id: orderId,
        razorpay_payment_id: paymentId
      }
    });
    await applyFundedLedger(admin, entityType, entityId, row);
    await notifyPaymentStatusChanged(admin, entityType, entityId, "funded");
    await runWorkflowAutomations(admin);
  }
}

async function markFailed(
  entityType: EntityType,
  entityId: string,
  orderId: string | null,
  paymentId: string | null,
  payment: RazorpayPaymentEntity | undefined
) {
  const admin = createAdminClient();
  if (!admin) return;
  const table = entityType === "deal" ? "deals" : "freelancer_projects";
  const paymentColumn = entityType === "deal" ? "deal_id" : "freelancer_project_id";

  // payments.status enum does not include "failed", so we revert the
  // pending → unpaid transition (lets the brand retry from the
  // existing deal) and stash the failure context in provider_payload
  // for support / debugging.
  const { data: row } = await admin.from(table).select("payment_status").eq("id", entityId).single();
  const currentStatus = String(row?.payment_status ?? "");
  if (currentStatus === "pending") {
    await admin.from(table).update({ payment_status: "unpaid" }).eq("id", entityId);
  }

  if (orderId) {
    await admin
      .from("payments")
      .update({
        provider: "razorpay",
        status: "unpaid",
        razorpay_payment_id: paymentId,
        provider_payload: {
          last_failure: {
            captured_at: new Date().toISOString(),
            error_code: payment?.error_code ?? null,
            error_description: payment?.error_description ?? null,
            error_source: payment?.error_source ?? null,
            error_step: payment?.error_step ?? null,
            error_reason: payment?.error_reason ?? null
          }
        }
      })
      .eq(paymentColumn, entityId)
      .eq("razorpay_order_id", orderId);
  }

  await trackEvent(admin, {
    eventName: "payment_failed",
    entityType,
    entityId,
    metadata: {
      source: "razorpay_webhook",
      razorpay_order_id: orderId,
      razorpay_payment_id: paymentId,
      error_code: payment?.error_code ?? null,
      error_description: payment?.error_description ?? null,
      error_reason: payment?.error_reason ?? null,
      error_step: payment?.error_step ?? null,
      error_source: payment?.error_source ?? null
    }
  });
}

async function applyFundedLedger(
  admin: AdminClient,
  entityType: EntityType,
  entityId: string,
  row: Record<string, unknown>
) {
  if (entityType === "deal") {
    await applyLedgerEvent(admin, {
      amountCents: Number(row.amount_cents ?? 0),
      campaignId: row.campaign_id ? String(row.campaign_id) : null,
      entityId: String(row.creator_id ?? ""),
      entityType: "creator",
      eventName: "payment_status_updated",
      offerId: entityId,
      paymentStatus: "funded"
    });
    return;
  }
  await applyLedgerEvent(admin, {
    amountCents: Number(row.amount_cents ?? 0),
    campaignId: row.campaign_id ? String(row.campaign_id) : null,
    entityId: String(row.freelancer_id ?? ""),
    entityType: "freelancer",
    eventName: "payment_status_updated",
    freelancerProjectId: entityId,
    paymentStatus: "funded"
  });
}
