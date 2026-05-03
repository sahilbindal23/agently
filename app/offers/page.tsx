import Link from "next/link";
import { redirect } from "next/navigation";
import { RiskBadge } from "@/components/contracts/risk-badge";
import { DeliverableCard } from "@/components/deliverables/deliverable-card";
import { DeliverableSubmitForm } from "@/components/deliverables/deliverable-submit-form";
import { OfferResponseActions } from "@/components/offers/offer-response-actions";
import { AppShell } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/layout/page-header";
import { MessageRecipientButton } from "@/components/messages/message-recipient-button";
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
  const brandIds = Array.from(new Set([
    ...offers.map((offer) => offer.brand_id).filter((id): id is string => Boolean(id)),
    ...freelancerProjects.map((project) => project.brand_id).filter((id): id is string => Boolean(id))
  ]));
  const brandNames = await getBrandNames(admin, brandIds);
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
                <div className="rounded-md border bg-white p-3">
                  <p className="text-xs font-semibold uppercase text-muted-foreground">Deliverables</p>
                  <p className="mt-1 text-sm leading-6">{offer.deliverables}</p>
                </div>
                <OfferContractNotice contract={offerContracts.get(offer.id)} />
                {offer.notes ? (
                  <div className="rounded-md border bg-white p-3">
                    <p className="text-xs font-semibold uppercase text-muted-foreground">Terms and notes</p>
                    <p className="mt-1 whitespace-pre-wrap text-sm leading-6">{offer.notes}</p>
                  </div>
                ) : null}
                <div className="flex flex-wrap gap-2">
                  <Link href={negotiationHref({
                    amountCents: offer.amount_cents,
                    brand: brandNames.get(offer.brand_id ?? "") ?? "",
                    deliverables: offer.deliverables,
                    terms: [offer.notes, offerContracts.get(offer.id)?.summary].filter(Boolean).join("\n"),
                    context: "Creator offer opened from Agently offer inbox."
                  })}>
                    <Button variant="secondary">Negotiate this offer</Button>
                  </Link>
                  {offer.brand_id ? (
                    <MessageRecipientButton contextId={offer.id} contextType="deal" entityId={offer.brand_id} entityType="brand" label="Message about offer" />
                  ) : null}
                </div>
                <OfferTimeline
                  accepted={offer.offer_status === "accepted"}
                  funded={["funded", "release_ready", "released"].includes(offer.payment_status)}
                  paymentStatus={offer.payment_status}
                  responded={Boolean(offer.talent_response) || ["accepted", "declined", "changes_requested"].includes(String(offer.offer_status))}
                  status={offer.offer_status ?? "submitted"}
                />
                {offer.talent_response ? (
                  <div className="rounded-md bg-muted p-3">
                    <p className="text-xs font-semibold uppercase text-muted-foreground">Your response</p>
                    <p className="mt-1 text-sm leading-6">{offer.talent_response}</p>
                  </div>
                ) : null}
                {offer.offer_status === "accepted" ? (
                  <div className="space-y-3">
                    <DeliverableCard deliverable={latestDeliverables.get(`deal-${offer.id}`)} />
                    <DeliverableSubmitForm entityId={offer.id} entityType="deal" />
                  </div>
                ) : offer.offer_status === "declined" ? null : <OfferResponseActions dealId={offer.id} />}
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
                <div className="rounded-md border bg-white p-3">
                  <p className="text-xs font-semibold uppercase text-muted-foreground">Scope</p>
                  <p className="mt-1 text-sm leading-6">{project.scope}</p>
                </div>
                <div className="rounded-md border bg-white p-3">
                  <p className="text-xs font-semibold uppercase text-muted-foreground">Terms</p>
                  <p className="mt-1 whitespace-pre-wrap text-sm leading-6">{[project.usage_context, project.approval_terms, project.notes].filter(Boolean).join("\n") || "No extra terms added."}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Link href={negotiationHref({
                    amountCents: project.amount_cents,
                    brand: brandNames.get(project.brand_id ?? "") ?? "",
                    deliverables: project.scope,
                    terms: [project.usage_context, project.approval_terms, project.notes].filter(Boolean).join("\n"),
                    context: "Freelancer project opened from Agently offer inbox."
                  })}>
                    <Button variant="secondary">Negotiate this project</Button>
                  </Link>
                  {project.brand_id ? (
                    <MessageRecipientButton contextId={project.id} contextType="freelancer_project" entityId={project.brand_id} entityType="brand" label="Message about project" />
                  ) : null}
                </div>
                <OfferTimeline
                  accepted={project.status === "accepted"}
                  funded={["funded", "release_ready", "released"].includes(project.payment_status)}
                  paymentStatus={project.payment_status}
                  responded={Boolean(project.talent_response) || ["accepted", "declined", "changes_requested"].includes(String(project.status))}
                  status={project.status}
                />
                {project.talent_response ? (
                  <div className="rounded-md bg-muted p-3">
                    <p className="text-xs font-semibold uppercase text-muted-foreground">Your response</p>
                    <p className="mt-1 text-sm leading-6">{project.talent_response}</p>
                  </div>
                ) : null}
                {project.status === "accepted" ? (
                  <div className="space-y-3">
                    <DeliverableCard deliverable={latestDeliverables.get(`freelancer_project-${project.id}`)} />
                    <DeliverableSubmitForm entityId={project.id} entityType="freelancer_project" />
                  </div>
                ) : project.status === "declined" ? null : <OfferResponseActions kind="project" projectId={project.id} />}
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

async function getBrandNames(admin: NonNullable<ReturnType<typeof createAdminClient>>, brandIds: string[]) {
  const map = new Map<string, string>();
  if (!brandIds.length) return map;
  const { data } = await admin.from("brands").select("id, name").in("id", brandIds);
  (data ?? []).forEach((brand) => map.set(String(brand.id), String(brand.name ?? "")));
  return map;
}

function negotiationHref({
  amountCents,
  brand,
  deliverables,
  terms,
  context
}: {
  amountCents: number;
  brand: string;
  deliverables: string;
  terms: string;
  context: string;
}) {
  const params = new URLSearchParams({
    amount: String(Math.round(amountCents / 100)),
    brand,
    deliverables,
    terms,
    context
  });
  return `/ai-insights?${params.toString()}#negotiation`;
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border bg-white p-3">
      <p className="text-xs font-semibold uppercase text-muted-foreground">{label}</p>
      <p className="mt-1 text-sm font-semibold">{value}</p>
    </div>
  );
}

function OfferTimeline({
  accepted,
  funded,
  paymentStatus,
  responded,
  status
}: {
  accepted: boolean;
  funded: boolean;
  paymentStatus: string;
  responded: boolean;
  status: string;
}) {
  const steps = [
    { label: "Sent", done: true },
    { label: responded ? responseLabel(status) : "Needs response", done: responded },
    { label: "Accepted", done: accepted },
    { label: paymentStatus === "released" ? "Released" : funded ? "Funded" : "Payment pending", done: funded }
  ];

  return (
    <div className="rounded-md border bg-muted/50 p-3">
      <p className="text-xs font-semibold uppercase text-muted-foreground">Offer workflow</p>
      <div className="mt-3 grid gap-2 sm:grid-cols-4">
        {steps.map((step, index) => (
          <div className="flex items-center gap-2" key={step.label}>
            <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold ${step.done ? "bg-primary text-primary-foreground" : "bg-white text-muted-foreground"}`}>
              {index + 1}
            </span>
            <span className={`text-xs font-medium ${step.done ? "text-foreground" : "text-muted-foreground"}`}>{step.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function responseLabel(status: string) {
  if (status === "accepted") return "Accepted";
  if (status === "declined") return "Declined";
  if (status === "changes_requested") return "Negotiating";
  return "Viewed";
}

function OfferContractNotice({ contract }: { contract?: ContractRow & { flags: ContractFlag[] } }) {
  if (!contract) {
    return (
      <div className="rounded-md border bg-amber-50 p-3">
        <p className="text-xs font-semibold uppercase text-amber-700">Contract protection</p>
        <p className="mt-1 text-sm leading-6 text-amber-800">
          No contract scan is attached yet. Ask Agently/admin to review usage, exclusivity, whitelisting, revision, and payment terms before accepting.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-md border bg-white p-3">
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
