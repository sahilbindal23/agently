import { redirect } from "next/navigation";
import { BrainCircuit, CheckCircle2, IndianRupee, Tags, Target, XCircle } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, Td, Th } from "@/components/ui/table";
import { getCurrentUser } from "@/lib/auth/session";
import { homeForRole } from "@/lib/auth/guards";
import { createAdminClient } from "@/lib/supabase/admin";
import { formatCurrency } from "@/lib/utils/format";

type LedgerRow = {
  id: string;
  campaign_id: string;
  entity_type: "creator" | "freelancer";
  entity_id: string;
  input_snapshot: Record<string, unknown>;
  prediction: Record<string, unknown>;
  original_rank: number | null;
  final_rank: number | null;
  base_fit_score: number | null;
  final_fit_score: number | null;
  marketplace_signals: string[];
  shortlisted: boolean;
  offer_sent: boolean;
  offer_amount_cents: number | null;
  response_status: string | null;
  counter_amount_cents: number | null;
  final_agreed_amount_cents: number | null;
  payment_status: string | null;
  deliverable_status: string | null;
  outcome_label: string | null;
  last_event_name: string | null;
  updated_at: string;
};

type NamedRow = LedgerRow & {
  campaign_name: string;
  talent_name: string;
};

export const dynamic = "force-dynamic";

export default async function OutcomeLedgerPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role !== "admin") redirect(homeForRole(user.role));

  const admin = createAdminClient();
  if (!admin) redirect("/dashboard");

  if (user.role !== "admin") {
    return (
      <AppShell>
        <PageHeader
          eyebrow="Training data"
          title="Recommendation Outcome Ledger"
          description="This page is reserved for Agently admins."
        />
        <Card>
          <p className="font-semibold">Admin access required</p>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">Outcome labels affect how Agently improves recommendations, pricing, and trust.</p>
        </Card>
      </AppShell>
    );
  }

  const rows = await getLedgerRows(admin);
  const metrics = getMetrics(rows);

  return (
    <AppShell>
      <PageHeader
        eyebrow="Training data"
        title="Recommendation Outcome Ledger"
        description="Every recommendation becomes a training row: what the engine predicted, what the brand did, how talent responded, whether money moved, and what outcome label Agently should learn from."
      />

      <section className="mb-5 grid gap-3 md:grid-cols-2 xl:grid-cols-6">
        <MetricCard icon={<BrainCircuit className="h-4 w-4" />} label="Training rows" value={rows.length} />
        <MetricCard icon={<Target className="h-4 w-4" />} label="Shortlisted" value={metrics.shortlisted} />
        <MetricCard icon={<Tags className="h-4 w-4" />} label="Offers sent" value={metrics.offersSent} />
        <MetricCard icon={<CheckCircle2 className="h-4 w-4" />} label="Accepted" value={metrics.accepted} />
        <MetricCard icon={<XCircle className="h-4 w-4" />} label="Declined" value={metrics.declined} />
        <MetricCard icon={<IndianRupee className="h-4 w-4" />} label="Avg agreed" value={metrics.averageAgreed ? formatCurrency(metrics.averageAgreed, "inr") : "-"} />
      </section>

      <section className="mb-5 grid gap-5 xl:grid-cols-[0.8fr_1.2fr]">
        <Card>
          <CardHeader>
            <CardTitle>Outcome Labels</CardTitle>
            <Badge tone="blue">{metrics.labels.length}</Badge>
          </CardHeader>
          <div className="grid gap-2">
            {metrics.labels.map((item) => (
              <div className="flex items-center justify-between gap-3 rounded-md border bg-white p-3" key={item.label}>
                <p className="text-sm font-semibold">{item.label}</p>
                <Badge tone={labelTone(item.label)}>{item.count}</Badge>
              </div>
            ))}
            {!metrics.labels.length ? <p className="text-sm text-muted-foreground">No outcome labels yet. Shortlist talent or send an offer to start labeling rows.</p> : null}
          </div>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>How To Read This</CardTitle>
            <Badge tone="green">model training</Badge>
          </CardHeader>
          <div className="grid gap-3 md:grid-cols-2">
            <Explainer title="Shortlisted but not offered" copy="Brand curiosity, not conviction. Useful, but weaker than an offer." />
            <Explainer title="Offer accepted" copy="Positive label. Similar future matches and price bands should gain confidence." />
            <Explainer title="Countered" copy="Model may be close, but terms or rate need calibration." />
            <Explainer title="Declined" copy="Could mean poor fit, low price, bad timing, or terms friction. Capture notes where possible." />
            <Explainer title="Funded + approved" copy="Strong positive training label because the workflow reached real execution." />
            <Explainer title="Revision/dispute" copy="Reliability and scope clarity should be penalized until resolved." />
          </div>
        </Card>
      </section>

      <Card>
        <CardHeader>
          <CardTitle>Ledger Rows</CardTitle>
          <Badge tone="blue">{rows.length} latest</Badge>
        </CardHeader>
        <div className="overflow-x-auto">
          <Table>
            <thead>
              <tr>
                <Th>Prediction</Th>
                <Th>Rank</Th>
                <Th>Score</Th>
                <Th>Brand action</Th>
                <Th>Offer</Th>
                <Th>Outcome</Th>
                <Th>Signals</Th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id}>
                  <Td className="min-w-72">
                    <p className="font-medium">{row.talent_name}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{row.entity_type} for {row.campaign_name}</p>
                    <p className="mt-2 text-sm leading-5">{String(row.prediction.reason ?? "No prediction reason captured.")}</p>
                  </Td>
                  <Td>
                    <p className="text-sm">Base #{row.original_rank ?? "-"}</p>
                    <p className="text-sm">Final #{row.final_rank ?? "-"}</p>
                  </Td>
                  <Td>
                    <p className="text-sm">Base {row.base_fit_score ?? "-"}</p>
                    <p className="text-sm font-semibold">Final {row.final_fit_score ?? "-"}</p>
                  </Td>
                  <Td>
                    <div className="flex flex-wrap gap-1.5">
                      <Badge tone={row.shortlisted ? "green" : "neutral"}>{row.shortlisted ? "shortlisted" : "not shortlisted"}</Badge>
                      <Badge tone={row.offer_sent ? "green" : "neutral"}>{row.offer_sent ? "offer sent" : "no offer"}</Badge>
                      {row.response_status ? <Badge tone={responseTone(row.response_status)}>{row.response_status}</Badge> : null}
                    </div>
                  </Td>
                  <Td className="min-w-44">
                    <p className="text-sm">Offer: {row.offer_amount_cents ? formatCurrency(row.offer_amount_cents, "inr") : "-"}</p>
                    <p className="text-sm">Counter: {row.counter_amount_cents ? formatCurrency(row.counter_amount_cents, "inr") : "-"}</p>
                    <p className="text-sm font-semibold">Final: {row.final_agreed_amount_cents ? formatCurrency(row.final_agreed_amount_cents, "inr") : "-"}</p>
                  </Td>
                  <Td>
                    <div className="flex flex-wrap gap-1.5">
                      <Badge tone={labelTone(row.outcome_label)}>{row.outcome_label ?? "unlabeled"}</Badge>
                      {row.payment_status ? <Badge tone="blue">{row.payment_status}</Badge> : null}
                      {row.deliverable_status ? <Badge tone="blue">{row.deliverable_status}</Badge> : null}
                    </div>
                  </Td>
                  <Td className="min-w-60">
                    <div className="flex flex-wrap gap-1.5">
                      {(row.marketplace_signals ?? []).map((signal) => <Badge key={signal} tone="green">{signal}</Badge>)}
                      {row.last_event_name ? <Badge tone="neutral">{row.last_event_name}</Badge> : null}
                      {!row.marketplace_signals?.length && !row.last_event_name ? <Badge tone="neutral">no behavior yet</Badge> : null}
                    </div>
                  </Td>
                </tr>
              ))}
              {!rows.length ? (
                <tr>
                  <Td colSpan={7}>
                    <p className="rounded-md border bg-muted p-3 text-sm text-muted-foreground">
                      No ledger rows yet. Run migration 029, then open a campaign recommendation page to write prediction rows.
                    </p>
                  </Td>
                </tr>
              ) : null}
            </tbody>
          </Table>
        </div>
      </Card>
    </AppShell>
  );
}

function MetricCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: number | string }) {
  return (
    <Card className="p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">{label}</p>
        <span className="text-primary">{icon}</span>
      </div>
      <p className="mt-3 text-2xl font-bold tracking-normal">{value}</p>
    </Card>
  );
}

function Explainer({ copy, title }: { copy: string; title: string }) {
  return (
    <div className="rounded-md border bg-white p-3">
      <p className="font-semibold">{title}</p>
      <p className="mt-1 text-sm leading-6 text-muted-foreground">{copy}</p>
    </div>
  );
}

async function getLedgerRows(admin: NonNullable<ReturnType<typeof createAdminClient>>) {
  try {
    const [ledgerResult, campaignsResult, creatorsResult, freelancersResult] = await Promise.all([
      admin.from("recommendation_outcome_ledger").select("*").order("updated_at", { ascending: false }).limit(250),
      admin.from("campaigns").select("id, title"),
      admin.from("creators").select("id, display_name"),
      admin.from("freelancers").select("id, display_name")
    ]);
    const campaigns = new Map((campaignsResult.data ?? []).map((item) => [String(item.id), String(item.title ?? "Campaign")]));
    const creators = new Map((creatorsResult.data ?? []).map((item) => [String(item.id), String(item.display_name ?? "Creator")]));
    const freelancers = new Map((freelancersResult.data ?? []).map((item) => [String(item.id), String(item.display_name ?? "Freelancer")]));

    return ((ledgerResult.data ?? []) as LedgerRow[]).map((row) => ({
      ...row,
      campaign_name: campaigns.get(row.campaign_id) ?? "Campaign",
      talent_name: row.entity_type === "creator"
        ? creators.get(row.entity_id) ?? String(row.input_snapshot?.name ?? "Creator")
        : freelancers.get(row.entity_id) ?? String(row.input_snapshot?.name ?? "Freelancer")
    }));
  } catch {
    return [] as NamedRow[];
  }
}

function getMetrics(rows: NamedRow[]) {
  const accepted = rows.filter((row) => ["accepted", "accepted_after_counter"].includes(String(row.outcome_label))).length;
  const declined = rows.filter((row) => row.outcome_label === "declined").length;
  const agreedAmounts = rows.map((row) => Number(row.final_agreed_amount_cents ?? 0)).filter(Boolean);
  const labelCounts = new Map<string, number>();
  rows.forEach((row) => {
    const label = row.outcome_label ?? "unlabeled";
    labelCounts.set(label, (labelCounts.get(label) ?? 0) + 1);
  });

  return {
    accepted,
    averageAgreed: agreedAmounts.length ? Math.round(agreedAmounts.reduce((sum, value) => sum + value, 0) / agreedAmounts.length) : 0,
    declined,
    labels: Array.from(labelCounts.entries()).map(([label, count]) => ({ count, label })).sort((a, b) => b.count - a.count),
    offersSent: rows.filter((row) => row.offer_sent).length,
    shortlisted: rows.filter((row) => row.shortlisted).length
  };
}

function labelTone(label: string | null | undefined) {
  if (["accepted", "accepted_after_counter", "delivery_approved", "paid_successfully", "funded"].includes(String(label))) return "green";
  if (["declined", "delivery_issue", "payment_issue", "weak_interest"].includes(String(label))) return "red";
  if (["countered", "counter_declined", "brand_interest", "offer_sent"].includes(String(label))) return "amber";
  return "neutral";
}

function responseTone(status: string) {
  if (status === "accepted") return "green";
  if (status === "declined") return "red";
  if (status === "changes_requested") return "amber";
  return "blue";
}
