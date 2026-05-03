import Link from "next/link";
import { AlertTriangle, CheckCircle2, ShieldAlert } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import type { AutomationDecision } from "@/lib/profile/automation";

const toneByStatus = {
  discoverable: "green",
  needs_correction: "amber",
  review: "red"
} as const;

export function MarketplaceEligibilityCard({ decision }: { decision: AutomationDecision }) {
  const Icon = decision.status === "discoverable" ? CheckCircle2 : decision.status === "review" ? ShieldAlert : AlertTriangle;
  return (
    <Card className="p-4 shadow-none">
      <CardHeader className="mb-3 gap-3">
        <div>
          <CardTitle className="text-sm">Profile visibility</CardTitle>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">Complete profiles get stronger placement in discovery.</p>
        </div>
        <Badge tone={toneByStatus[decision.status]}>{decision.score}%</Badge>
      </CardHeader>
      <div className="flex items-start gap-3 rounded-md bg-muted p-3">
        <Icon className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
        <div>
          <p className="text-sm font-semibold">{decision.label}</p>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">
            {decision.status === "discoverable"
              ? "Your profile can appear in marketplace discovery."
              : "Your profile visibility is limited until the missing details are fixed."}
          </p>
        </div>
      </div>
      <div className="mt-3 space-y-2">
        {decision.reasons.slice(0, 3).map((reason) => (
          <p className="rounded-md border bg-white px-3 py-2 text-xs leading-5" key={reason}>{reason}</p>
        ))}
      </div>
      {decision.status !== "discoverable" ? (
        <Link className="mt-3 block" href="/profile">
          <Button className="w-full justify-center" size="sm" type="button" variant="secondary">Fix profile</Button>
        </Link>
      ) : null}
    </Card>
  );
}
