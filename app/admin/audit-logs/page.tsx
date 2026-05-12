import { redirect } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, Td, Th } from "@/components/ui/table";
import { getCurrentUser } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

type AuditRow = {
  id: string;
  actor_profile_id: string | null;
  actor_role: string | null;
  action: string;
  entity_type: string | null;
  entity_id: string | null;
  ip_address: string | null;
  user_agent: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
};

type AuditLogsPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function AuditLogsPage({ searchParams }: AuditLogsPageProps) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role !== "admin") redirect("/dashboard");

  const admin = createAdminClient();
  if (!admin) redirect("/dashboard");

  const params = await searchParams;
  const actionFilter = first(params.action);
  const actorFilter = first(params.actor);

  let query = admin
    .from("audit_logs")
    .select("id, actor_profile_id, actor_role, action, entity_type, entity_id, ip_address, user_agent, metadata, created_at")
    .order("created_at", { ascending: false })
    .limit(200);
  if (actionFilter) query = query.eq("action", actionFilter);
  if (actorFilter) query = query.eq("actor_profile_id", actorFilter);

  const { data: rows } = await query;
  const logs = (rows ?? []) as AuditRow[];

  // Aggregate per action so admins can see what's loud
  const counts = new Map<string, number>();
  for (const log of logs) {
    counts.set(log.action, (counts.get(log.action) ?? 0) + 1);
  }
  const topActions = Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8);

  // Highlight rate-limit blocks separately - they're a security signal
  const rateLimitBlocks = logs.filter((l) => l.action === "rate_limit_exceeded");

  return (
    <AppShell>
      <PageHeader
        eyebrow="Trust and safety"
        title="Audit logs"
        description="Last 200 sensitive actions across the platform. Track admin verifications, rate-limit blocks, contract signatures, payment status changes, and dispute resolutions."
      />

      {topActions.length ? (
        <Card className="mb-5">
          <CardHeader>
            <CardTitle>Top actions in this window</CardTitle>
            <Badge tone="blue">{logs.length} entries</Badge>
          </CardHeader>
          <div className="flex flex-wrap gap-2">
            {topActions.map(([action, count]) => (
              <Badge key={action} tone="neutral">{action} × {count}</Badge>
            ))}
          </div>
        </Card>
      ) : null}

      {rateLimitBlocks.length ? (
        <Card className="mb-5 border-amber-200 dark:border-amber-900/50">
          <CardHeader>
            <CardTitle>Rate-limit blocks ({rateLimitBlocks.length})</CardTitle>
            <Badge tone="amber">review</Badge>
          </CardHeader>
          <div className="grid gap-2">
            {rateLimitBlocks.slice(0, 10).map((log) => (
              <div key={log.id} className="rounded-md border bg-white p-3 text-sm dark:border-white/8 dark:bg-card">
                <p>
                  <span className="font-semibold">{log.entity_id}</span>{" "}
                  <span className="text-muted-foreground">— actor {log.actor_profile_id ?? "unknown"} · {new Date(log.created_at).toLocaleString()}</span>
                </p>
                {log.metadata ? (
                  <p className="mt-1 text-xs text-muted-foreground">
                    Count: {String((log.metadata as Record<string, unknown>).count ?? "?")} / limit {String((log.metadata as Record<string, unknown>).limit ?? "?")} · IP {log.ip_address ?? "?"}
                  </p>
                ) : null}
              </div>
            ))}
          </div>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>All entries</CardTitle>
          <Badge tone="neutral">most recent first</Badge>
        </CardHeader>
        <div className="overflow-x-auto">
          <Table>
            <thead>
              <tr>
                <Th>When</Th>
                <Th>Action</Th>
                <Th>Actor</Th>
                <Th>Entity</Th>
                <Th>IP</Th>
                <Th>Metadata</Th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => (
                <tr key={log.id}>
                  <Td className="whitespace-nowrap text-xs text-muted-foreground">
                    {new Date(log.created_at).toLocaleString()}
                  </Td>
                  <Td>
                    <Badge tone={toneForAction(log.action)}>{log.action}</Badge>
                  </Td>
                  <Td className="font-mono text-xs">
                    {log.actor_profile_id ? `${log.actor_profile_id.slice(0, 8)}…` : "—"}
                    {log.actor_role ? <span className="ml-1 text-muted-foreground">({log.actor_role})</span> : null}
                  </Td>
                  <Td className="font-mono text-xs">
                    {log.entity_type ? `${log.entity_type}` : "-"}
                    {log.entity_id ? <span className="ml-1 text-muted-foreground">{String(log.entity_id).slice(0, 16)}</span> : null}
                  </Td>
                  <Td className="text-xs">{log.ip_address ?? "-"}</Td>
                  <Td className="max-w-md truncate text-xs text-muted-foreground" title={JSON.stringify(log.metadata)}>
                    {log.metadata ? JSON.stringify(log.metadata).slice(0, 80) : "-"}
                  </Td>
                </tr>
              ))}
              {logs.length === 0 ? (
                <tr>
                  <Td className="text-muted-foreground" colSpan={6}>No audit entries yet. As admins, rate-limit blocks, contract signs, and dispute resolutions happen, they&apos;ll appear here.</Td>
                </tr>
              ) : null}
            </tbody>
          </Table>
        </div>
      </Card>
    </AppShell>
  );
}

function toneForAction(action: string): "green" | "amber" | "red" | "blue" | "neutral" {
  if (action.includes("verified") || action.includes("approved")) return "green";
  if (action.includes("rate_limit") || action.includes("flagged")) return "amber";
  if (action.includes("denied") || action.includes("rejected") || action.includes("dispute")) return "red";
  if (action.includes("signed") || action.includes("created")) return "blue";
  return "neutral";
}

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}
