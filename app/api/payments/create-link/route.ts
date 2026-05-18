import { NextResponse } from "next/server";
import { z } from "zod";
import { trackEvent, userEventBase } from "@/lib/analytics/track";
import { ensurePaymentRecordForEntity } from "@/lib/payments/workflow";
import { createRazorpayOrder, getRazorpayPublicKey, isRazorpayConfigured } from "@/lib/razorpay/client";
import { gateRateLimit } from "@/lib/security/rate-limit-gate";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { getStripe } from "@/lib/stripe/client";

const schema = z.object({
  entity_type: z.enum(["deal", "freelancer_project"]).default("deal"),
  entity_id: z.string().trim().optional(),
  deal_id: z.string().trim().optional()
}).transform(d => ({ ...d, entity_id: (d.entity_id || d.deal_id || "").trim() }))
  .refine(d => d.entity_id.length > 0, { message: "Valid payment target is required." });

export async function POST(request: Request) {
  // Payment-link creation is a critical-money path - fail-closed if the rate-
  // limit RPC is unavailable (configured in RATE_LIMITS for this bucket).
  const gate = await gateRateLimit(request, "payments:create-link");
  if (gate) return gate;

  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid request." }, { status: 400 });
  }
  const { entity_type: entityType, entity_id: entityId } = parsed.data;

  const auth = await createClient();
  const { data: authData } = await auth.auth.getUser();
  if (!authData.user) return NextResponse.json({ error: "Login required." }, { status: 401 });

  const admin = createAdminClient();
  if (!admin) return NextResponse.json({ error: "Supabase service role key is not configured." }, { status: 500 });

  const profile = await getProfileRole(admin, authData.user.id);
  if (profile !== "admin" && profile !== "brand") {
    return NextResponse.json({ error: "Only brands or admins can create payment links." }, { status: 403 });
  }

  const target = entityType === "deal" ? await getDealTarget(admin, entityId) : await getProjectTarget(admin, entityId);
  if (!target) return NextResponse.json({ error: "Payment target not found." }, { status: 404 });
  if (!["accepted", "approved"].includes(target.acceptanceStatus)) {
    return NextResponse.json({ error: "The offer or project must be accepted before funding." }, { status: 409 });
  }
  if (entityType === "deal" && target.contractReady === false) {
    return NextResponse.json({ error: "Attach and scan the contract — or have both parties sign the Agently agreement — before funding this creator deal." }, { status: 409 });
  }

  if (profile === "brand") {
    const brandIds = await getBrandIdsForUser(admin, authData.user.id, authData.user.email ?? "");
    if (!target.brandId || !brandIds.includes(target.brandId)) {
      return NextResponse.json({ error: "Not allowed to fund this item." }, { status: 403 });
    }
  }

  if (isRazorpayConfigured()) {
    try {
      const razorpayCurrency = normalizeRazorpayCurrency(target.currency);
      const order = await createRazorpayOrder({
        amount: target.amountCents,
        currency: razorpayCurrency,
        receipt: `${entityType}-${entityId}`.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 40),
        notes: {
          app: "agently",
          entity_type: entityType,
          entity_id: entityId,
          brand_id: target.brandId,
          title: target.title.slice(0, 120)
        }
      });

      await markPending(admin, entityType, entityId, {
        provider: "razorpay",
        providerPayload: order as unknown as Record<string, unknown>,
        razorpayOrderId: order.id
      });
      await trackEvent(admin, {
        ...userEventBase(authData.user, profile),
        eventName: "payment_link_created",
        entityType,
        entityId,
        metadata: { source: "razorpay", razorpay_order_id: order.id, amount_cents: target.amountCents, currency: razorpayCurrency }
      });

      return NextResponse.json({
        provider: "razorpay",
        razorpay_key_id: getRazorpayPublicKey(),
        razorpay_order_id: order.id,
        amount_cents: target.amountCents,
        currency: order.currency || razorpayCurrency,
        name: "Agently protected payout",
        description: target.title
      });
    } catch (error) {
      return NextResponse.json({ error: error instanceof Error ? error.message : "Could not create Razorpay order." }, { status: 502 });
    }
  }

  const stripe = getStripe();
  if (!stripe) {
    return NextResponse.json({ error: "Payment processing is not configured. Add Razorpay keys for India-first funding." }, { status: 503 });
  }

  const appUrl = process.env.APP_URL ?? "http://localhost:3000";

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: target.currency,
          unit_amount: target.amountCents,
          product_data: { name: target.title, description: target.description }
        }
      }
    ],
    metadata: { entity_type: entityType, entity_id: entityId, deal_id: entityType === "deal" ? entityId : "" },
    success_url: `${appUrl}/payments?payment=success`,
    cancel_url: `${appUrl}/payments?payment=cancelled`
  });

  await markPending(admin, entityType, entityId, { provider: "stripe", stripeCheckoutSessionId: session.id });
  await trackEvent(admin, {
    ...userEventBase(authData.user, profile),
    eventName: "payment_link_created",
    entityType,
    entityId,
    metadata: { source: "stripe", stripe_checkout_session_id: session.id, amount_cents: target.amountCents, currency: target.currency }
  });

  return NextResponse.json({
    provider: "stripe",
    checkout_url: session.url,
    stripe_checkout_session_id: session.id
  });
}

async function markPending(
  admin: NonNullable<ReturnType<typeof createAdminClient>>,
  entityType: "deal" | "freelancer_project",
  entityId: string,
  options: Parameters<typeof ensurePaymentRecordForEntity>[4]
) {
  const table = entityType === "deal" ? "deals" : "freelancer_projects";
  const { data } = await admin.from(table).update({ payment_status: "pending" }).eq("id", entityId).select("*").single();
  if (data) await ensurePaymentRecordForEntity(admin, entityType, data, "pending", options);
}

async function getProfileRole(admin: NonNullable<ReturnType<typeof createAdminClient>>, profileId: string) {
  const { data } = await admin.from("profiles").select("role").eq("id", profileId).single();
  return String(data?.role ?? "");
}

async function getDealTarget(admin: NonNullable<ReturnType<typeof createAdminClient>>, id: string) {
  const { data } = await admin.from("deals").select("*").eq("id", id).single();
  if (!data) return null;
  // Funding readiness has TWO acceptable paths:
  //
  //   a) The latest contract scan came back without high-risk flags
  //      (review_status != "blocked" AND risk_level != "high_risk")
  //   b) A deal_agreements row for this deal is fully_signed (both parties
  //      typed their name with IP + timestamp inside Agently)
  //
  // Path (b) was added because a stale scan can outlive its usefulness:
  // a contract may have been flagged on an earlier draft, the parties then
  // negotiate offline, both sign the corrected packet, and the deal is
  // ready to fund — even though the original scan row still carries the
  // high_risk badge. A mutual IP-stamped signature is stronger evidence
  // of consent than a rules-fallback flag.
  const [{ data: contract }, { data: agreement }] = await Promise.all([
    admin
      .from("contracts")
      .select("id, review_status, risk_level")
      .eq("deal_id", id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    admin
      .from("deal_agreements")
      .select("status")
      .eq("deal_id", id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle()
  ]);
  const scanReady = contract ? String(contract.review_status ?? "") !== "blocked" && String(contract.risk_level ?? "") !== "high_risk" : false;
  const signaturesComplete = String(agreement?.status ?? "") === "fully_signed";
  return {
    acceptanceStatus: String(data.offer_status ?? ""),
    amountCents: Number(data.amount_cents ?? 0),
    brandId: data.brand_id ? String(data.brand_id) : "",
    contractReady: scanReady || signaturesComplete,
    currency: String(data.currency ?? "inr"),
    description: String(data.deliverables ?? ""),
    title: String(data.title ?? "Creator deal")
  };
}

async function getProjectTarget(admin: NonNullable<ReturnType<typeof createAdminClient>>, id: string) {
  const { data } = await admin.from("freelancer_projects").select("*").eq("id", id).single();
  if (!data) return null;
  return {
    acceptanceStatus: String(data.status ?? ""),
    amountCents: Number(data.amount_cents ?? 0),
    brandId: data.brand_id ? String(data.brand_id) : "",
    contractReady: true,
    currency: String(data.currency ?? "inr"),
    description: String(data.scope ?? ""),
    title: String(data.title ?? "Freelancer project")
  };
}

async function getBrandIdsForUser(admin: NonNullable<ReturnType<typeof createAdminClient>>, profileId: string, email: string) {
  const [{ data: brands }, { data: audits }, { data: campaigns }] = await Promise.all([
    admin.from("brands").select("id").eq("contact_email", email),
    admin.from("brand_audits").select("brand_id").eq("profile_id", profileId),
    admin.from("campaigns").select("brand_id").eq("profile_id", profileId)
  ]);

  return Array.from(new Set([
    ...((brands ?? []).map((brand) => String(brand.id))),
    ...((audits ?? []).map((audit) => String(audit.brand_id)).filter(Boolean)),
    ...((campaigns ?? []).map((campaign) => String(campaign.brand_id)).filter(Boolean))
  ]));
}

function normalizeRazorpayCurrency(currency: string) {
  const normalized = String(currency || "inr").trim().toUpperCase();
  return normalized === "INR" ? "INR" : "INR";
}
