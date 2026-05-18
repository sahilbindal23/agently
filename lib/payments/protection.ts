// Agently's platform fee on protected payouts. Single source of truth —
// every surface that prices, displays, or settles a deal reads from
// this constant. Update here and the contract template, offer composer
// breakdown, terms page, protection calculator, and ledger payouts all
// move together.
//
// Razorpay's ~2% payment-processing fee is separate — it is taken by
// Razorpay before funds settle into Agently's account and is not part
// of this constant.
export const PROTECTION_FEE_RATE = 0.03;

export function calculateProtectionFee(amountCents: number) {
  const eligible = amountCents > 0;

  return {
    eligible,
    rate_percent: PROTECTION_FEE_RATE * 100,
    reason: eligible
      ? "Eligible for the protected payout add-on."
      : "Add a contract value to preview the protected payout workflow."
  };
}
