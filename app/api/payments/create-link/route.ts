import { NextResponse } from "next/server";
import { z } from "zod";
import { trackEvent, userEventBase } from "@/lib/analytics/track";
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

  if (profile === "brand") {
    const brandIds = await getBrandIdsForUser(admin, authData.user.id, authData.user.email ?? "");
    if (!target.brandId || !brandIds.includes(target.brandId)) {
      return NextResponse.json({ error: "Not allowed to fund this item." }, { status: 403 });
    }
  }

  const stripe = getStripe();
  if (!stripe) {
    return NextResponse.json({ error: "Payment processing is not configured. Contact the platform admin." }, { status: 503 });
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

  await markPending(admin, entityType, entityId, session.id);
  await trackEvent(admin, {
    ...userEventBase(authData.user, profile),
    eventName: "payment_link_created",
    entityType,
    entityId,
    metadata: { source: "stripe", stripe_checkout_session_id: session.id, amount_cents: target.amountCents, currency: target.currency }
  });

  return NextResponse.json({
    checkout_url: session.url,
    stripe_checkout_session_id: session.id
  });
}

async function markPending(admin: NonNullable<ReturnType<typeof createAdminClient>>, entityType: "deal" | "freelancer_project", entityId: string, sessionId: string) {
  const target = entityType === "deal" ? await getDealTarget(admin, entityId) : await getProjectTarget(admin, entityId);
  if (!target) return;
  const amount = target.amountCents;
  const platformFee = Math.round(amount * 0.1);

  if (entityType === "deal") await admin.from("deals").update({ payment_status: "pending" }).eq("id", entityId);
  else await admin.from("freelancer_projects").update({ payment_status: "pending" }).eq("id", entityId);

  await admin.from("payments").upsert({
    deal_id: entityType === "deal" ? entityId : null,
    freelancer_project_id: entityType === "freelancer_project" ? entityId : null,
    stripe_checkout_session_id: sessionId,
    amount_cents: amount,
    platform_fee_cents: platformFee,
    creator_payout_cents: Math.max(0, amount - platformFee),
    status: "pending"
  }, { onConflict: entityType === "deal" ? "deal_id" : "freelancer_project_id" });
}

async function getProfileRole(admin: NonNullable<ReturnType<typeof createAdminClient>>, profileId: string) {
  const { data } = await admin.from("profiles").select("role").eq("id", profileId).single();
  return String(data?.role ?? "");
}

async function getDealTarget(admin: NonNullable<ReturnType<typeof createAdminClient>>, id: string) {
  const { data } = await admin.from("deals").select("*").eq("id", id).single();
  if (!data) return null;
  return {
    acceptanceStatus: String(data.offer_status ?? ""),
    amountCents: Number(data.amount_cents ?? 0),
    brandId: data.brand_id ? String(data.brand_id) : "",
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
