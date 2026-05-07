import Link from "next/link";
import { redirect } from "next/navigation";
import { AlertTriangle, ArrowRight, Banknote, CheckCircle2, Clock3, FileWarning, History, ShieldCheck, UserCheck } from "lucide-react";
import { VerificationActions } from "@/components/admin/verification-actions";
import { DeliverableCard } from "@/components/deliverables/deliverable-card";
import { AppShell } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/layout/page-header";
import { AutomationRunner } from "@/components/ops/automation-runner";
import { PaymentActions } from "@/components/payments/payment-actions";
import { PaymentStatusBadge } from "@/components/payments/payment-status-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, Td, Th } from "@/components/ui/table";
import { VerificationBadge } from "@/components/verification/verification-badge";
import { getCurrentUser } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { formatCurrency } from "@/lib/utils/format";
import type { Deliverable, PaymentStatus, RiskLevel } from "@/types";

type Row = Record<string, unknown>;

export const dynamic = "force-dynamic";

export default async function OpsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const admin = createAdminClient();
  if (!admin) redirect("/dashboard");

  if (user.role !== "admin") {
    return (
      <AppShell>
        <PageHeader
          eyebrow="Internal operations"
          title="Ops Center"
          description="This page is reserved for Agently admins who review marketplace exceptions."
        />
        <Card>
          <p className="font-semibold">Admin access required</p>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">Your account can use the role-specific Activity Center for your own workflow tasks.</p>
        </Card>
      </AppShell>
    );
  }

  const ops = await getOpsQueues(admin);
  const totalExceptions = ops.highRiskContracts.length + ops.acceptedUnfunded.length + ops.submittedDeliverables.length + ops.releaseReady.length + ops.verificationQueue.length + ops.stalledOffers.length;

  return (
    <AppShell>
      <PageHeader
        eyebrow="Internal operations"
        title="Admin Ops Center"
        description="Exception-first marketplace control: review risk, unblock funding, approve delivery, release payouts, and verify profiles without hunting across the app."
      />

      <AutomationRunner />

      <section className="mb-5 grid gap-3 md:grid-cols-3 xl:grid-cols-6">
        <OpsMetric icon={<AlertTriangle className="h-4 w-4" />} label="Open exceptions" tone={totalExceptions ? "amber" : "green"} value={totalExceptions} />
        <OpsMetric icon={<FileWarning className="h-4 w-4" />} label="Contract risk" tone={ops.highRiskContracts.length ? "red" : "green"} value={ops.highRiskContracts.length} />
        <OpsMetric icon={<Banknote className="h-4 w-4" />} label="Unfunded accepted" tone={ops.acceptedUnfunded.length ? "amber" : "green"} value={ops.acceptedUnfunded.length} />
        <OpsMetric icon={<CheckCircle2 className="h-4 w-4" />} label="Delivery review" tone={ops.submittedDeliverables.length ? "amber" : "green"} value={ops.submittedDeliverables.length} />
        <OpsMetric icon={<ShieldCheck className="h-4 w-4" />} label="Release ready" tone={ops.releaseReady.length ? "green" : "blue"} value={ops.releaseReady.length} />
        <OpsMetric icon={<UserCheck className="h-4 w-4" />} label="Verify profiles" tone={ops.verificationQueue.length ? "amber" : "green"} value={ops.verificationQueue.length} />
      </section>

      <section className="mb-5 grid gap-4 xl:grid-cols-4">
        <RuleCard title="Safe contract + funded + approved" copy="Route toward release-ready. Admin still controls final release in this MVP." />
        <RuleCard title="High-risk contract" copy="Block acceptance until terms are narrowed or the talent explicitly acknowledges risk." />
        <RuleCard title="Accepted but unfunded" copy="Prompt brand funding before talent submits final deliverables." />
        <RuleCard title="Submitted deliverable" copy="Route to brand/admin review. Approval moves payment toward release-ready." />
      </section>

      <section className="grid gap-5">
        <ContractRiskQueue items={ops.highRiskContracts} />
        <FundingQueue items={ops.acceptedUnfunded} />
        <DeliveryReviewQueue items={ops.submittedDeliverables} />
        <ReleaseQueue items={ops.releaseReady} />
        <StalledOfferQueue items={ops.stalledOffers} />
        <VerificationQueue items={ops.verificationQueue} />
        <AutomationAudit events={ops.automationEvents} />
      </section>
    </AppShell>
  );
}

async function getOpsQueues(admin: NonNullable<ReturnType<typeof createAdminClient>>) {
  const [
    dealsResult,
    projectsResult,
    contractsResult,
    flagsResult,
    deliverablesResult,
    paymentsResult,
    creatorsResult,
    freelancersResult,
    brandsResult,
    eventsResult
  ] = await Promise.all([
    admin.from("deals").select("*").order("created_at", { ascending: false }),
    admin.from("freelancer_projects").select("*").order("created_at", { ascending: false }),
    admin.from("contracts").select("*").order("created_at", { ascending: false }),
    admin.from("contract_flags").select("*"),
    admin.from("deliverables").select("*").order("created_at", { ascending: false }),
    admin.from("payments").select("*").order("created_at", { ascending: false }),
    admin.from("creators").select("*").order("created_at", { ascending: false }),
    admin.from("freelancers").select("*").order("created_at", { ascending: false }),
    admin.from("brands").select("*").order("created_at", { ascending: false }),
    admin.from("product_events").select("*").eq("event_name", "workflow_automation_applied").order("created_at", { ascending: false }).limit(12)
  ]);

  const deals = rows(dealsResult.data);
  const projects = rows(projectsResult.data);
  const contracts = rows(contractsResult.data);
  const flags = rows(flagsResult.data);
  const deliverables = rows(deliverablesResult.data) as Deliverable[];
  const payments = rows(paymentsResult.data);
  const creators = rows(creatorsResult.data);
  const freelancers = rows(freelancersResult.data);
  const brands = rows(brandsResult.data);
  const automationEvents = rows(eventsResult.data).map((event) => ({
    id: String(event.id),
    entityType: text(event.entity_type, "workflow"),
    entityId: text(event.entity_id, "unknown"),
    createdAt: text(event.created_at, ""),
    metadata: asRecord(event.metadata)
  }));

  const creatorName = (id: unknown) => text(creators.find((creator) => creator.id === id)?.display_name, "Creator");
  const freelancerName = (id: unknown) => text(freelancers.find((freelancer) => freelancer.id === id)?.display_name, "Freelancer");
  const brandName = (id: unknown) => text(brands.find((brand) => brand.id === id)?.name, "Brand");

  const highRiskContracts = contracts
    .filter((contract) => ["high_risk", "caution"].includes(String(contract.risk_level ?? "")))
    .slice(0, 8)
    .map((contract) => {
      const deal = deals.find((item) => item.id === contract.deal_id);
      return {
        id: String(contract.id),
        dealId: String(contract.deal_id),
        title: text(deal?.title, "Contract review"),
        brand: brandName(deal?.brand_id),
        creator: creatorName(deal?.creator_id),
        risk: String(contract.risk_level ?? "caution") as RiskLevel,
        summary: text(contract.summary, "Review contract flags before moving forward."),
        flags: flags.filter((flag) => flag.contract_id === contract.id)
      };
    });

  const acceptedUnfunded = [
    ...deals.filter((deal) => String(deal.offer_status ?? "") === "accepted" && ["unpaid", "pending"].includes(String(deal.payment_status ?? ""))).map((deal) => ({
      id: String(deal.id),
      type: "deal" as const,
      title: text(deal.title, "Creator deal"),
      talent: creatorName(deal.creator_id),
      brand: brandName(deal.brand_id),
      amount: number(deal.amount_cents),
      currency: text(deal.currency, "inr"),
      status: text(deal.payment_status, "unpaid") as PaymentStatus
    })),
    ...projects.filter((project) => String(project.status ?? "") === "accepted" && ["unpaid", "pending"].includes(String(project.payment_status ?? ""))).map((project) => ({
      id: String(project.id),
      type: "freelancer_project" as const,
      title: text(project.title, "Freelancer project"),
      talent: freelancerName(project.freelancer_id),
      brand: brandName(project.brand_id),
      amount: number(project.amount_cents),
      currency: text(project.currency, "inr"),
      status: text(project.payment_status, "unpaid") as PaymentStatus
    }))
  ].slice(0, 10);

  const submittedDeliverables = deliverables
    .filter((deliverable) => deliverable.status === "submitted")
    .slice(0, 10)
    .map((deliverable) => {
      const deal = deliverable.deal_id ? deals.find((item) => item.id === deliverable.deal_id) : null;
      const project = deliverable.freelancer_project_id ? projects.find((item) => item.id === deliverable.freelancer_project_id) : null;
      return {
        deliverable,
        workTitle: text(deal?.title ?? project?.title, "Submitted work"),
        talent: deal ? creatorName(deal.creator_id) : freelancerName(project?.freelancer_id),
        brand: brandName(deal?.brand_id ?? project?.brand_id)
      };
    });

  const releaseReady = payments
    .filter((payment) => String(payment.status ?? "") === "release_ready")
    .slice(0, 10)
    .map((payment) => {
      const deal = payment.deal_id ? deals.find((item) => item.id === payment.deal_id) : null;
      const project = payment.freelancer_project_id ? projects.find((item) => item.id === payment.freelancer_project_id) : null;
      return {
        id: String(payment.deal_id ?? payment.freelancer_project_id),
        type: payment.deal_id ? "deal" as const : "freelancer_project" as const,
        title: text(deal?.title ?? project?.title, "Payout"),
        talent: deal ? creatorName(deal.creator_id) : freelancerName(project?.freelancer_id),
        brand: brandName(deal?.brand_id ?? project?.brand_id),
        amount: number(payment.creator_payout_cents || payment.amount_cents),
        currency: text(deal?.currency ?? project?.currency, "inr"),
        status: text(payment.status, "release_ready") as PaymentStatus
      };
    })
    .filter((item) => item.id && item.id !== "undefined");

  const stalledOffers = [
    ...deals.filter((deal) => isPendingOffer(deal) && ageDays(deal.created_at) >= 3).map((deal) => ({
      id: String(deal.id),
      href: `/deals/${deal.id}`,
      type: "Creator offer",
      title: text(deal.title, "Creator offer"),
      talent: creatorName(deal.creator_id),
      brand: brandName(deal.brand_id),
      age: ageDays(deal.created_at)
    })),
    ...projects.filter((project) => isPendingProject(project) && ageDays(project.created_at) >= 3).map((project) => ({
      id: String(project.id),
      href: "/payments",
      type: "Freelancer project",
      title: text(project.title, "Freelancer project"),
      talent: freelancerName(project.freelancer_id),
      brand: brandName(project.brand_id),
      age: ageDays(project.created_at)
    }))
  ].sort((a, b) => b.age - a.age).slice(0, 8);

  const verificationQueue = [
    ...creators.filter(needsVerification).map((creator) => ({
      id: String(creator.id),
      type: "creator" as const,
      name: text(creator.display_name, "Creator"),
      status: text(creator.verification_status, "unverified"),
      tier: text(creator.verification_tier, "unverified"),
      signals: `${text(creator.primary_niche, "No niche")} - monetization ${number(creator.monetization_score)}/100`,
      checks: asRecord(creator.verification_checks)
    })),
    ...freelancers.filter(needsVerification).map((freelancer) => ({
      id: String(freelancer.id),
      type: "freelancer" as const,
      name: text(freelancer.display_name, "Freelancer"),
      status: text(freelancer.verification_status, "unverified"),
      tier: text(freelancer.verification_tier, "unverified"),
      signals: `${text(freelancer.service_category, "No category")} - portfolio ${number(freelancer.portfolio_score)}/100`,
      checks: asRecord(freelancer.verification_checks)
    })),
    ...brands.filter(needsVerification).map((brand) => ({
      id: String(brand.id),
      type: "brand" as const,
      name: text(brand.name, "Brand"),
      status: text(brand.verification_status, "unverified"),
      tier: text(brand.verification_tier, "unverified"),
      signals: `${text(brand.industry, "No industry")} - ${text(brand.website, "No website")}`,
      checks: asRecord(brand.verification_checks)
    }))
  ].slice(0, 8);

  return { acceptedUnfunded, automationEvents, highRiskContracts, releaseReady, stalledOffers, submittedDeliverables, verificationQueue };
}

function ContractRiskQueue({ items }: { items: Awaited<ReturnType<typeof getOpsQueues>>["highRiskContracts"] }) {
  return (
    <Card>
      <CardHeader><CardTitle>Contract Risk Queue</CardTitle><Badge tone={items.length ? "red" : "green"}>{items.length} items</Badge></CardHeader>
      <div className="grid gap-3">
        {items.map((item) => (
          <div className="rounded-md border bg-white p-3" key={item.id}>
            <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
              <div>
                <p className="font-semibold">{item.title}</p>
                <p className="mt-1 text-sm text-muted-foreground">{item.brand} x {item.creator}</p>
                <p className="mt-2 text-sm leading-6">{item.summary}</p>
              </div>
              <div className="flex shrink-0 gap-2">
                <Badge tone={item.risk === "high_risk" ? "red" : "amber"}>{item.risk}</Badge>
                <Link href={`/deals/${item.dealId}`}><Button size="sm" variant="secondary">Open deal <ArrowRight className="h-4 w-4" /></Button></Link>
              </div>
            </div>
            {item.flags.length ? (
              <div className="mt-3 grid gap-2 md:grid-cols-2">
                {item.flags.slice(0, 4).map((flag) => (
                  <div className="rounded-md bg-muted p-3" key={String(flag.id)}>
                    <p className="text-xs font-semibold uppercase text-muted-foreground">{text(flag.flag_type, "contract flag")}</p>
                    <p className="mt-1 text-sm leading-5">{text(flag.recommendation, "Review this term before moving forward.")}</p>
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        ))}
        {!items.length ? <EmptyState copy="No risky contracts need admin review." /> : null}
      </div>
    </Card>
  );
}

function FundingQueue({ items }: { items: Awaited<ReturnType<typeof getOpsQueues>>["acceptedUnfunded"] }) {
  return (
    <Card>
      <CardHeader><CardTitle>Accepted But Unfunded</CardTitle><Badge tone={items.length ? "amber" : "green"}>{items.length} items</Badge></CardHeader>
      <div className="overflow-x-auto">
        <Table>
          <thead><tr><Th>Work</Th><Th>Talent</Th><Th>Brand</Th><Th>Status</Th><Th className="text-right">Amount</Th><Th></Th></tr></thead>
          <tbody>
            {items.map((item) => (
              <tr key={`${item.type}-${item.id}`}>
                <Td className="font-medium">{item.title}</Td>
                <Td>{item.talent}</Td>
                <Td>{item.brand}</Td>
                <Td><PaymentStatusBadge status={item.status} /></Td>
                <Td className="text-right font-semibold">{formatCurrency(item.amount, item.currency)}</Td>
                <Td><PaymentActions canFund entityId={item.id} entityType={item.type} /></Td>
              </tr>
            ))}
            {!items.length ? <tr><Td colSpan={6}><EmptyState copy="No accepted work is waiting for funding." /></Td></tr> : null}
          </tbody>
        </Table>
      </div>
    </Card>
  );
}

function DeliveryReviewQueue({ items }: { items: Awaited<ReturnType<typeof getOpsQueues>>["submittedDeliverables"] }) {
  return (
    <Card>
      <CardHeader><CardTitle>Deliverables Awaiting Review</CardTitle><Badge tone={items.length ? "amber" : "green"}>{items.length} items</Badge></CardHeader>
      <div className="grid gap-3 md:grid-cols-2">
        {items.map((item) => (
          <div className="rounded-md border bg-white p-3" key={item.deliverable.id}>
            <p className="mb-2 text-sm font-semibold">{item.workTitle}</p>
            <p className="mb-3 text-xs text-muted-foreground">{item.brand} reviewing {item.talent}</p>
            <DeliverableCard deliverable={item.deliverable} canReview />
          </div>
        ))}
        {!items.length ? <EmptyState copy="No submitted deliverables need review." /> : null}
      </div>
    </Card>
  );
}

function ReleaseQueue({ items }: { items: Awaited<ReturnType<typeof getOpsQueues>>["releaseReady"] }) {
  return (
    <Card>
      <CardHeader><CardTitle>Payment Release Ready</CardTitle><Badge tone={items.length ? "green" : "blue"}>{items.length} payouts</Badge></CardHeader>
      <div className="overflow-x-auto">
        <Table>
          <thead><tr><Th>Payout</Th><Th>Talent</Th><Th>Brand</Th><Th>Status</Th><Th className="text-right">Talent payout</Th><Th></Th></tr></thead>
          <tbody>
            {items.map((item) => (
              <tr key={`${item.type}-${item.id}`}>
                <Td className="font-medium">{item.title}</Td>
                <Td>{item.talent}</Td>
                <Td>{item.brand}</Td>
                <Td><PaymentStatusBadge status={item.status} /></Td>
                <Td className="text-right font-semibold">{formatCurrency(item.amount, item.currency)}</Td>
                <Td><PaymentActions canFund={false} canRelease entityId={item.id} entityType={item.type} /></Td>
              </tr>
            ))}
            {!items.length ? <tr><Td colSpan={6}><EmptyState copy="No payouts are release-ready." /></Td></tr> : null}
          </tbody>
        </Table>
      </div>
    </Card>
  );
}

function StalledOfferQueue({ items }: { items: Awaited<ReturnType<typeof getOpsQueues>>["stalledOffers"] }) {
  return (
    <Card>
      <CardHeader><CardTitle>Stalled Offers</CardTitle><Badge tone={items.length ? "amber" : "green"}>{items.length} stalled</Badge></CardHeader>
      <div className="grid gap-3">
        {items.map((item) => (
          <div className="flex flex-col gap-3 rounded-md border bg-white p-3 md:flex-row md:items-center md:justify-between" key={item.id}>
            <div>
              <p className="font-semibold">{item.title}</p>
              <p className="mt-1 text-sm text-muted-foreground">{item.type} - {item.brand} x {item.talent} - {item.age} days old</p>
            </div>
            <Link href={item.href}><Button size="sm" variant="secondary">Review <ArrowRight className="h-4 w-4" /></Button></Link>
          </div>
        ))}
        {!items.length ? <EmptyState copy="No pending offers have crossed the follow-up threshold." /> : null}
      </div>
    </Card>
  );
}

function VerificationQueue({ items }: { items: Awaited<ReturnType<typeof getOpsQueues>>["verificationQueue"] }) {
  return (
    <Card>
      <CardHeader><CardTitle>Verification Review</CardTitle><Badge tone={items.length ? "amber" : "green"}>{items.length} profiles</Badge></CardHeader>
      <div className="overflow-x-auto">
        <Table>
          <thead><tr><Th>Profile</Th><Th>Type</Th><Th>Trust tier</Th><Th>Signals</Th><Th>Action</Th></tr></thead>
          <tbody>
            {items.map((item) => (
              <tr key={`${item.type}-${item.id}`}>
                <Td className="font-medium">{item.name}</Td>
                <Td>{item.type}</Td>
                <Td><VerificationBadge status={item.status} tier={item.tier} /></Td>
                <Td>{item.signals}</Td>
                <Td><VerificationActions entityId={item.id} entityType={item.type} initialChecks={item.checks} /></Td>
              </tr>
            ))}
            {!items.length ? <tr><Td colSpan={5}><EmptyState copy="No profiles need verification review." /></Td></tr> : null}
          </tbody>
        </Table>
      </div>
    </Card>
  );
}

function AutomationAudit({ events }: { events: Awaited<ReturnType<typeof getOpsQueues>>["automationEvents"] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Automation Audit</CardTitle>
        <Badge tone={events.length ? "blue" : "green"}>{events.length} recent</Badge>
      </CardHeader>
      <div className="grid gap-3">
        {events.map((event) => {
          const changes = Array.isArray(event.metadata.changes) ? event.metadata.changes : [];
          return (
            <div className="rounded-md border bg-card p-3 dark:border-white/8" key={event.id}>
              <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <History className="h-4 w-4 text-primary" />
                    <p className="font-semibold">{event.entityType} automation</p>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">{event.createdAt ? new Date(event.createdAt).toLocaleString("en-IN") : "recent"} - {event.entityId}</p>
                </div>
                <Badge tone="blue">{changes.length || 1} update{changes.length === 1 ? "" : "s"}</Badge>
              </div>
              <div className="mt-3 grid gap-2 md:grid-cols-2">
                {changes.length ? changes.slice(0, 4).map((change, index) => (
                  <p className="rounded-md bg-muted p-2 text-xs leading-5 text-muted-foreground" key={index}>
                    {String(change)}
                  </p>
                )) : (
                  <p className="rounded-md bg-muted p-2 text-xs leading-5 text-muted-foreground">
                    Workflow automation applied a safe state transition.
                  </p>
                )}
              </div>
            </div>
          );
        })}
        {!events.length ? <EmptyState copy="No automation events have been recorded yet." /> : null}
      </div>
    </Card>
  );
}

function OpsMetric({ icon, label, tone, value }: { icon: React.ReactNode; label: string; tone: "blue" | "green" | "amber" | "red"; value: number }) {
  return (
    <Card className="p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">{label}</p>
        <span className="text-primary">{icon}</span>
      </div>
      <div className="mt-3 flex items-center justify-between gap-3">
        <p className="text-2xl font-bold tracking-normal">{value}</p>
        <Badge tone={tone}>{tone === "red" ? "urgent" : tone === "amber" ? "review" : "clear"}</Badge>
      </div>
    </Card>
  );
}

function RuleCard({ copy, title }: { copy: string; title: string }) {
  return (
    <Card className="p-4">
      <div className="flex items-start gap-3">
        <div className="mt-1 rounded-md bg-primary/10 p-2 text-primary"><Clock3 className="h-4 w-4" /></div>
        <div>
          <p className="font-semibold">{title}</p>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">{copy}</p>
        </div>
      </div>
    </Card>
  );
}

function EmptyState({ copy }: { copy: string }) {
  return <p className="rounded-md border bg-muted p-3 text-sm text-muted-foreground">{copy}</p>;
}

function rows(data: unknown): Row[] {
  return Array.isArray(data) ? data.filter((item): item is Row => Boolean(item) && typeof item === "object" && !Array.isArray(item)) : [];
}

function text(value: unknown, fallback: string) {
  return typeof value === "string" && value.trim() ? value : fallback;
}

function number(value: unknown) {
  return typeof value === "number" ? value : Number(value ?? 0);
}

function ageDays(value: unknown) {
  if (typeof value !== "string" || !value) return 0;
  const created = new Date(value).getTime();
  return Number.isFinite(created) ? Math.floor((Date.now() - created) / (24 * 60 * 60 * 1000)) : 0;
}

function isPendingOffer(row: Row) {
  return !["accepted", "declined"].includes(String(row.offer_status ?? ""));
}

function isPendingProject(row: Row) {
  return !["accepted", "declined"].includes(String(row.status ?? ""));
}

function needsVerification(row: Row) {
  return String(row.verification_tier ?? "unverified") !== "performance" && String(row.verification_status ?? "unverified") !== "verified";
}

function asRecord(value: unknown) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}
