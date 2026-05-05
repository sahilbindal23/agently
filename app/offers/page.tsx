import { redirect } from "next/navigation";
import { RiskBadge } from "@/components/contracts/risk-badge";
import { DeliverableCard } from "@/components/deliverables/deliverable-card";
import { DeliverableSubmitForm } from "@/components/deliverables/deliverable-submit-form";
import { OfferResponseActions } from "@/components/offers/offer-response-actions";
import { OpenDisputeButton } from "@/components/disputes/open-dispute-button";
import { AppShell } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/layout/page-header";
import { MessageRecipientButton } from "@/components/messages/message-recipient-button";
import { DealProtectionTimeline } from "@/components/protection/deal-protection-timeline";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { formatCurrency } from "@/lib/utils/format";
import type { ContractFlag, Deliverable, RiskLevel } from "@/types";

type OfferRow = {
  id: string;
  brand_id?: string;
  title: string;
  deliverables: string;
  amount_cents: number;
  currency: string;
  stage: string;
  payment_status: string;
  offer_status?: string;
  due_date?: string;
  notes?: string;
  talent_response?: string | null;
  counter_status?: string | null;
  counter_amount_cents?: number | null;
  counter_deliverables?: string | null;
  counter_due_date?: string | null;
  counter_usage_rights?: string | null;
  counter_approval_terms?: string | null;
  counter_reason?: string | null;
  dispute_status?: string | null;
};

type ContractRow = {
  id: string;
  deal_id: string;
  risk_level: RiskLevel;
  summary: string;
  created_at?: string;
};

type ProjectRow = {
  id: string;
  brand_id?: string;
  title: string;
  scope: string;
  amount_cents: number;
  currency: string;
  status: string;
  payment_status: string;
  due_date?: string;
  usage_context?: string;
  approval_terms?: string;
  notes?: string;
  talent_response?: string | null;
  counter_status?: string | null;
  counter_amount_cents?: number | null;
  counter_scope?: string | null;
  counter_due_date?: string | null;
  counter_usage_rights?: string | null;
  counter_approval_terms?: string | null;
  counter_reason?: string | null;
  dispute_status?: string | null;
};

export default async function OffersPage() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect("/login");

  const admin = createAdminClient();
  if (!admin) redirect("/dashboard");

  const { data: creator } = await admin.from("creators").select("*").eq("profile_id", data.user.id).maybeSingle();
  const { data: freelancer } = await admin.from("freelancers").select("*").eq("profile_id", data.user.id).maybeSingle();
  const { data: profile } = await admin.from("profiles").select("role").eq("id", data.user.id).single();
  const isAdmin = profile?.role === "admin";

  const { data: deals } = creator?.id || isAdmin
    ? await admin
      .from("deals")
      .select("*")
      .match(isAdmin ? {} : { creator_id: creator.id })
      .order("created_at", { ascending: false })
    : { data: [] };

  const offers = (deals ?? []) as OfferRow[];
  const offerContracts = await getLatestContractsForDeals(admin, offers.map((offer) => offer.id));
  const { data: projects } = freelancer?.id || isAdmin
    ? await admin
      .from("freelancer_projects")
      .select("*")
      .match(isAdmin ? {} : { freelancer_id: freelancer.id })
      .order("created_at", { ascending: false })
    : { data: [] };
  const freelancerProjects = (projects ?? []) as ProjectRow[];
  const latestDeliverables = await getLatestDeliverables(admin, [
    ...offers.map((offer) => ({ type: "deal" as const, id: offer.id })),
    ...freelancerProjects.map((project) => ({ type: "freelancer_project" as const, id: project.id }))
  ]);
  const hasItems = offers.length || freelancerProjects.length;

  return (
    <AppShell>
      <PageHeader
        eyebrow="Talent offer inbox"
        title="Offers"
        description="Review brand-submitted offers, respond with acceptance or changes, and use negotiation tools before work begins."
      />

      {hasItems ? (
        <section className="grid gap-5 xl:grid-cols-2">
          {offers.map((offer) => (
            <Card key={offer.id}>
              <CardHeader>
                <div>
                  <CardTitle>{offer.title}</CardTitle>
                  <p className="mt-1 text-sm text-muted-foreground">Due {offer.due_date || "not set"}</p>
                </div>
                <Badge tone={offer.offer_status === "accepted" ? "green" : offer.offer_status === "declined" ? "red" : offer.offer_status === "changes_requested" ? "amber" : "blue"}>
                  {offer.offer_status ?? "submitted"}
                </Badge>
              </CardHeader>
              <div className="space-y-3">
                <div className="grid gap-3 sm:grid-cols-3">
                  <Metric label="Amount" value={formatCurrency(offer.amount_cents, offer.currency ?? "inr")} />
                  <Metric label="Stage" value={offer.stage} />
                  <Metric label="Payment" value={offer.payment_status} />
                </div>
                <OfferDecisionPanel
                  accepted={offer.offer_status === "accepted"}
                  hasContract={offerContracts.has(offer.id)}
                  paymentStatus={offer.payment_status}
                  responded={Boolean(offer.talent_response) || ["accepted", "declined", "changes_requested"].includes(String(offer.offer_status))}
                  status={offer.offer_status ?? "submitted"}
                />
                <div className="rounded-md border bg-white p-3 dark:border-white/8 dark:bg-card">
                  <p className="text-xs font-semibold uppercase text-muted-foreground">Deliverables</p>
                  <p className="mt-1 text-sm leading-6">{offer.deliverables}</p>
                </div>
                <OfferContractNotice contract={offerContracts.get(offer.id)} />
                {offer.notes ? (
                  <div className="rounded-md border bg-white p-3 dark:border-white/8 dark:bg-card">
                    <p className="text-xs font-semibold uppercase text-muted-foreground">Terms and notes</p>
                    <p className="mt-1 whitespace-pre-wrap text-sm leading-6">{offer.notes}</p>
                  </div>
                ) : null}
                <div className="flex flex-wrap gap-2">
                  <a href={`#counter-${offer.id}`}>
                    <Button variant="secondary" type="button">Open structured counter</Button>
                  </a>
                  {offer.brand_id ? (
                    <MessageRecipientButton contextId={offer.id} contextType="deal" entityId={offer.brand_id} entityType="brand" label="Ask brand a question" />
                  ) : null}
                </div>
                <DealProtectionTimeline
                  accepted={offer.offer_status === "accepted"}
                  contractRisk={offerContracts.get(offer.id)?.risk_level}
                  deliverableStatus={latestDeliverables.get(`deal-${offer.id}`)?.status}
                  hasContract={offerContracts.has(offer.id)}
                  hasDeliverable={latestDeliverables.has(`deal-${offer.id}`)}
                  paymentStatus={offer.payment_status}
                  title="Protected creator deal flow"
                  variant="inline"
                />
                {offer.talent_response ? (
                  <div className="rounded-md bg-muted p-3">
                    <p className="text-xs font-semibold uppercase text-muted-foreground">Your response</p>
                    <p className="mt-1 text-sm leading-6">{offer.talent_response}</p>
                  </div>
                ) : null}
                {offer.counter_status && offer.counter_status !== "none" ? (
                  <CounterStatusCard
                    amountCents={offer.counter_amount_cents}
                    approvalTerms={offer.counter_approval_terms}
                    dueDate={offer.counter_due_date}
                    reason={offer.counter_reason}
                    scope={offer.counter_deliverables}
                    status={offer.counter_status}
                    usageRights={offer.counter_usage_rights}
                  />
                ) : null}
                {offer.offer_status === "accepted" ? (
                  <div className="space-y-3">
                    <DeliverableCard deliverable={latestDeliverables.get(`deal-${offer.id}`)} />
                    {["funded", "release_ready", "released"].includes(offer.payment_status) ? (
                      <DeliverableSubmitForm entityId={offer.id} entityType="deal" />
                    ) : (
                      <FundingHoldNotice />
                    )}
                    <OpenDisputeButton dealId={offer.id} disputeStatus={offer.dispute_status ?? undefined} />
                  </div>
                ) : offer.offer_status === "declined" ? null : (
                  <OfferResponseActions
                    dealId={offer.id}
                    hasHighRiskContract={offerContracts.get(offer.id)?.risk_level === "high_risk"}
                    initialAmountCents={offer.counter_amount_cents ?? offer.amount_cents}
                    initialApprovalTerms={offer.counter_approval_terms ?? termsFromNotes(offer.notes, "approval")}
                    initialDueDate={offer.counter_due_date ?? offer.due_date ?? ""}
                    initialScope={offer.counter_deliverables ?? offer.deliverables}
                    initialUsageRights={offer.counter_usage_rights ?? termsFromNotes(offer.notes, "usage")}
                  />
                )}
              </div>
            </Card>
          ))}
          {freelancerProjects.map((project) => (
            <Card key={project.id}>
              <CardHeader>
                <div>
                  <CardTitle>{project.title}</CardTitle>
                  <p className="mt-1 text-sm text-muted-foreground">Due {project.due_date || "not set"}</p>
                </div>
                <Badge tone={project.status === "accepted" ? "green" : project.status === "declined" ? "red" : project.status === "changes_requested" ? "amber" : "blue"}>
                  {project.status}
                </Badge>
              </CardHeader>
              <div className="space-y-3">
                <div className="grid gap-3 sm:grid-cols-3">
                  <Metric label="Amount" value={formatCurrency(project.amount_cents, project.currency ?? "inr")} />
                  <Metric label="Type" value="Freelancer project" />
                  <Metric label="Payment" value={project.payment_status} />
                </div>
                <OfferDecisionPanel
                  accepted={project.status === "accepted"}
                  hasContract={Boolean(project.usage_context || project.approval_terms)}
                  paymentStatus={project.payment_status}
                  responded={Boolean(project.talent_response) || ["accepted", "declined", "changes_requested"].includes(String(project.status))}
                  status={project.status}
                  type="project"
                />
                <div className="rounded-md border bg-white p-3 dark:border-white/8 dark:bg-card">
                  <p className="text-xs font-semibold uppercase text-muted-foreground">Scope</p>
                  <p className="mt-1 text-sm leading-6">{project.scope}</p>
                </div>
                <div className="rounded-md border bg-white p-3 dark:border-white/8 dark:bg-card">
                  <p className="text-xs font-semibold uppercase text-muted-foreground">Terms</p>
                  <p className="mt-1 whitespace-pre-wrap text-sm leading-6">{[project.usage_context, project.approval_terms, project.notes].filter(Boolean).join("\n") || "No extra terms added."}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <a href={`#counter-${project.id}`}>
                    <Button variant="secondary" type="button">Open structured counter</Button>
                  </a>
                  {project.brand_id ? (
                    <MessageRecipientButton contextId={project.id} contextType="freelancer_project" entityId={project.brand_id} entityType="brand" label="Ask brand a question" />
                  ) : null}
                </div>
                <DealProtectionTimeline
                  accepted={project.status === "accepted"}
                  deliverableStatus={latestDeliverables.get(`freelancer_project-${project.id}`)?.status}
                  hasContract={Boolean(project.usage_context || project.approval_terms)}
                  hasDeliverable={latestDeliverables.has(`freelancer_project-${project.id}`)}
                  paymentStatus={project.payment_status}
                  title="Protected freelancer project flow"
                  variant="inline"
                />
                {project.talent_response ? (
                  <div className="rounded-md bg-muted p-3">
                    <p className="text-xs font-semibold uppercase text-muted-foreground">Your response</p>
                    <p className="mt-1 text-sm leading-6">{project.talent_response}</p>
                  </div>
                ) : null}
                {project.counter_status && project.counter_status !== "none" ? (
                  <CounterStatusCard
                    amountCents={project.counter_amount_cents}
                    approvalTerms={project.counter_approval_terms}
                    dueDate={project.counter_due_date}
                    reason={project.counter_reason}
                    scope={project.counter_scope}
                    status={project.counter_status}
                    usageRights={project.counter_usage_rights}
                  />
                ) : null}
                {project.status === "accepted" ? (
                  <div className="space-y-3">
                    <DeliverableCard deliverable={latestDeliverables.get(`freelancer_project-${project.id}`)} />
                    {["funded", "release_ready", "released"].includes(project.payment_status) ? (
                      <DeliverableSubmitForm entityId={project.id} entityType="freelancer_project" />
                    ) : (
                      <FundingHoldNotice />
                    )}
                    <OpenDisputeButton projectId={project.id} disputeStatus={project.dispute_status ?? undefined} />
                  </div>
                ) : project.status === "declined" ? null : (
                  <OfferResponseActions
                    initialAmountCents={project.counter_amount_cents ?? project.amount_cents}
                    initialApprovalTerms={project.counter_approval_terms ?? project.approval_terms ?? ""}
                    initialDueDate={project.counter_due_date ?? project.due_date ?? ""}
                    initialScope={project.counter_scope ?? project.scope}
                    initialUsageRights={project.counter_usage_rights ?? project.usage_context ?? ""}
                    kind="project"
                    projectId={project.id}
                  />
                )}
              </div>
            </Card>
          ))}
        </section>
      ) : (
        <Card>
          <p className="font-semibold">No offers yet</p>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">When a brand sends an offer from a campaign recommendation, it will appear here.</p>
        </Card>
      )}
    </AppShell>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border bg-white p-3 dark:border-white/8 dark:bg-card">
      <p className="text-xs font-semibold uppercase text-muted-foreground">{label}</p>
      <p className="mt-1 text-sm font-semibold">{value}</p>
    </div>
  );
}

function FundingHoldNotice() {
  return (
    <div className="rounded-md border border-amber-200 bg-amber-50 p-3 dark:border-amber-900/50 dark:bg-amber-950/30">
      <p className="text-sm font-semibold text-amber-950 dark:text-amber-200">Wait for funding before final delivery</p>
      <p className="mt-1 text-sm leading-6 text-amber-800 dark:text-amber-300">
        This offer is accepted, but the protected payment workflow is not funded yet. Use messages for clarification, but do not submit final work until funding is marked protected.
      </p>
    </div>
  );
}

function CounterStatusCard({
  amountCents,
  approvalTerms,
  dueDate,
  reason,
  scope,
  status,
  usageRights
}: {
  amountCents?: number | null;
  approvalTerms?: string | null;
  dueDate?: string | null;
  reason?: string | null;
  scope?: string | null;
  status: string;
  usageRights?: string | null;
}) {
  return (
    <div className="rounded-md border bg-blue-50/60 p-3 dark:border-sky-900/50 dark:bg-sky-950/30">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-semibold uppercase text-blue-800 dark:text-sky-300">Structured counter</p>
        <Badge tone={status === "accepted" ? "green" : status === "declined" ? "red" : "amber"}>{status.replaceAll("_", " ")}</Badge>
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        <MiniTerm label="Amount" value={amountCents ? formatCurrency(amountCents, "inr") : "No amount change"} />
        <MiniTerm label="Due date" value={dueDate || "No date change"} />
        <MiniTerm label="Scope" value={scope || "No scope change"} wide />
        <MiniTerm label="Usage" value={usageRights || "No usage change"} />
        <MiniTerm label="Approval" value={approvalTerms || "No approval change"} />
        <MiniTerm label="Reason" value={reason || "No reason added"} wide />
      </div>
    </div>
  );
}

function MiniTerm({ label, value, wide = false }: { label: string; value: string; wide?: boolean }) {
  return (
    <div className={`rounded-md border bg-white px-3 py-2 dark:border-white/8 dark:bg-card ${wide ? "sm:col-span-2" : ""}`}>
      <p className="text-[11px] font-semibold uppercase text-muted-foreground">{label}</p>
      <p className="mt-1 text-sm leading-5">{value}</p>
    </div>
  );
}

function OfferDecisionPanel({
  accepted,
  hasContract,
  paymentStatus,
  responded,
  status,
  type = "offer"
}: {
  accepted: boolean;
  hasContract: boolean;
  paymentStatus: string;
  responded: boolean;
  status: string;
  type?: "offer" | "project";
}) {
  const nextAction = getNextAction({ accepted, hasContract, paymentStatus, responded, status, type });
  const checks = [
    { label: type === "offer" ? "Scope is captured" : "Project scope is captured", done: true },
    { label: hasContract ? "Terms are attached" : "Terms need review", done: hasContract },
    { label: responded ? responseLabel(status) : "Talent response pending", done: responded },
    { label: ["funded", "release_ready", "released"].includes(paymentStatus) ? "Payment protected" : "Funding pending", done: ["funded", "release_ready", "released"].includes(paymentStatus) }
  ];

  return (
    <div className="rounded-md border bg-emerald-50/60 p-3 dark:border-emerald-900/50 dark:bg-emerald-950/30">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase text-emerald-800 dark:text-emerald-300">Next best action</p>
          <p className="mt-1 text-sm font-semibold text-emerald-950 dark:text-emerald-100">{nextAction.title}</p>
          <p className="mt-1 text-sm leading-6 text-emerald-900 dark:text-emerald-200">{nextAction.copy}</p>
        </div>
        <Badge tone={nextAction.tone}>{nextAction.label}</Badge>
      </div>
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        {checks.map((check) => (
          <div className="flex items-center justify-between gap-3 rounded-md border bg-white px-3 py-2 text-sm dark:border-white/8 dark:bg-card" key={check.label}>
            <span>{check.label}</span>
            <Badge tone={check.done ? "green" : "amber"}>{check.done ? "ready" : "review"}</Badge>
          </div>
        ))}
      </div>
    </div>
  );
}

function getNextAction({
  accepted,
  hasContract,
  paymentStatus,
  responded,
  status,
  type
}: {
  accepted: boolean;
  hasContract: boolean;
  paymentStatus: string;
  responded: boolean;
  status: string;
  type: "offer" | "project";
}) {
  if (status === "declined") {
    return { title: "Offer closed", copy: "No delivery or payment actions are needed unless the brand sends a revised offer.", label: "closed", tone: "neutral" as const };
  }
  if (!responded) {
    return {
      title: "Review before accepting",
      copy: hasContract
        ? "Use negotiation support or message the brand before you commit to the scope."
        : "Ask for terms, usage, revisions, and payment timing before accepting.",
      label: "action needed",
      tone: "amber" as const
    };
  }
  if (!accepted) {
    return { title: "Waiting on revised terms", copy: "Keep the conversation tied to this offer so changes stay attached to the workflow.", label: "negotiating", tone: "blue" as const };
  }
  if (!["funded", "release_ready", "released"].includes(paymentStatus)) {
    return { title: "Wait for funding before delivery", copy: `The ${type} is accepted, but payment protection should be in place before final delivery.`, label: "funding", tone: "amber" as const };
  }
  if (paymentStatus === "released") {
    return { title: "Payment released", copy: "This workflow is complete. Keep final files and approvals attached for history.", label: "complete", tone: "green" as const };
  }
  return { title: "Submit deliverable when ready", copy: "Payment is protected. Upload the agreed deliverable URL for approval and release.", label: "ready", tone: "green" as const };
}

function responseLabel(status: string) {
  if (status === "accepted") return "Accepted";
  if (status === "declined") return "Declined";
  if (status === "changes_requested") return "Negotiating";
  return "Viewed";
}

function termsFromNotes(notes: string | undefined, keyword: "approval" | "usage") {
  if (!notes) return "";
  const lines = notes.split("\n").map((line) => line.trim()).filter(Boolean);
  const match = lines.find((line) => line.toLowerCase().includes(keyword));
  return match ?? "";
}

function OfferContractNotice({ contract }: { contract?: ContractRow & { flags: ContractFlag[] } }) {
  if (!contract) {
    return (
      <div className="rounded-md border border-amber-200 bg-amber-50 p-3 dark:border-amber-900/50 dark:bg-amber-950/30">
        <p className="text-xs font-semibold uppercase text-amber-700 dark:text-amber-300">Contract protection</p>
        <p className="mt-1 text-sm leading-6 text-amber-800 dark:text-amber-200">
          No contract scan is attached yet. Ask Agently/admin to review usage, exclusivity, whitelisting, revision, and payment terms before accepting.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-md border bg-white p-3 dark:border-white/8 dark:bg-card">
      <div className="mb-2 flex items-center justify-between gap-3">
        <p className="text-xs font-semibold uppercase text-muted-foreground">Contract protection</p>
        <RiskBadge risk={contract.risk_level} />
      </div>
      <p className="text-sm leading-6 text-muted-foreground">{contract.summary}</p>
      {contract.flags.slice(0, 2).map((flag) => (
        <p key={flag.id} className="mt-2 text-sm leading-5">
          <span className="font-semibold">{flag.flag_type.replaceAll("_", " ")}:</span> {flag.recommendation}
        </p>
      ))}
    </div>
  );
}

async function getLatestContractsForDeals(admin: NonNullable<ReturnType<typeof createAdminClient>>, dealIds: string[]) {
  const map = new Map<string, ContractRow & { flags: ContractFlag[] }>();
  if (dealIds.length === 0) return map;

  const { data: contracts } = await admin
    .from("contracts")
    .select("id, deal_id, risk_level, summary, created_at")
    .in("deal_id", dealIds)
    .order("created_at", { ascending: false });

  const rows = (contracts ?? []) as ContractRow[];
  const contractIds = rows.map((contract) => contract.id);
  const { data: flags } = contractIds.length
    ? await admin.from("contract_flags").select("*").in("contract_id", contractIds)
    : { data: [] };

  rows.forEach((contract) => {
    if (map.has(contract.deal_id)) return;
    map.set(contract.deal_id, {
      ...contract,
      flags: ((flags ?? []) as ContractFlag[]).filter((flag) => flag.contract_id === contract.id)
    });
  });

  return map;
}

async function getLatestDeliverables(
  admin: NonNullable<ReturnType<typeof createAdminClient>>,
  items: Array<{ type: "deal" | "freelancer_project"; id: string }>
) {
  const map = new Map<string, Deliverable>();
  const dealIds = items.filter((item) => item.type === "deal").map((item) => item.id);
  const projectIds = items.filter((item) => item.type === "freelancer_project").map((item) => item.id);

  const [dealDeliverables, projectDeliverables] = await Promise.all([
    dealIds.length
      ? admin.from("deliverables").select("*").in("deal_id", dealIds).order("created_at", { ascending: false })
      : { data: [] },
    projectIds.length
      ? admin.from("deliverables").select("*").in("freelancer_project_id", projectIds).order("created_at", { ascending: false })
      : { data: [] }
  ]);

  ([...(dealDeliverables.data ?? []), ...(projectDeliverables.data ?? [])] as Deliverable[]).forEach((deliverable) => {
    const key = deliverable.deal_id ? `deal-${deliverable.deal_id}` : `freelancer_project-${deliverable.freelancer_project_id}`;
    if (!map.has(key)) map.set(key, deliverable);
  });

  return map;
}
