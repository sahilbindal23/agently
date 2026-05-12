import { redirect } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/layout/page-header";
import { DeletionRequestActions } from "@/components/admin/deletion-request-actions";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { getCurrentUser } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

type Blocker = { type?: string; title?: string; reason?: string };

type DeletionRequestRow = {
  id: string;
  profile_id: string | null;
  email: string;
  role: string | null;
  status: string;
  reason: string | null;
  blockers: Blocker[] | null;
  metadata: Record<string, unknown> | null;
  requested_at: string;
  processed_at: string | null;
  processed_by: string | null;
};

export default async function AdminDeletionRequestsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role !== "admin") redirect("/dashboard");

  const admin = createAdminClient();
  if (!admin) redirect("/dashboard");

  const { data: pending } = await admin
    .from("account_deletion_requests")
    .select("*")
    .eq("status", "pending_review")
    .order("requested_at", { ascending: false });

  const { data: history } = await admin
    .from("account_deletion_requests")
    .select("*")
    .neq("status", "pending_review")
    .order("requested_at", { ascending: false })
    .limit(40);

  const pendingRows = (pending ?? []) as DeletionRequestRow[];
  const historyRows = (history ?? []) as DeletionRequestRow[];

  return (
    <AppShell>
      <PageHeader
        eyebrow="Trust and safety"
        title="Account deletion requests"
        description="Users with active offers, funded payments, submitted deliverables, or open disputes cannot self-serve delete. Review their request, then approve (anonymise + remove auth) or reject (let them retry once blockers clear)."
      />

      <Card className="mb-5">
        <CardHeader>
          <CardTitle>Pending review ({pendingRows.length})</CardTitle>
          <Badge tone={pendingRows.length ? "amber" : "neutral"}>{pendingRows.length ? "needs action" : "all clear"}</Badge>
        </CardHeader>
        {pendingRows.length === 0 ? (
          <p className="text-sm text-muted-foreground">No deletion requests waiting. Self-service deletions with no active workflows are processed instantly and do not appear here.</p>
        ) : (
          <div className="grid gap-3">
            {pendingRows.map((row) => (
              <article key={row.id} className="rounded-md border bg-white p-4 text-sm dark:border-white/8 dark:bg-card">
                <header className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold">{row.email}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {row.role ?? "unknown role"} · profile <span className="font-mono">{row.profile_id ? row.profile_id.slice(0, 8) : "—"}</span> · requested {new Date(row.requested_at).toLocaleString()}
                    </p>
                  </div>
                  <Badge tone="amber">{row.blockers?.length ?? 0} blocker{row.blockers?.length === 1 ? "" : "s"}</Badge>
                </header>
                {row.reason ? (
                  <p className="mt-3 rounded-md bg-muted p-3 text-sm italic">&ldquo;{row.reason}&rdquo;</p>
                ) : null}
                {row.blockers?.length ? (
                  <div className="mt-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Active workflows</p>
                    <ul className="mt-1 space-y-1 text-sm">
                      {row.blockers.map((blocker, idx) => (
                        <li key={`${row.id}-${idx}`} className="flex gap-2">
                          <span className="inline-flex h-5 items-center rounded bg-amber-100 px-1.5 text-xs font-mono text-amber-900 dark:bg-amber-950/40 dark:text-amber-200">{blocker.type ?? "?"}</span>
                          <span>
                            <span className="font-medium">{blocker.title}</span>
                            {blocker.reason ? <span className="ml-1 text-muted-foreground">— {blocker.reason}</span> : null}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
                <DeletionRequestActions requestId={row.id} />
              </article>
            ))}
          </div>
        )}
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Recent decisions</CardTitle>
          <Badge tone="neutral">last 40</Badge>
        </CardHeader>
        {historyRows.length === 0 ? (
          <p className="text-sm text-muted-foreground">No completed, rejected, or cancelled deletion requests yet.</p>
        ) : (
          <ul className="divide-y text-sm dark:divide-white/8">
            {historyRows.map((row) => (
              <li key={row.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <div>
                  <p className="font-medium">{row.email}</p>
                  <p className="text-xs text-muted-foreground">
                    {row.role ?? "unknown"} · processed {row.processed_at ? new Date(row.processed_at).toLocaleString() : "—"}
                  </p>
                </div>
                <Badge tone={statusTone(row.status)}>{row.status}</Badge>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </AppShell>
  );
}

function statusTone(status: string): "green" | "red" | "amber" | "neutral" {
  if (status === "completed") return "green";
  if (status === "rejected") return "red";
  if (status === "cancelled") return "amber";
  return "neutral";
}
