import { NextResponse } from "next/server";
import { notifyPaymentStatusChanged } from "@/lib/email/workflow";
import { verifyRazorpayWebhookSignature } from "@/lib/razorpay/client";
import { createAdminClient } from "@/lib/supabase/admin";
import { runWorkflowAutomations } from "@/lib/workflow/automation";

type RazorpayWebhookBody = {
  event?: string;
  payload?: {
    order?: { entity?: { id?: string; notes?: Record<string, string> } };
    payment?: { entity?: { id?: string; order_id?: string; notes?: Record<string, string> } };
  };
};

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
  if (event.event === "payment.captured" || event.event === "order.paid") {
    const payment = event.payload?.payment?.entity;
    const order = event.payload?.order?.entity;
    const orderId = payment?.order_id || order?.id;
    const paymentId = payment?.id ?? null;
    const notes = payment?.notes || order?.notes || {};
    const entityType = notes.entity_type === "freelancer_project" ? "freelancer_project" : "deal";
    const entityId = notes.entity_id;

    if (orderId && entityId) {
      await markFunded(entityType, entityId, orderId, paymentId, event);
      return NextResponse.json({ received: true, action: "mark_funded", entity_type: entityType, entity_id: entityId, razorpay_order_id: orderId });
    }
  }

  return NextResponse.json({ received: true });
}

async function markFunded(
  entityType: "deal" | "freelancer_project",
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
  await notifyPaymentStatusChanged(admin, entityType, entityId, "funded");
  await runWorkflowAutomations(admin);
}
