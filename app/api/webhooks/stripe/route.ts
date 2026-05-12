import { NextResponse } from "next/server";
import { notifyPaymentStatusChanged } from "@/lib/email/workflow";
import { getStripe } from "@/lib/stripe/client";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(request: Request) {
  const stripe = getStripe();
  const body = await request.text();
  const signature = request.headers.get("stripe-signature");

  if (!stripe || !process.env.STRIPE_WEBHOOK_SECRET || !signature) {
    return NextResponse.json({ received: true, mode: "demo_noop" });
  }

  let event: ReturnType<typeof stripe.webhooks.constructEvent>;
  try {
    event = stripe.webhooks.constructEvent(body, signature, process.env.STRIPE_WEBHOOK_SECRET);
  } catch {
    return NextResponse.json({ error: "Invalid webhook signature." }, { status: 400 });
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object;
    const entityType = session.metadata?.entity_type === "freelancer_project" ? "freelancer_project" : "deal";
    const entityId = session.metadata?.entity_id || session.metadata?.deal_id;
    if (entityId) await markFunded(entityType, entityId, session.id);
    return NextResponse.json({ received: true, action: "mark_funded", entity_type: entityType, entity_id: entityId, session_id: session.id });
  }

  return NextResponse.json({ received: true });
}

async function markFunded(entityType: "deal" | "freelancer_project", entityId: string, sessionId: string) {
  const admin = createAdminClient();
  if (!admin) return;
  const table = entityType === "deal" ? "deals" : "freelancer_projects";
  await admin.from(table).update({ payment_status: "funded" }).eq("id", entityId);
  await admin
    .from("payments")
    .update({ status: "funded", funded_at: new Date().toISOString() })
    .eq(entityType === "deal" ? "deal_id" : "freelancer_project_id", entityId)
    .eq("stripe_checkout_session_id", sessionId);
  await notifyPaymentStatusChanged(admin, entityType, entityId, "funded");
}
