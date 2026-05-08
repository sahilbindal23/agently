import { redirect } from "next/navigation";
import { AnomalyReviewItem } from "@/components/benchmarks/anomaly-review-item";
import { AppShell } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { getCurrentUser } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

type AnomalyRow = {
  id: string;
  observation_id: string | null;
  observation_kind: string;
  reason: string;
  severity: "low" | "medium" | "high";
  amount_cents: number | null;
  baseline_median_cents: number | null;
  deviation_factor: number | null;
  source_slug: string | null;
  resolved_at: string | null;
  resolution: string | null;
  resolution_note: string | null;
  created_at: string;
  platform: string | null;
  niche: string | null;
  deliverable_type: string | null;
  tier: string | null;
  observed_at: string | null;
};

export default async function AnomaliesPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role !== "admin") redirect("/dashboard");
  const admin = createAdminClient();
  if (!admin) redirect("/dashboard");

  const { data: rows } = await admin
    .from("benchmark_anomalies_review")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(200);
  const anomalies = (rows ?? []) as AnomalyRow[];
  const open = anomalies.filter((a) => !a.resolved_at);
  const resolved = anomalies.filter((a) => a.resolved_at);

  return (
    <AppShell>
      <PageHeader
        eyebrow="Benchmark guardrails"
        title="Observation anomalies"
        description="Observations the engine flagged at write time. Approve normal, reject outliers, or manually override. Resolutions update the materialized view immediately."
      />

      <Card className="mb-5">
        <CardHeader>
          <CardTitle>Open ({open.length})</CardTitle>
          <Badge tone={open.length === 0 ? "green" : open.filter((a) => a.severity === "high").length > 0 ? "red" : "amber"}>
            {open.length === 0 ? "all clear" : `${open.filter((a) => a.severity === "high").length} high severity`}
          </Badge>
        </CardHeader>
        {open.length === 0 ? (
          <p className="text-sm text-muted-foreground">No flagged observations awaiting review.</p>
        ) : (
          <div className="space-y-3">
            {open.map((a) => <AnomalyReviewItem key={a.id} anomaly={a} resolvable />)}
          </div>
        )}
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Resolved ({resolved.length})</CardTitle>
        </CardHeader>
        {resolved.length === 0 ? (
          <p className="text-sm text-muted-foreground">No history yet.</p>
        ) : (
          <div className="space-y-3">
            {resolved.slice(0, 50).map((a) => <AnomalyReviewItem key={a.id} anomaly={a} />)}
          </div>
        )}
      </Card>
    </AppShell>
  );
}
