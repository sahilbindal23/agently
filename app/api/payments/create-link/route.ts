import { NextResponse } from "next/server";
import { getAgentlyData } from "@/lib/db/live-data";
import { createAdminClient } from "@/lib/supabase/admin";
import { getStripe } from "@/lib/stripe/client";

export async function POST(request: Request) {
  const { deal_id } = await request.json();
  const { deals } = await getAgentlyData();
  const deal = deals.find((item) => item.id === deal_id);
  if (!deal) return NextResponse.json({ error: "Deal not found" }, { status: 404 });

  const stripe = getStripe();
  const appUrl = process.env.APP_URL ?? "http://localhost:3000";

  if (!stripe) {
    await markPending(deal.id, `cs_demo_${deal.id}`);
    return NextResponse.json({
      checkout_url: `${appUrl}/payments?demo_checkout=${deal.id}`,
      stripe_checkout_session_id: `cs_demo_${deal.id}`,
      source: "demo_fallback"
    });
  }

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: deal.currency,
          unit_amount: deal.amount_cents,
          product_data: { name: deal.title, description: deal.deliverables }
        }
      }
    ],
    metadata: { deal_id: deal.id },
    success_url: `${appUrl}/deals/${deal.id}?payment=success`,
    cancel_url: `${appUrl}/deals/${deal.id}?payment=cancelled`
  });

  await markPending(deal.id, session.id);

  return NextResponse.json({
    checkout_url: session.url,
    stripe_checkout_session_id: session.id
  });
}

async function markPending(dealId: string, sessionId: string) {
  const admin = createAdminClient();
  if (!admin) return;
  const { data: deal } = await admin.from("deals").select("*").eq("id", dealId).single();
  if (!deal) return;
  const amount = Number(deal.amount_cents ?? 0);
  const platformFee = Math.round(amount * 0.1);

  await admin.from("deals").update({ payment_status: "pending" }).eq("id", dealId);
  await admin.from("payments").upsert({
    deal_id: dealId,
    stripe_checkout_session_id: sessionId,
    amount_cents: amount,
    platform_fee_cents: platformFee,
    creator_payout_cents: Math.max(0, amount - platformFee),
    status: "pending"
  }, { onConflict: "deal_id" });
}
