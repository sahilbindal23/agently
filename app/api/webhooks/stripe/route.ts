import { NextResponse } from "next/server";
import { getStripe } from "@/lib/stripe/client";

export async function POST(request: Request) {
  const stripe = getStripe();
  const body = await request.text();
  const signature = request.headers.get("stripe-signature");

  if (!stripe || !process.env.STRIPE_WEBHOOK_SECRET || !signature) {
    return NextResponse.json({ received: true, mode: "demo_noop" });
  }

  const event = stripe.webhooks.constructEvent(body, signature, process.env.STRIPE_WEBHOOK_SECRET);

  if (event.type === "checkout.session.completed") {
    const session = event.data.object;
    const dealId = session.metadata?.deal_id;
    // Production path: update payments.status = funded and deals.payment_status = funded in Supabase.
    return NextResponse.json({ received: true, action: "mark_funded", deal_id: dealId, session_id: session.id });
  }

  return NextResponse.json({ received: true });
}
