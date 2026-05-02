import { ShieldCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { calculateProtectionFee } from "@/lib/payments/protection";
import { formatCurrency } from "@/lib/utils/format";

export function ProtectionCalculator({ amountCents }: { amountCents: number }) {
  const protection = calculateProtectionFee(amountCents);

  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>Protected Payout Add-On</CardTitle>
          <p className="mt-1 text-sm text-muted-foreground">Prototype monetization model for payment confidence after approved deliverables.</p>
        </div>
        <Badge tone={protection.eligible ? "green" : "amber"}>{protection.eligible ? "eligible" : "capped"}</Badge>
      </CardHeader>
      <div className="grid gap-3 md:grid-cols-3">
        <Metric label="Fee rate" value={`${protection.rate_percent}%`} />
        <Metric label="Estimated fee" value={formatCurrency(protection.fee_cents, "inr")} />
        <Metric label="Fee cap" value={formatCurrency(protection.cap_cents, "inr")} />
      </div>
      <div className="mt-4 rounded-md border bg-white p-4">
        <div className="mb-2 flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-primary" />
          <p className="text-sm font-semibold">Eligibility rule</p>
        </div>
        <p className="text-sm leading-6 text-muted-foreground">
          {protection.reason} Max eligible contract value: {formatCurrency(protection.max_contract_cents, "inr")}. This should be positioned as payment protection workflow until reviewed by legal counsel, not as an insurance product.
        </p>
      </div>
    </Card>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border bg-white p-4">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-2 text-xl font-bold">{value}</p>
    </div>
  );
}
