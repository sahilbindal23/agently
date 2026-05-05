export const PROTECTION_FEE_RATE = 0.01;

export function calculateProtectionFee(amountCents: number) {
  const eligible = amountCents > 0;

  return {
    eligible,
    rate_percent: PROTECTION_FEE_RATE * 100,
    reason: eligible
      ? "Eligible for protected payout add-on in this prototype."
      : "Add a contract value to preview the protected payout workflow."
  };
}
