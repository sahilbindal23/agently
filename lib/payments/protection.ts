export const PROTECTION_FEE_RATE = 0.015;
export const PROTECTION_FEE_CAP_CENTS = 1500000;
export const PROTECTION_MAX_CONTRACT_CENTS = 50000000;

export function calculateProtectionFee(amountCents: number) {
  const eligible = amountCents > 0 && amountCents <= PROTECTION_MAX_CONTRACT_CENTS;
  const rawFee = Math.round(amountCents * PROTECTION_FEE_RATE);
  const feeCents = eligible ? Math.min(rawFee, PROTECTION_FEE_CAP_CENTS) : 0;

  return {
    eligible,
    fee_cents: feeCents,
    rate_percent: PROTECTION_FEE_RATE * 100,
    cap_cents: PROTECTION_FEE_CAP_CENTS,
    max_contract_cents: PROTECTION_MAX_CONTRACT_CENTS,
    reason: eligible
      ? "Eligible for protected payout add-on in this prototype."
      : "Not eligible because the contract value is above the prototype protection cap."
  };
}
