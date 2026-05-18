// Agently's platform fee on protected payouts. Single source of truth —
// every surface that prices, displays, or settles a deal reads from
// this constant. Update here and the contract template, offer composer
// breakdown, terms page, protection calculator, and ledger payouts all
// move together.
//
// This is the TOTAL fee the brand sees. Razorpay's ~2% payment-
// processing cost comes out of this fee before Agently keeps a margin
// — it is absorbed inside the rate, not charged on top.
//
// Current pricing is positioned to undercut competitors during beta;
// at 2% gross the net to Agently is near-zero on Razorpay Standard
// Checkout. Margin recovers once RazorpayX (flat-fee payouts) replaces
// the variable processing cost on the payout side.
export const PROTECTION_FEE_RATE = 0.02;

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
