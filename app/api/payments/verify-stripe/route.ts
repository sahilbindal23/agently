import { NextResponse } from "next/server";
import { z } from "zod";
import { notifyPaymentStatusChanged } from "@/lib/email/workflow";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { getStripe } from "@/lib/stripe/client";

const schema = z.object({
  entity_type: z.enum(["deal", "freelancer_project"]).default("deal"),
  entity_id: z.string().trim().min(1, "Entity ID is required.")
});

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

  const { data: profile } = await admin.from("profiles").select("role").eq("id", authData.user.id).single();
  if (profile?.role !== "admin" && profile?.role !== "brand") {
    return NextResponse.json({ error: "Only brands or admins can verify payment status." }, { status: 403 });
  }

  if (profile?.role === "brand") {
    const brandIds = await getBrandIdsForUser(admin, authData.user.id, authData.user.email ?? "");
    const col = entityType === "deal" ? "deals" : "freelancer_projects";
    const { data: entity } = await admin.from(col).select("brand_id").eq("id", entityId).single();
    if (!entity || !brandIds.includes(String(entity.brand_id))) {
      return NextResponse.json({ error: "Not allowed to verify this payment." }, { status: 403 });
    }
  }

  const paymentCol = entityType === "deal" ? "deal_id" : "freelancer_project_id";
  const { data: payment } = await admin
    .from("payments")
    .select("stripe_checkout_session_id, status, funded_at")
    .eq(paymentCol, entityId)
    .maybeSingle();

  // Already funded — return early, no Stripe call needed
  if (["funded", "release_ready", "released"].includes(String(payment?.status ?? ""))) {
    return NextResponse.json({ funded: true, status: payment?.status, source: "already_funded" });
  }

  const sessionId = payment?.stripe_checkout_session_id;
  if (!sessionId) {
    return NextResponse.json({ funded: false, error: "No Stripe checkout session found. Create a payment link first." }, { status: 404 });
  }

  const stripe = getStripe();
  if (!stripe) {
    return NextResponse.json({ error: "Payment processing is not configured." }, { status: 503 });
  }

  try {
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    if (session.payment_status !== "paid") {
      return NextResponse.json({ funded: false, stripe_payment_status: session.payment_status });
    }

    const table = entityType === "deal" ? "deals" : "freelancer_projects";
    await admin.from(table).update({ payment_status: "funded" }).eq("id", entityId);
    await admin
      .from("payments")
      .update({ status: "funded", funded_at: new Date().toISOString() })
      .eq(paymentCol, entityId)
      .eq("stripe_checkout_session_id", sessionId);
    await notifyPaymentStatusChanged(admin, entityType, entityId, "funded");

    return NextResponse.json({ funded: true, status: "funded", source: "stripe_verified" });
  } catch {
    return NextResponse.json({ error: "Could not verify payment with Stripe." }, { status: 502 });
  }
}

async function getBrandIdsForUser(admin: NonNullable<ReturnType<typeof createAdminClient>>, profileId: string, email: string) {
  const [{ data: brands }, { data: audits }, { data: campaigns }] = await Promise.all([
    admin.from("brands").select("id").eq("contact_email", email),
    admin.from("brand_audits").select("brand_id").eq("profile_id", profileId),
    admin.from("campaigns").select("brand_id").eq("profile_id", profileId)
  ]);
  return Array.from(new Set([
    ...((brands ?? []).map((b) => String(b.id))),
    ...((audits ?? []).map((a) => String(a.brand_id)).filter(Boolean)),
    ...((campaigns ?? []).map((c) => String(c.brand_id)).filter(Boolean))
  ]));
}
