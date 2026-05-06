import { AppShell } from "@/components/layout/app-shell";
import { DeliverableCard } from "@/components/deliverables/deliverable-card";
import { PageHeader } from "@/components/layout/page-header";
import { PaymentActions } from "@/components/payments/payment-actions";
import { ProtectionCalculator } from "@/components/payments/protection-calculator";
import { PaymentStatusBadge } from "@/components/payments/payment-status-badge";
import { DealProtectionTimeline } from "@/components/protection/deal-protection-timeline";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, Td, Th } from "@/components/ui/table";
import { getCurrentUser } from "@/lib/auth/session";
import { getAgentlyData } from "@/lib/db/live-data";
import { calculatePaymentSplit } from "@/lib/payments/workflow";
import { createAdminClient } from "@/lib/supabase/admin";
import { formatCurrency } from "@/lib/utils/format";
import type { Deliverable, PaymentStatus, RiskLevel } from "@/types";

const statuses = ["unpaid", "pending", "funded", "release_ready", "released", "refunded", "disputed"];

export const dynamic = "force-dynamic";

export default async function PaymentsPage() {
  const user = await getCurrentUser();
  const admin = createAdminClient();
  const { deals, payments } = await getAgentlyData();
  const scope = admin && user ? await getPaymentScope(admin, user) : { dealIds: [], brandIds: [], creatorIds: [], freelancerIds: [], projectIds: [] };
  const visibleDeals = filterDealsForUser(deals, user?.role, scope);
  const paymentDeals = visibleDeals.filter((deal) => deal.offer_status === "accepted" || user?.role === "admin");
  const visiblePayments = payments.filter((payment) => paymentDeals.some((deal) => deal.id === payment.deal_id));
  const projects = (await getFreelancerProjects(scope, user?.role)).filter((project) => String(project.status ?? "") === "accepted" || user?.role === "admin");
  const projectPayments = payments.filter((payment) => projects.some((project) => String(project.id) === payment.freelancer_project_id));
  const latestDeliverables = await getLatestDeliverables(
    visibleDeals.map((deal) => ({ type: "deal" as const, id: deal.id })),
    projects.map((project) => ({ type: "freelancer_project" as const, id: String(project.id) }))
  );
  const latestContractRisks = await getLatestContractRisks(visibleDeals.map((deal) => deal.id));
  const queue = [
    ...paymentDeals.map((deal) => ({
      id: deal.id,
      type: "deal" as const,
      title: deal.title,
      status: deal.payment_status as PaymentStatus,
      amount_cents: deal.amount_cents,
      currency: deal.currency,
      payout_cents: calculatePaymentSplit(deal.amount_cents).talentPayoutCents,
      session: visiblePayments.find((payment) => payment.deal_id === deal.id)?.stripe_checkout_session_id ?? "not created",
      deliverable: latestDeliverables.get(`deal-${deal.id}`),
      contractRisk: latestContractRisks.get(deal.id),
      hasContract: latestContractRisks.has(deal.id),
      canFund: deal.offer_status === "accepted"
    })),
    ...projects.map((project) => ({
      id: project.id,
      type: "freelancer_project" as const,
      title: project.title,
      status: String(project.payment_status ?? "unpaid") as PaymentStatus,
      amount_cents: Number(project.amount_cents ?? 0),
      currency: project.currency ?? "inr",
      payout_cents: calculatePaymentSplit(Number(project.amount_cents ?? 0)).talentPayoutCents,
      session: projectPayments.find((payment) => payment.freelancer_project_id === String(project.id))?.stripe_checkout_session_id ?? "not created",
      deliverable: latestDeliverables.get(`freelancer_project-${project.id}`),
      contractRisk: null,
      hasContract: Boolean(project.usage_context || project.approval_terms),
      canFund: String(project.status ?? "") === "accepted"
    }))
  ];
  const largestAmount = queue.reduce((max, item) => Math.max(max, item.amount_cents), 0);
  const canManagePayments = user?.role === "admin" || user?.role === "brand";

  return (
    <AppShell>
      <PageHeader
        eyebrow="Payment orchestration"
        title="Protected payout workflow"
        description="Track accepted work from funding to delivery approval and payout release. The payment rail can be swapped from prototype checkout to Razorpay for India-first payments."
      />
      <WorkflowGuidance role={user?.role} />
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
            <thead><tr><Th>Item</Th><Th>Protection state</Th><Th>Deliverable</Th><Th>Funding ref</Th><Th className="text-right">Amount</Th><Th className="text-right">Talent payout</Th><Th></Th></tr></thead>
            <tbody>
              {queue.map((item) => (
                <tr key={`${item.type}-${item.id}`}>
                  <Td className="min-w-72">
                    <p className="font-medium">{item.title}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{item.type === "deal" ? "Creator deal" : "Freelancer project"}</p>
                    <DealProtectionTimeline
                      accepted
                      contractRisk={item.contractRisk}
                      deliverableStatus={item.deliverable?.status}
                      hasContract={item.hasContract}
                      hasDeliverable={Boolean(item.deliverable)}
                      paymentStatus={item.status}
                      variant="inline"
                    />
                  </Td>
                  <Td className="min-w-64">
                    <PaymentStatusBadge status={item.status} />
                    <p className="mt-2 text-sm leading-5 text-muted-foreground">{paymentGuidance(item.status, Boolean(item.deliverable), item.deliverable?.status)}</p>
                  </Td>
                  <Td className="min-w-80"><DeliverableCard deliverable={item.deliverable} canReview={canManagePayments} /></Td>
                  <Td>{fundingReference(item.session, item.status)}</Td>
                  <Td className="text-right">{formatCurrency(item.amount_cents, item.currency)}</Td>
                  <Td className="text-right font-semibold">{formatCurrency(item.payout_cents, item.currency)}</Td>
                  <Td>{canManagePayments ? <PaymentActions canFund={item.canFund} canRelease={user?.role === "admin"} entityId={item.id} entityType={item.type} isAdmin={user?.role === "admin"} paymentStatus={item.status} /> : <Badge tone="neutral">view only</Badge>}</Td>
                </tr>
              ))}
              {queue.length === 0 ? (
                <tr>
                  <Td colSpan={8} className="text-muted-foreground">No payments are connected to your account yet.</Td>
                </tr>
              ) : null}
            </tbody>
          </Table>
        </div>
      </Card>
    </AppShell>
  );
}

type PaymentScope = {
  brandIds: string[];
  creatorIds: string[];
  freelancerIds: string[];
};

async function getPaymentScope(admin: NonNullable<ReturnType<typeof createAdminClient>>, user: NonNullable<Awaited<ReturnType<typeof getCurrentUser>>>): Promise<PaymentScope> {
  if (user.role === "admin") return { brandIds: [], creatorIds: [], freelancerIds: [] };

  const [{ data: brands }, { data: audits }, { data: creators }, { data: freelancers }] = await Promise.all([
    admin.from("brands").select("id").eq("contact_email", user.email),
    admin.from("brand_audits").select("brand_id").eq("profile_id", user.id),
    admin.from("creators").select("id").eq("profile_id", user.id),
    admin.from("freelancers").select("id").eq("profile_id", user.id)
  ]);

  return {
    brandIds: Array.from(new Set([
      ...((brands ?? []).map((brand) => String(brand.id))),
      ...((audits ?? []).map((audit) => String(audit.brand_id)).filter(Boolean))
    ])),
    creatorIds: (creators ?? []).map((creator) => String(creator.id)),
    freelancerIds: (freelancers ?? []).map((freelancer) => String(freelancer.id))
  };
}

function filterDealsForUser(deals: Awaited<ReturnType<typeof getAgentlyData>>["deals"], role: string | undefined, scope: PaymentScope) {
  if (role === "admin") return deals;
  if (role === "brand") return deals.filter((deal) => scope.brandIds.includes(deal.brand_id));
  if (role === "creator") return deals.filter((deal) => scope.creatorIds.includes(deal.creator_id) && deal.offer_status === "accepted");
  return [];
}

function WorkflowGuidance({ role }: { role?: string }) {
  const copy = role === "brand"
    ? {
      title: "Brand payment flow",
      body: "Only accepted offers appear here. Generate the funding link once scope is agreed, then wait for funding to show as protected before expecting final delivery."
    }
    : role === "creator" || role === "freelancer"
      ? {
        title: "Talent payment flow",
        body: "Accepted work appears here after you accept an offer or project. Start planning, but do not submit final work until the status says funded."
      }
      : {
        title: "Admin payment flow",
        body: "Review accepted work, funding status, deliverables, disputes, and release readiness across all creator deals and freelancer projects."
      };

  return (
    <Card className="mb-5 border-primary/20 bg-primary/5 dark:border-primary/30 dark:bg-primary/10">
      <div className="flex flex-col gap-2 p-1">
        <p className="text-sm font-semibold">{copy.title}</p>
        <p className="text-sm leading-6 text-muted-foreground">{copy.body}</p>
      </div>
    </Card>
  );
}

function fundingReference(session: string, status: string) {
  if (status === "unpaid") return "not generated";
  if (session === "not created") return "manual tracking";
  return session;
}

async function getFreelancerProjects(scope: PaymentScope, role: string | undefined) {
  const admin = createAdminClient();
  if (!admin) return [];
  if (role === "brand" && scope.brandIds.length === 0) return [];
  if (role === "freelancer" && scope.freelancerIds.length === 0) return [];

  let query = admin.from("freelancer_projects").select("*").order("created_at", { ascending: false });
  if (role === "brand") query = query.in("brand_id", scope.brandIds);
  if (role === "freelancer") query = query.in("freelancer_id", scope.freelancerIds);
  if (role === "creator") return [];
  const { data } = await query;
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

async function getLatestContractRisks(dealIds: string[]) {
  const admin = createAdminClient();
  const map = new Map<string, RiskLevel>();
  if (!admin || dealIds.length === 0) return map;

  const { data } = await admin
    .from("contracts")
    .select("deal_id, risk_level, created_at")
    .in("deal_id", dealIds)
    .order("created_at", { ascending: false });

  (data ?? []).forEach((contract) => {
    const dealId = String(contract.deal_id ?? "");
    if (dealId && !map.has(dealId)) map.set(dealId, String(contract.risk_level ?? "caution") as RiskLevel);
  });
  return map;
}

function paymentGuidance(status: string, hasDeliverable: boolean, deliverableStatus?: string) {
  if (status === "unpaid") return "Accepted work is waiting for brand funding. Talent should not start final delivery yet.";
  if (status === "pending") return "A funding link has been created or marked pending. Confirm funds before delivery starts.";
  if (status === "funded" && !hasDeliverable) return "Funds are protected. Talent can submit the agreed deliverable.";
  if (status === "funded" && deliverableStatus === "submitted") return "Deliverable is waiting for brand/admin review.";
  if (status === "release_ready") return "Deliverable is approved. Admin can release the payout.";
  if (status === "released") return "Payout is marked released and the workflow is complete.";
  if (status === "disputed") return "Hold release while scope, delivery, or approval is reviewed.";
  if (status === "refunded") return "Payment was refunded. This work item should not proceed without a new agreement.";
  return "Track funding, delivery, approval, and payout release from here.";
}
