import type { createAdminClient } from "@/lib/supabase/admin";
import { PROTECTION_FEE_RATE } from "@/lib/payments/protection";

type AdminClient = NonNullable<ReturnType<typeof createAdminClient>>;
type PaymentEntityType = "deal" | "freelancer_project";

export function calculatePaymentSplit(amountCents: number) {
  const platformFeeCents = Math.round(amountCents * PROTECTION_FEE_RATE);
  return {
    platformFeeCents,
    talentPayoutCents: Math.max(0, amountCents - platformFeeCents)
  };
}

export async function ensurePaymentRecordForEntity(
  admin: AdminClient,
  entityType: PaymentEntityType,
  entity: Record<string, unknown>,
  status = "unpaid",
  options?: string | {
    provider?: "stripe" | "razorpay" | "manual";
    providerPayload?: Record<string, unknown>;
    razorpayOrderId?: string;
    razorpayPaymentId?: string;
    razorpaySignature?: string;
    stripeCheckoutSessionId?: string;
  }
) {
  const amountCents = Number(entity.amount_cents ?? 0);
  const { platformFeeCents, talentPayoutCents } = calculatePaymentSplit(amountCents);
  const now = new Date().toISOString();
  const paymentRow: Record<string, unknown> = {
    deal_id: entityType === "deal" ? String(entity.id) : null,
    freelancer_project_id: entityType === "freelancer_project" ? String(entity.id) : null,
    amount_cents: amountCents,
    platform_fee_cents: platformFeeCents,
    creator_payout_cents: talentPayoutCents,
    status
  };

  const paymentOptions = typeof options === "string" ? { provider: "stripe" as const, stripeCheckoutSessionId: options } : options;
  if (paymentOptions?.provider) paymentRow.provider = paymentOptions.provider;
  if (paymentOptions?.providerPayload) paymentRow.provider_payload = paymentOptions.providerPayload;
  if (paymentOptions?.razorpayOrderId) paymentRow.razorpay_order_id = paymentOptions.razorpayOrderId;
  if (paymentOptions?.razorpayPaymentId) paymentRow.razorpay_payment_id = paymentOptions.razorpayPaymentId;
  if (paymentOptions?.razorpaySignature) paymentRow.razorpay_signature = paymentOptions.razorpaySignature;
  if (paymentOptions?.stripeCheckoutSessionId) paymentRow.stripe_checkout_session_id = paymentOptions.stripeCheckoutSessionId;
  if (status === "funded") paymentRow.funded_at = now;
  if (status === "released") paymentRow.released_at = now;

  const entityColumn = entityType === "deal" ? "deal_id" : "freelancer_project_id";
  const { data: existing } = await admin
    .from("payments")
    .select("id")
    .eq(entityColumn, String(entity.id))
    .maybeSingle();

  if (existing?.id) {
    const { error } = await admin.from("payments").update(paymentRow).eq("id", existing.id);
    if (error) throw new Error(error.message);
    return;
  }

  const { error } = await admin.from("payments").insert(paymentRow);
  if (error) throw new Error(error.message);
}
