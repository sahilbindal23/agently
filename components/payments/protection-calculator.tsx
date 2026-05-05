import { ShieldCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { calculateProtectionFee } from "@/lib/payments/protection";

export function ProtectionCalculator({ amountCents }: { amountCents: number }) {
  const protection = calculateProtectionFee(amountCents);

  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>Protected Payout Add-On</CardTitle>
          <p className="mt-1 text-sm text-muted-foreground">Payment confidence workflow for funded deals and approved deliverables.</p>
        </div>
        <Badge tone={protection.eligible ? "green" : "amber"}>{protection.eligible ? "eligible" : "needs amount"}</Badge>
      </CardHeader>
      <div className="grid gap-3 md:grid-cols-2">
        <Metric label="Platform fee" value={`${protection.rate_percent}%`} />
        <Metric label="Applied on" value="Funded contract value" />
      </div>
      <div className="mt-4 rounded-md border bg-white p-4 dark:border-white/10 dark:bg-card">
        <div className="mb-2 flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-primary" />
          <p className="text-sm font-semibold">Eligibility rule</p>
        </div>
        <p className="text-sm leading-6 text-muted-foreground">
          {protection.reason} Agently charges a 1% platform fee on protected payout workflows.
        </p>
      </div>
    </Card>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border bg-white p-4 dark:border-white/10 dark:bg-card">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-2 text-xl font-bold">{value}</p>
    </div>
  );
}
