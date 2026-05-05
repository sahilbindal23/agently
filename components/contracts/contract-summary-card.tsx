import { RiskBadge } from "@/components/contracts/risk-badge";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { Contract } from "@/types";

export function ContractSummaryCard({ contract }: { contract?: Contract | null }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Contract Risk</CardTitle>
        {contract ? <RiskBadge risk={contract.risk_level} /> : <Badge>not scanned</Badge>}
      </CardHeader>
      <p className="text-sm leading-6 text-muted-foreground">
        {contract?.summary ?? "No contract scan has been saved for this deal yet."}
      </p>
      {contract?.flags?.length ? (
        <div className="mt-4 space-y-3">
          {contract.flags.map((flag) => (
            <div key={flag.id} className="rounded-md border bg-white p-3 dark:border-white/8 dark:bg-card">
              <div className="mb-1 flex items-center justify-between gap-3">
                <p className="text-sm font-semibold">{flag.flag_type.replaceAll("_", " ")}</p>
                <Badge tone={flag.severity === "high" ? "red" : flag.severity === "medium" ? "amber" : "green"}>
                  {flag.severity}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground">{flag.excerpt}</p>
              <p className="mt-2 text-sm leading-5">{flag.recommendation}</p>
            </div>
          ))}
        </div>
      ) : null}
    </Card>
  );
}
