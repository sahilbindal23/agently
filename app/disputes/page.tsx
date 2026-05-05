import { redirect } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/layout/page-header";
import { ResolveDisputeForm } from "@/components/disputes/resolve-dispute-form";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { getCurrentUser } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { formatCurrency } from "@/lib/utils/format";

export const dynamic = "force-dynamic";

type DisputeRow = {
  id: string;
  deal_id: string | null;
  freelancer_project_id: string | null;
  opened_by_profile_id: string;
  opener_role: string;
  reason: string;
  evidence_url: string | null;
  status: string;
  decision_note: string | null;
  resolved_at: string | null;
  created_at: string;
};

export default async function DisputesPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role !== "admin") redirect("/dashboard");

  const admin = createAdminClient();
  if (!admin) redirect("/dashboard");

  const { data: rawDisputes } = await admin.from("disputes").select("*").order("created_at", { ascending: false });
  const disputes = (rawDisputes ?? []) as DisputeRow[];

  const dealIds = disputes.map((d) => d.deal_id).filter(Boolean) as string[];
  const projectIds = disputes.map((d) => d.freelancer_project_id).filter(Boolean) as string[];
  const openerIds = disputes.map((d) => d.opened_by_profile_id);

  const [{ data: deals }, { data: projects }, { data: openers }] = await Promise.all([
    dealIds.length ? admin.from("deals").select("id, title, amount_cents, currency, payment_status, brand_id, creator_id").in("id", dealIds) : Promise.resolve({ data: [] }),
    projectIds.length ? admin.from("freelancer_projects").select("id, title, amount_cents, currency, payment_status, brand_id, freelancer_id").in("id", projectIds) : Promise.resolve({ data: [] }),
    openerIds.length ? admin.from("profiles").select("id, full_name, email").in("id", openerIds) : Promise.resolve({ data: [] })
  ]);

  const dealMap = new Map((deals ?? []).map((d) => [d.id, d]));
  const projectMap = new Map((projects ?? []).map((p) => [p.id, p]));
  const openerMap = new Map((openers ?? []).map((o) => [o.id, o]));

  const open = disputes.filter((d) => d.status === "open");
  const resolved = disputes.filter((d) => d.status !== "open");

  return (
    <AppShell>
      <PageHeader
        eyebrow="Trust and safety"
        title="Disputes"
        description="Review open disputes, weigh evidence, and decide release, refund, split, or dismissal. Resolution updates payment status on the underlying deal or project."
      />

      <Card className="mb-5">
        <CardHeader>
          <CardTitle>Open ({open.length})</CardTitle>
          <Badge tone={open.length ? "red" : "green"}>{open.length ? "needs review" : "all clear"}</Badge>
        </CardHeader>
        {open.length === 0 ? (
          <p className="text-sm text-muted-foreground">No open disputes right now.</p>
        ) : (
          <div className="space-y-4">
            {open.map((dispute) => {
              const target = dispute.deal_id ? dealMap.get(dispute.deal_id) : dispute.freelancer_project_id ? projectMap.get(dispute.freelancer_project_id) : null;
              const opener = openerMap.get(dispute.opened_by_profile_id);
              return (
                <DisputeCard key={dispute.id} dispute={dispute} target={target} opener={opener} resolvable />
              );
            })}
          </div>
        )}
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Resolved ({resolved.length})</CardTitle>
        </CardHeader>
        {resolved.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nothing resolved yet.</p>
        ) : (
          <div className="space-y-4">
            {resolved.map((dispute) => {
              const target = dispute.deal_id ? dealMap.get(dispute.deal_id) : dispute.freelancer_project_id ? projectMap.get(dispute.freelancer_project_id) : null;
              const opener = openerMap.get(dispute.opened_by_profile_id);
              return (
                <DisputeCard key={dispute.id} dispute={dispute} target={target} opener={opener} />
              );
            })}
          </div>
        )}
      </Card>
    </AppShell>
  );
}

function DisputeCard({ dispute, target, opener, resolvable = false }: { dispute: DisputeRow; target: Record<string, unknown> | null | undefined; opener: Record<string, unknown> | undefined; resolvable?: boolean }) {
  const targetTitle = String(target?.title ?? "Contract");
  const targetAmount = target?.amount_cents ? formatCurrency(Number(target.amount_cents), String(target.currency ?? "inr")) : "—";
  const targetType = dispute.deal_id ? "Creator deal" : "Freelancer project";
  const tone = dispute.status === "open" ? "red" : dispute.status === "resolved_release" ? "green" : dispute.status === "resolved_refund" ? "amber" : dispute.status === "resolved_split" ? "blue" : "neutral";

  return (
    <div className="rounded-md border bg-white p-4 dark:border-white/8 dark:bg-card">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-semibold">{targetTitle}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {targetType} · {targetAmount} · payment: {String(target?.payment_status ?? "—")}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Opened by {String(opener?.full_name ?? "Unknown")} ({String(opener?.email ?? "")}, {dispute.opener_role}) on {new Date(dispute.created_at).toLocaleString()}
          </p>
        </div>
        <Badge tone={tone}>{dispute.status.replaceAll("_", " ")}</Badge>
      </div>
      <div className="space-y-3">
        <div>
          <p className="text-xs font-semibold uppercase text-muted-foreground">Reason</p>
          <p className="mt-1 whitespace-pre-wrap text-sm leading-6">{dispute.reason}</p>
        </div>
        {dispute.evidence_url ? (
          <div>
            <p className="text-xs font-semibold uppercase text-muted-foreground">Evidence</p>
            <a className="mt-1 inline-flex text-sm font-medium text-primary" href={dispute.evidence_url} rel="noreferrer" target="_blank">{dispute.evidence_url}</a>
          </div>
        ) : null}
        {dispute.decision_note ? (
          <div>
            <p className="text-xs font-semibold uppercase text-muted-foreground">Decision</p>
            <p className="mt-1 whitespace-pre-wrap text-sm leading-6">{dispute.decision_note}</p>
            {dispute.resolved_at ? <p className="mt-1 text-xs text-muted-foreground">Resolved {new Date(dispute.resolved_at).toLocaleString()}</p> : null}
          </div>
        ) : null}
        {resolvable ? <ResolveDisputeForm disputeId={dispute.id} /> : null}
      </div>
    </div>
  );
}
