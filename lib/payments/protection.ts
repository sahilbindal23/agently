// Agently's platform fee on protected payouts. Single source of truth —
// every surface that prices, displays, or settles a deal reads from
// this constant. Update here and the contract template, offer composer
// breakdown, terms page, protection calculator, and ledger payouts all
// move together.
//
// This is the TOTAL fee the brand sees. Razorpay's ~2% payment-
// processing cost comes out of this 5% before Agently keeps a margin —
// it is absorbed inside the rate, not charged on top. So a ₹100 deal
// looks like: brand pays ₹100, creator receives ₹95, Razorpay takes
// ~₹2 from settlement, Agently keeps ~₹3.
export const PROTECTION_FEE_RATE = 0.05;

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
