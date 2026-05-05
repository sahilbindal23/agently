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
  stripeCheckoutSessionId?: string
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

  if (stripeCheckoutSessionId) paymentRow.stripe_checkout_session_id = stripeCheckoutSessionId;
  if (status === "funded") paymentRow.funded_at = now;
  if (status === "released") paymentRow.released_at = now;

  await admin.from("payments").upsert(paymentRow, { onConflict: entityType === "deal" ? "deal_id" : "freelancer_project_id" });
}
