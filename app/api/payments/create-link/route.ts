import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { getStripe } from "@/lib/stripe/client";

export async function POST(request: Request) {
  const body = await request.json();
  const entityType = String(body.entity_type ?? "deal") as "deal" | "freelancer_project";
  const entityId = String(body.entity_id ?? body.deal_id ?? "").trim();

  if (!entityId || (entityType !== "deal" && entityType !== "freelancer_project")) {
    return NextResponse.json({ error: "Valid payment target is required." }, { status: 400 });
  }

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
  const appUrl = process.env.APP_URL ?? "http://localhost:3000";

  if (!stripe) {
    await markPending(admin, entityType, entityId, `cs_demo_${entityType}_${entityId}`);
    return NextResponse.json({
      checkout_url: `${appUrl}/payments?demo_checkout=${entityId}`,
      stripe_checkout_session_id: `cs_demo_${entityType}_${entityId}`,
      source: "demo_fallback"
    });
  }

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
  const [{ data: brands }, { data: audits }] = await Promise.all([
    admin.from("brands").select("id").eq("contact_email", email),
    admin.from("brand_audits").select("brand_id").eq("profile_id", profileId)
  ]);

  return Array.from(new Set([
    ...((brands ?? []).map((brand) => String(brand.id))),
    ...((audits ?? []).map((audit) => String(audit.brand_id)).filter(Boolean))
  ]));
}
