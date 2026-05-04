import Link from "next/link";
import { Plus } from "lucide-react";
import { BrandOfferForm } from "@/components/deals/brand-offer-form";
import { AppShell } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/layout/page-header";
import { MessageRecipientButton } from "@/components/messages/message-recipient-button";
import { BrandCounterActions } from "@/components/offers/brand-counter-actions";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, Td, Th } from "@/components/ui/table";
import { getCurrentUser } from "@/lib/auth/session";
import { getAgentlyData } from "@/lib/db/live-data";
import { createAdminClient } from "@/lib/supabase/admin";
import { formatCurrency } from "@/lib/utils/format";

export const dynamic = "force-dynamic";

export default async function DealsPage() {
  const user = await getCurrentUser();
  const admin = createAdminClient();
  const { brands, creators, deals } = await getAgentlyData();
  const isBrand = user?.role === "brand";
  const brandIds = isBrand && admin && user ? await getBrandIdsForUser(admin, user.id, user.email) : [];
  const visibleDeals = isBrand ? deals.filter((deal) => brandIds.includes(deal.brand_id)) : deals;
  const freelancerProjects = admin ? await getVisibleFreelancerProjects(admin, isBrand ? brandIds : null) : [];
  const pendingDealCounters = visibleDeals.filter((deal) => deal.counter_status === "pending_brand_review");
  const pendingProjectCounters = freelancerProjects.filter((project) => String(project.counter_status ?? "") === "pending_brand_review");

  return (
    <AppShell>
      <PageHeader
        eyebrow="Deal pipeline"
        title={isBrand ? "Sent offers and projects" : "Brand deals under management"}
        description={isBrand ? "Track every creator offer and freelancer project your brand has sent from campaign recommendations." : "Brands submit inbound offers. Agently reviews terms, negotiates, controls funding, tracks deliverables, and releases payouts."}
        action={isBrand
          ? <Link className="inline-flex h-10 items-center gap-2 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground" href="/campaigns"><Plus className="h-4 w-4" /> Create campaign</Link>
          : <div className="inline-flex h-10 items-center gap-2 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground"><Plus className="h-4 w-4" /> Inbound offer</div>}
      />
      {isBrand && (pendingDealCounters.length || pendingProjectCounters.length) ? (
        <Card className="mb-5">
          <CardHeader>
            <div>
              <CardTitle>Counter Proposals Needing Review</CardTitle>
              <p className="mt-1 text-sm text-muted-foreground">Creators and freelancers requested structured changes. Accepting a counter updates the offer/project terms.</p>
            </div>
            <Badge tone="amber">{pendingDealCounters.length + pendingProjectCounters.length}</Badge>
          </CardHeader>
          <div className="grid gap-3 xl:grid-cols-2">
            {pendingDealCounters.map((deal) => (
              <CounterCard
                amountCents={deal.counter_amount_cents}
                dueDate={deal.counter_due_date}
                key={deal.id}
                kind="deal"
                messageLabel="Message creator"
                recipientId={deal.creator_id}
                recipientType="creator"
                reason={deal.counter_reason}
                scope={deal.counter_deliverables}
                targetId={deal.id}
                title={deal.title}
                usageRights={deal.counter_usage_rights}
                approvalTerms={deal.counter_approval_terms}
              />
            ))}
            {pendingProjectCounters.map((project) => (
              <CounterCard
                amountCents={Number(project.counter_amount_cents ?? 0) || null}
                dueDate={String(project.counter_due_date ?? "")}
                key={String(project.id)}
                kind="project"
                messageLabel="Message freelancer"
                recipientId={String(project.freelancer_id)}
                recipientType="freelancer"
                reason={String(project.counter_reason ?? "")}
                scope={String(project.counter_scope ?? "")}
                targetId={String(project.id)}
                title={String(project.title ?? "Freelancer project")}
                usageRights={String(project.counter_usage_rights ?? "")}
                approvalTerms={String(project.counter_approval_terms ?? "")}
              />
            ))}
          </div>
        </Card>
      ) : null}
      <Card>
        <CardHeader><CardTitle>{isBrand ? "Creator Offers Sent" : "Pipeline"}</CardTitle><Badge tone="blue">{visibleDeals.length} deals</Badge></CardHeader>
        <div className="overflow-x-auto">
          <Table>
            <thead><tr><Th>Deal</Th><Th>Creator</Th><Th>Brand</Th><Th>Offer</Th><Th>Stage</Th><Th>Due</Th><Th>Risk</Th><Th className="text-right">Amount</Th>{isBrand ? <Th>Conversation</Th> : null}</tr></thead>
            <tbody>
              {visibleDeals.map((deal) => (
                <tr key={deal.id}>
                  <Td><Link className="font-semibold text-primary" href={`/deals/${deal.id}`}>{deal.title}</Link></Td>
                  <Td>{creators.find((creator) => creator.id === deal.creator_id)?.display_name}</Td>
                  <Td>{brands.find((brand) => brand.id === deal.brand_id)?.name}</Td>
                  <Td><Badge tone={deal.offer_status === "accepted" ? "green" : deal.offer_status === "declined" ? "red" : deal.offer_status === "changes_requested" ? "amber" : "blue"}>{deal.offer_status ?? "submitted"}</Badge></Td>
                  <Td><Badge>{deal.stage}</Badge></Td>
                  <Td>{deal.due_date}</Td>
                  <Td><Badge tone={deal.risk_score > 30 ? "amber" : "green"}>{deal.risk_score}</Badge></Td>
                  <Td className="text-right font-bold">{formatCurrency(deal.amount_cents, deal.currency)}</Td>
                  {isBrand ? (
                    <Td>
                      <MessageRecipientButton contextId={deal.id} contextType="deal" entityId={deal.creator_id} entityType="creator" label="Message" />
                    </Td>
                  ) : null}
                </tr>
              ))}
              {visibleDeals.length === 0 ? (
                <tr>
                  <Td colSpan={isBrand ? 9 : 8} className="text-muted-foreground">No creator offers sent yet.</Td>
                </tr>
              ) : null}
            </tbody>
          </Table>
        </div>
      </Card>

      <Card className="mt-5">
        <CardHeader><CardTitle>Freelancer Projects Sent</CardTitle><Badge tone="green">{freelancerProjects.length}</Badge></CardHeader>
        <div className="overflow-x-auto">
          <Table>
            <thead><tr><Th>Project</Th><Th>Status</Th><Th>Payment</Th><Th>Due</Th><Th>Scope</Th><Th className="text-right">Amount</Th>{isBrand ? <Th>Conversation</Th> : null}</tr></thead>
            <tbody>
              {freelancerProjects.map((project) => (
                <tr key={String(project.id)}>
                  <Td className="font-semibold">{String(project.title ?? "Freelancer project")}</Td>
                  <Td><Badge tone={String(project.status) === "accepted" ? "green" : String(project.status) === "changes_requested" ? "amber" : "blue"}>{String(project.status ?? "submitted")}</Badge></Td>
                  <Td>{String(project.payment_status ?? "unpaid")}</Td>
                  <Td>{String(project.due_date ?? "not set")}</Td>
                  <Td className="max-w-md truncate">{String(project.scope ?? "")}</Td>
                  <Td className="text-right font-bold">{formatCurrency(Number(project.amount_cents ?? 0), String(project.currency ?? "inr"))}</Td>
                  {isBrand && project.freelancer_id ? (
                    <Td>
                      <MessageRecipientButton contextId={String(project.id)} contextType="freelancer_project" entityId={String(project.freelancer_id)} entityType="freelancer" label="Message" />
                    </Td>
                  ) : isBrand ? <Td /> : null}
                </tr>
              ))}
              {freelancerProjects.length === 0 ? (
                <tr>
                  <Td colSpan={isBrand ? 7 : 6} className="text-muted-foreground">No freelancer projects sent yet.</Td>
                </tr>
              ) : null}
            </tbody>
          </Table>
        </div>
      </Card>

      {!isBrand ? <Card className="mt-5">
        <CardHeader>
          <div>
            <CardTitle>Brand Offer Intake</CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">This represents the brand portal flow: brand submits terms, then the agency controls review and negotiation.</p>
          </div>
          <Badge tone="green">writes to Supabase</Badge>
        </CardHeader>
        <BrandOfferForm creators={creators} />
      </Card> : null}
    </AppShell>
  );
}

function CounterCard({
  amountCents,
  approvalTerms,
  dueDate,
  kind,
  messageLabel,
  reason,
  recipientId,
  recipientType,
  scope,
  targetId,
  title,
  usageRights
}: {
  amountCents?: number | null;
  approvalTerms?: string | null;
  dueDate?: string | null;
  kind: "deal" | "project";
  messageLabel: string;
  reason?: string | null;
  recipientId: string;
  recipientType: "creator" | "freelancer";
  scope?: string | null;
  targetId: string;
  title: string;
  usageRights?: string | null;
}) {
  return (
    <div className="rounded-md border bg-white p-4">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-semibold">{title}</p>
          <p className="mt-1 text-xs text-muted-foreground">{kind === "deal" ? "Creator offer counter" : "Freelancer project counter"}</p>
        </div>
        <Badge tone="amber">counter</Badge>
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        <CounterField label="Counter amount" value={amountCents ? formatCurrency(amountCents, "inr") : "No amount change"} />
        <CounterField label="Requested date" value={dueDate || "No date change"} />
        <CounterField label={kind === "deal" ? "Revised deliverables" : "Revised scope"} value={scope || "No scope change"} wide />
        <CounterField label="Usage rights" value={usageRights || "No usage change"} />
        <CounterField label="Approval terms" value={approvalTerms || "No approval change"} />
        <CounterField label="Reason" value={reason || "No reason added"} wide />
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <BrandCounterActions id={targetId} kind={kind} />
        <MessageRecipientButton contextId={targetId} contextType={kind === "deal" ? "deal" : "freelancer_project"} entityId={recipientId} entityType={recipientType} label={messageLabel} />
      </div>
    </div>
  );
}

function CounterField({ label, value, wide = false }: { label: string; value: string; wide?: boolean }) {
  return (
    <div className={`rounded-md bg-muted p-3 ${wide ? "sm:col-span-2" : ""}`}>
      <p className="text-xs font-semibold uppercase text-muted-foreground">{label}</p>
      <p className="mt-1 text-sm leading-5">{value}</p>
    </div>
  );
}

async function getBrandIdsForUser(admin: NonNullable<ReturnType<typeof createAdminClient>>, profileId: string, email: string) {
  const [{ data: audits }, { data: directBrands }] = await Promise.all([
    admin.from("brand_audits").select("brand_id").eq("profile_id", profileId),
    admin.from("brands").select("id").eq("contact_email", email)
  ]);

  return Array.from(new Set([
    ...((audits ?? []).map((audit) => String(audit.brand_id)).filter(Boolean)),
    ...((directBrands ?? []).map((brand) => String(brand.id)).filter(Boolean))
  ]));
}

async function getVisibleFreelancerProjects(admin: NonNullable<ReturnType<typeof createAdminClient>>, brandIds: string[] | null) {
  if (brandIds && brandIds.length === 0) return [];
  const query = admin.from("freelancer_projects").select("*").order("created_at", { ascending: false });
  const { data } = brandIds ? await query.in("brand_id", brandIds) : await query;
  return data ?? [];
}
