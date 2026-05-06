import { NextResponse } from "next/server";
import { z } from "zod";
import { trackEvent, userEventBase } from "@/lib/analytics/track";
import { verifyRazorpayPaymentSignature } from "@/lib/razorpay/client";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { runWorkflowAutomations } from "@/lib/workflow/automation";

const schema = z.object({
  entity_type: z.enum(["deal", "freelancer_project"]).default("deal"),
  entity_id: z.string().trim().min(1, "Entity ID is required."),
  razorpay_order_id: z.string().trim().min(1, "Razorpay order ID is required."),
  razorpay_payment_id: z.string().trim().min(1, "Razorpay payment ID is required."),
  razorpay_signature: z.string().trim().min(1, "Razorpay signature is required.")
});

export async function POST(request: Request) {
  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid payment verification request." }, { status: 400 });
  }
  const {
    entity_type: entityType,
    entity_id: entityId,
    razorpay_order_id: orderId,
    razorpay_payment_id: paymentId,
    razorpay_signature: signature
  } = parsed.data;

  const auth = await createClient();
  const { data: authData } = await auth.auth.getUser();
  if (!authData.user) return NextResponse.json({ error: "Login required." }, { status: 401 });

  const admin = createAdminClient();
  if (!admin) return NextResponse.json({ error: "Supabase service role key is not configured." }, { status: 500 });

  const { data: profile } = await admin.from("profiles").select("role").eq("id", authData.user.id).single();
  if (profile?.role !== "admin" && profile?.role !== "brand") {
    return NextResponse.json({ error: "Only brands or admins can verify funding." }, { status: 403 });
  }

  if (profile?.role === "brand") {
    const brandIds = await getBrandIdsForUser(admin, authData.user.id, authData.user.email ?? "");
    const table = entityType === "deal" ? "deals" : "freelancer_projects";
    const { data: entity } = await admin.from(table).select("brand_id").eq("id", entityId).single();
    if (!entity || !brandIds.includes(String(entity.brand_id))) {
      return NextResponse.json({ error: "Not allowed to verify this payment." }, { status: 403 });
    }
  }

  if (!verifyRazorpayPaymentSignature({ orderId, paymentId, signature })) {
    return NextResponse.json({ error: "Invalid Razorpay payment signature." }, { status: 400 });
  }

  const paymentColumn = entityType === "deal" ? "deal_id" : "freelancer_project_id";
  const table = entityType === "deal" ? "deals" : "freelancer_projects";
  const fundedAt = new Date().toISOString();

  await admin.from(table).update({ payment_status: "funded" }).eq("id", entityId);
  const { error } = await admin
    .from("payments")
    .update({
      provider: "razorpay",
      razorpay_order_id: orderId,
      razorpay_payment_id: paymentId,
      razorpay_signature: signature,
      status: "funded",
      funded_at: fundedAt
    })
    .eq(paymentColumn, entityId)
    .eq("razorpay_order_id", orderId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await trackEvent(admin, {
    ...userEventBase(authData.user, profile?.role),
    eventName: "payment_status_updated",
    entityType,
    entityId,
    metadata: { status: "funded", source: "razorpay_checkout", razorpay_order_id: orderId, razorpay_payment_id: paymentId }
  });
  await runWorkflowAutomations(admin);

  return NextResponse.json({ funded: true, status: "funded", source: "razorpay_verified" });
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
