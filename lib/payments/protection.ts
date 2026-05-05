export const PROTECTION_FEE_RATE = 0.01;
export const PROTECTION_MAX_CONTRACT_CENTS = 50000000;

export function calculateProtectionFee(amountCents: number) {
  const eligible = amountCents > 0 && amountCents <= PROTECTION_MAX_CONTRACT_CENTS;

  return {
    eligible,
    rate_percent: PROTECTION_FEE_RATE * 100,
    max_contract_cents: PROTECTION_MAX_CONTRACT_CENTS,
    reason: eligible
      ? "Eligible for protected payout add-on in this prototype."
      : "Not eligible because the contract value is above the eligible range."
  };
}
