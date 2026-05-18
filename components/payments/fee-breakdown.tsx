import { PROTECTION_FEE_RATE } from "@/lib/payments/protection";
import { formatCurrency } from "@/lib/utils/format";

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
  const creatorPayout = Math.max(0, safeAmount - platformFee);
  const ratePercent = Math.round(PROTECTION_FEE_RATE * 100);

  const empty = safeAmount <= 0;

  return (
    <div className={`rounded-md border bg-muted/40 p-3 text-sm dark:border-white/10 dark:bg-white/5 ${className}`}>
      <div className="mb-2 flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Fee breakdown
        </p>
        <span className="text-[11px] text-muted-foreground">{ratePercent}% Agently fee</span>
      </div>

      {empty ? (
        <p className="text-muted-foreground">Enter an offer amount to see the fee breakdown.</p>
      ) : (
        <dl className="space-y-1.5">
          <Row label="Contract value" value={formatCurrency(safeAmount, "inr")} bold />
          <Row label={`Agently platform fee (${ratePercent}%)`} value={`− ${formatCurrency(platformFee, "inr")}`} tone="muted" />
          <div className="my-1 border-t border-border/60 dark:border-white/10" />
          <Row
            label={audience === "brand" ? "Creator receives" : "You receive"}
            value={formatCurrency(creatorPayout, "inr")}
            bold
            tone="emerald"
          />
          {audience === "brand" ? (
            <p className="mt-2 text-xs leading-5 text-muted-foreground">
              The {ratePercent}% fee covers payment processing, protected escrow, dispute handling, and payout to the creator. Nothing else is added on top — what you fund is exactly the contract value above.
              If you want the creator to receive a specific net amount, gross up the contract value to cover the {ratePercent}% platform fee.
            </p>
          ) : (
            <p className="mt-2 text-xs leading-5 text-muted-foreground">
              Agently keeps a {ratePercent}% protected-payout fee on every approved delivery. Your net is paid out after the brand approves your deliverable.
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
