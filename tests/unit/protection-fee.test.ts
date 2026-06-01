import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { PROTECTION_FEE_RATE, calculateProtectionFee } from "@/lib/payments/protection";

const ROOT = process.cwd();

describe("PROTECTION_FEE_RATE", () => {
  // Locks the current value. This is a deliberate tripwire: changing the
  // platform fee is a business decision, so a casual edit should fail this
  // test and force whoever changes it to update the test on purpose.
  it("is 2% — change this test on purpose if the fee changes", () => {
    expect(PROTECTION_FEE_RATE).toBe(0.02);
  });

  it("derives the payout split from the single constant", () => {
    const amountCents = 100_000; // ₹1,000
    const fee = Math.round(amountCents * PROTECTION_FEE_RATE);
    const payout = amountCents - fee;
    expect(fee).toBe(2_000); // ₹20
    expect(payout).toBe(98_000); // ₹980
  });
});

describe("calculateProtectionFee", () => {
  it("is eligible and reports the rate as a percentage for positive amounts", () => {
    const result = calculateProtectionFee(50_000);
    expect(result.eligible).toBe(true);
    expect(result.rate_percent).toBe(2);
    expect(result.reason).toMatch(/eligible/i);
  });

  it("is not eligible for a zero amount", () => {
    const result = calculateProtectionFee(0);
    expect(result.eligible).toBe(false);
    expect(result.reason).toMatch(/add a contract value/i);
  });
});

describe("fee regression guard — no hardcoded fee multipliers in payout paths", () => {
  // The exact bug this guards against: app/api/deliverables/review computed
  // the platform fee as `amount * 0.1` (10%), silently contradicting the
  // documented rate. Every file that settles a payout must read the
  // single-source-of-truth constant, not a literal.
  const payoutFiles = [
    "app/api/deliverables/review/route.ts"
  ];

  for (const relativePath of payoutFiles) {
    it(`${relativePath} imports PROTECTION_FEE_RATE and uses no literal fee multiplier`, () => {
      const source = readFileSync(join(ROOT, relativePath), "utf8");
      expect(source).toContain("PROTECTION_FEE_RATE");
      // Catch `* 0.1`, `* 0.05`, `* 0.03`, `*0.1` etc. — a literal decimal
      // multiplier in a payout file is almost certainly a stray fee rate.
      const literalMultiplier = /\*\s*0\.\d+/.test(source);
      expect(literalMultiplier, `Found a hardcoded decimal multiplier in ${relativePath}`).toBe(false);
    });
  }
});
