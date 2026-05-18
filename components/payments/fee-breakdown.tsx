import { PROTECTION_FEE_RATE } from "@/lib/payments/protection";
import { formatCurrency } from "@/lib/utils/format";

// Razorpay charges ~2% on standard checkout. Used here purely for the
// brand-facing breakdown so they understand the total cost picture.
// Razorpay deducts this themselves before settling into Agently's
// account — it's not stored on any deal/payment row.
const RAZORPAY_FEE_RATE = 0.02;

export function FeeBreakdown({
  amountCents,
  audience,
  className = ""
}: {
  amountCents: number;
  audience: "brand" | "creator";
  className?: string;
}) {
  const safeAmount = Math.max(0, Math.round(amountCents || 0));
  const platformFee = Math.round(safeAmount * PROTECTION_FEE_RATE);
  const razorpayFee = Math.round(safeAmount * RAZORPAY_FEE_RATE);
  const creatorPayout = Math.max(0, safeAmount - platformFee);

  const empty = safeAmount <= 0;

  return (
    <div className={`rounded-md border bg-muted/40 p-3 text-sm dark:border-white/10 dark:bg-white/5 ${className}`}>
      <div className="mb-2 flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Fee breakdown
        </p>
        <span className="text-[11px] text-muted-foreground">
          {Math.round(PROTECTION_FEE_RATE * 100)}% Agently fee
        </span>
      </div>

      {empty ? (
        <p className="text-muted-foreground">Enter an offer amount to see the fee breakdown.</p>
      ) : (
        <dl className="space-y-1.5">
          <Row label="Contract value" value={formatCurrency(safeAmount, "inr")} bold />
          <Row label={`Agently platform fee (${Math.round(PROTECTION_FEE_RATE * 100)}%)`} value={`− ${formatCurrency(platformFee, "inr")}`} tone="muted" />
          <div className="my-1 border-t border-border/60 dark:border-white/10" />
          <Row
            label={audience === "brand" ? "Creator receives" : "You receive"}
            value={formatCurrency(creatorPayout, "inr")}
            bold
            tone="emerald"
          />
          {audience === "brand" ? (
            <p className="mt-2 text-xs leading-5 text-muted-foreground">
              Razorpay also deducts ~{Math.round(RAZORPAY_FEE_RATE * 100)}% (~{formatCurrency(razorpayFee, "inr")}) before funds settle into Agently — that's the payment-processing cost and is separate from the Agently fee.
              If you want the creator to receive a specific net amount, gross up the contract value to cover the {Math.round(PROTECTION_FEE_RATE * 100)}% platform fee.
            </p>
          ) : (
            <p className="mt-2 text-xs leading-5 text-muted-foreground">
              Agently keeps a {Math.round(PROTECTION_FEE_RATE * 100)}% protected-payout fee on every approved delivery. Your net is paid out after the brand approves your deliverable.
            </p>
          )}
        </dl>
      )}
    </div>
  );
}

function Row({
  label,
  value,
  bold,
  tone
}: {
  label: string;
  value: string;
  bold?: boolean;
  tone?: "muted" | "emerald";
}) {
  const valueClass = tone === "emerald"
    ? "text-emerald-700 dark:text-emerald-400"
    : tone === "muted"
    ? "text-muted-foreground"
    : "";
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className={bold ? "font-semibold" : "text-muted-foreground"}>{label}</dt>
      <dd className={`tabular-nums ${bold ? "font-semibold" : ""} ${valueClass}`}>{value}</dd>
    </div>
  );
}
