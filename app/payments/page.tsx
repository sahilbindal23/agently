import { AppShell } from "@/components/layout/app-shell";
import { DeliverableCard } from "@/components/deliverables/deliverable-card";
import { PageHeader } from "@/components/layout/page-header";
import { PaymentActions } from "@/components/payments/payment-actions";
import { ProtectionCalculator } from "@/components/payments/protection-calculator";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, Td, Th } from "@/components/ui/table";
import { getAgentlyData } from "@/lib/db/live-data";
import { createAdminClient } from "@/lib/supabase/admin";
import { formatCurrency } from "@/lib/utils/format";
import type { Deliverable } from "@/types";

const statuses = ["unpaid", "pending", "funded", "release_ready", "released", "refunded", "disputed"];

export default async function PaymentsPage() {
  const { deals, payments } = await getAgentlyData();
  const projects = await getFreelancerProjects();
  const latestDeliverables = await getLatestDeliverables(
    deals.map((deal) => ({ type: "deal" as const, id: deal.id })),
    projects.map((project) => ({ type: "freelancer_project" as const, id: String(project.id) }))
  );
  const queue = [
    ...deals.map((deal) => ({
      id: deal.id,
      type: "deal" as const,
      title: deal.title,
      status: deal.payment_status,
      amount_cents: deal.amount_cents,
      currency: deal.currency,
      payout_cents: Math.max(0, deal.amount_cents - Math.round(deal.amount_cents * 0.1)),
      session: payments.find((payment) => payment.deal_id === deal.id)?.stripe_checkout_session_id ?? "not created",
      deliverable: latestDeliverables.get(`deal-${deal.id}`)
    })),
    ...projects.map((project) => ({
      id: project.id,
      type: "freelancer_project" as const,
      title: project.title,
      status: project.payment_status,
      amount_cents: Number(project.amount_cents ?? 0),
      currency: project.currency ?? "inr",
      payout_cents: Math.max(0, Number(project.amount_cents ?? 0) - Math.round(Number(project.amount_cents ?? 0) * 0.1)),
      session: "manual project",
      deliverable: latestDeliverables.get(`freelancer_project-${project.id}`)
    }))
  ];
  const largestAmount = queue.reduce((max, item) => Math.max(max, item.amount_cents), 0);

  return (
    <AppShell>
      <PageHeader
        eyebrow="Payment orchestration"
        title="Protected payout workflow"
        description="Use Stripe checkout to collect funds, track funded deals, approve deliverables, and mark payouts released without representing this MVP as regulated escrow."
      />
      <section className="mb-5 grid gap-3 md:grid-cols-4 xl:grid-cols-7">
        {statuses.map((status) => (
          <Card key={status} className="p-4">
            <p className="text-xs text-muted-foreground">{status}</p>
            <p className="mt-2 text-2xl font-bold">{queue.filter((item) => item.status === status).length}</p>
          </Card>
        ))}
      </section>
      <div className="mb-5">
        <ProtectionCalculator amountCents={largestAmount || 2500000} />
      </div>
      <Card>
        <CardHeader><CardTitle>Payment Queue</CardTitle><Badge tone="green">creator deals + freelancer projects</Badge></CardHeader>
        <div className="overflow-x-auto">
          <Table>
            <thead><tr><Th>Item</Th><Th>Type</Th><Th>Status</Th><Th>Deliverable</Th><Th>Session</Th><Th className="text-right">Amount</Th><Th className="text-right">Talent payout</Th><Th></Th></tr></thead>
            <tbody>
              {queue.map((item) => (
                <tr key={`${item.type}-${item.id}`}>
                  <Td className="font-medium">{item.title}</Td>
                  <Td>{item.type === "deal" ? "Creator deal" : "Freelancer project"}</Td>
                  <Td><Badge tone={item.status === "release_ready" || item.status === "released" ? "green" : item.status === "pending" ? "amber" : "blue"}>{item.status}</Badge></Td>
                  <Td className="min-w-80"><DeliverableCard deliverable={item.deliverable} canReview /></Td>
                  <Td>{item.session}</Td>
                  <Td className="text-right">{formatCurrency(item.amount_cents, item.currency)}</Td>
                  <Td className="text-right font-semibold">{formatCurrency(item.payout_cents, item.currency)}</Td>
                  <Td><PaymentActions entityId={item.id} entityType={item.type} /></Td>
                </tr>
              ))}
            </tbody>
          </Table>
        </div>
      </Card>
    </AppShell>
  );
}

async function getFreelancerProjects() {
  const admin = createAdminClient();
  if (!admin) return [];
  const { data } = await admin.from("freelancer_projects").select("*").order("created_at", { ascending: false });
  return data ?? [];
}

async function getLatestDeliverables(
  deals: Array<{ type: "deal"; id: string }>,
  projects: Array<{ type: "freelancer_project"; id: string }>
) {
  const admin = createAdminClient();
  const map = new Map<string, Deliverable>();
  if (!admin) return map;

  const [dealDeliverables, projectDeliverables] = await Promise.all([
    deals.length
      ? admin.from("deliverables").select("*").in("deal_id", deals.map((deal) => deal.id)).order("created_at", { ascending: false })
      : { data: [] },
    projects.length
      ? admin.from("deliverables").select("*").in("freelancer_project_id", projects.map((project) => project.id)).order("created_at", { ascending: false })
      : { data: [] }
  ]);

  ([...(dealDeliverables.data ?? []), ...(projectDeliverables.data ?? [])] as Deliverable[]).forEach((deliverable) => {
    const key = deliverable.deal_id ? `deal-${deliverable.deal_id}` : `freelancer_project-${deliverable.freelancer_project_id}`;
    if (!map.has(key)) map.set(key, deliverable);
  });

  return map;
}
