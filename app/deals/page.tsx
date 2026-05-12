import Link from "next/link";
import { Plus } from "lucide-react";
import { AgreementReview, type AgreementForReview } from "@/components/contracts/agreement-review";
import { BrandOfferForm } from "@/components/deals/brand-offer-form";
import { AppShell } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/layout/page-header";
import { MessageRecipientButton } from "@/components/messages/message-recipient-button";
import { BrandCounterActions } from "@/components/offers/brand-counter-actions";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, Td, Th } from "@/components/ui/table";
import { getCurrentUser } from "@/lib/auth/session";
import { canSeeDemoData } from "@/lib/db/demo-visibility";
import { getAgentlyData } from "@/lib/db/live-data";
import { createAdminClient } from "@/lib/supabase/admin";
import { formatCurrency } from "@/lib/utils/format";

export const dynamic = "force-dynamic";

export default async function DealsPage() {
  const user = await getCurrentUser();
  const admin = createAdminClient();
  const { brands, creators, deals } = await getAgentlyData({ includeDemo: canSeeDemoData(user) });
  const isBrand = user?.role === "brand";
  const brandIds = isBrand && admin && user ? await getBrandIdsForUser(admin, user.id, user.email) : [];
  const visibleDeals = isBrand ? deals.filter((deal) => brandIds.includes(deal.brand_id)) : deals;
  const freelancerProjects = admin ? await getVisibleFreelancerProjects(admin, isBrand ? brandIds : null) : [];
  const pendingDealCounters = visibleDeals.filter((deal) => deal.counter_status === "pending_brand_review");
  const pendingProjectCounters = freelancerProjects.filter((project) => String(project.counter_status ?? "") === "pending_brand_review");

  // Fetch active agreements for accepted-but-not-yet-signed deals/projects
  // so we can render brand-side signing inline on this page.
  const acceptedDealIds = visibleDeals.filter((d) => d.offer_status === "accepted").map((d) => d.id);
  const acceptedProjectIds = freelancerProjects.filter((p) => String(p.status ?? "") === "accepted").map((p) => String(p.id));
  const dealAgreements = isBrand && admin ? await getDealAgreements(admin, acceptedDealIds) : new Map();
  const projectAgreements = isBrand && admin ? await getProjectAgreements(admin, acceptedProjectIds) : new Map();

  // Workflow buckets for brand view
  const dealsAwaitingBrandSignature = isBrand
    ? visibleDeals.filter((d) => {
        const a = dealAgreements.get(d.id);
        return a && a.status === "pending_signatures" && !a.brand_signed_at;
      })
    : [];
  const projectsAwaitingBrandSignature = isBrand
    ? freelancerProjects.filter((p) => {
        const a = projectAgreements.get(String(p.id));
        return a && a.status === "pending_signatures" && !a.brand_signed_at;
      })
    : [];
  const dealsSentAwaitingResponse = isBrand
    ? visibleDeals.filter((d) => !d.offer_status || d.offer_status === "submitted")
    : [];
  const dealsInProgress = isBrand
    ? visibleDeals.filter((d) => {
        if (d.offer_status !== "accepted") return false;
        if (d.payment_status === "released") return false;
        // already counted above if awaiting brand signature
        const a = dealAgreements.get(d.id);
        if (a && a.status === "pending_signatures" && !a.brand_signed_at) return false;
        return true;
      })
    : [];
  const dealsCompleted = isBrand ? visibleDeals.filter((d) => d.payment_status === "released") : [];
  const dealsDeclined = isBrand ? visibleDeals.filter((d) => d.offer_status === "declined") : [];
  const projectsSentAwaitingResponse = isBrand
    ? freelancerProjects.filter((p) => !p.status || String(p.status) === "submitted")
    : [];
  const projectsDeclined = isBrand ? freelancerProjects.filter((p) => String(p.status) === "declined") : [];

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
      {/* ===== BRAND-SIDE WORKFLOW INBOX ===== */}
      {isBrand && (dealsAwaitingBrandSignature.length || projectsAwaitingBrandSignature.length) ? (
        <Card className="mb-5 border-amber-200 dark:border-amber-900/50">
          <CardHeader>
            <div>
              <CardTitle>Awaiting your signature</CardTitle>
              <p className="mt-1 text-sm text-muted-foreground">Sign the standard agreement to unlock funding. The talent has accepted; both signatures are needed before payment can fund.</p>
            </div>
            <Badge tone="amber">{dealsAwaitingBrandSignature.length + projectsAwaitingBrandSignature.length}</Badge>
          </CardHeader>
          <div className="space-y-4">
            {dealsAwaitingBrandSignature.map((deal) => {
              const agreement = dealAgreements.get(deal.id);
              if (!agreement) return null;
              const creator = creators.find((c) => c.id === deal.creator_id);
              return (
                <div key={deal.id}>
                  <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                    <p className="font-semibold">{deal.title} <span className="text-muted-foreground font-normal">· {creator?.display_name ?? "Creator"} · {formatCurrency(deal.amount_cents, deal.currency)}</span></p>
                    <MessageRecipientButton contextId={deal.id} contextType="deal" entityId={deal.creator_id} entityType="creator" label="Message creator" />
                  </div>
                  <AgreementReview agreement={agreement} viewerSide="brand" />
                </div>
              );
            })}
            {projectsAwaitingBrandSignature.map((project) => {
              const agreement = projectAgreements.get(String(project.id));
              if (!agreement) return null;
              return (
                <div key={String(project.id)}>
                  <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                    <p className="font-semibold">{String(project.title ?? "Freelancer project")} <span className="text-muted-foreground font-normal">· {formatCurrency(Number(project.amount_cents ?? 0), String(project.currency ?? "inr"))}</span></p>
                    {project.freelancer_id ? (
                      <MessageRecipientButton contextId={String(project.id)} contextType="freelancer_project" entityId={String(project.freelancer_id)} entityType="freelancer" label="Message freelancer" />
                    ) : null}
                  </div>
                  <AgreementReview agreement={agreement} viewerSide="brand" />
                </div>
              );
            })}
          </div>
        </Card>
      ) : null}

      {isBrand && (pendingDealCounters.length || pendingProjectCounters.length) ? (
        <Card className="mb-5">
          <CardHeader>
            <div>
              <CardTitle>Counter proposals needing review</CardTitle>
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
      {isBrand ? (
        <>
          {/* Sent and awaiting talent response */}
          <Card className="mb-5">
            <CardHeader>
              <CardTitle>Sent — awaiting response</CardTitle>
              <Badge tone="blue">{dealsSentAwaitingResponse.length + projectsSentAwaitingResponse.length}</Badge>
            </CardHeader>
            {dealsSentAwaitingResponse.length === 0 && projectsSentAwaitingResponse.length === 0 ? (
              <p className="text-sm text-muted-foreground">No offers waiting on talent right now.</p>
            ) : (
              <div className="grid gap-2">
                {dealsSentAwaitingResponse.map((deal) => (
                  <DealRow key={deal.id} title={deal.title} subtitle={`Creator: ${creators.find((c) => c.id === deal.creator_id)?.display_name ?? "—"} · Due ${deal.due_date ?? "not set"}`} amountText={formatCurrency(deal.amount_cents, deal.currency)} statusLabel="submitted" tone="blue" link={`/deals/${deal.id}`} />
                ))}
                {projectsSentAwaitingResponse.map((p) => (
                  <DealRow key={String(p.id)} title={String(p.title ?? "Freelancer project")} subtitle={`Freelancer project · Due ${String(p.due_date ?? "not set")}`} amountText={formatCurrency(Number(p.amount_cents ?? 0), String(p.currency ?? "inr"))} statusLabel="submitted" tone="blue" />
                ))}
              </div>
            )}
          </Card>

          {/* In progress (signed, working through funding/delivery) */}
          <Card className="mb-5">
            <CardHeader>
              <CardTitle>In progress</CardTitle>
              <Badge tone="amber">{dealsInProgress.length}</Badge>
            </CardHeader>
            {dealsInProgress.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nothing in active execution. Once the agreement is signed and funding is in place, accepted offers move here.</p>
            ) : (
              <div className="grid gap-2">
                {dealsInProgress.map((deal) => (
                  <DealRow key={deal.id} title={deal.title} subtitle={`Creator: ${creators.find((c) => c.id === deal.creator_id)?.display_name ?? "—"} · Payment ${deal.payment_status ?? "unpaid"} · Stage ${deal.stage}`} amountText={formatCurrency(deal.amount_cents, deal.currency)} statusLabel={deal.payment_status === "funded" ? "funded" : deal.payment_status === "release_ready" ? "ready to release" : "agreement signed"} tone="amber" link={`/deals/${deal.id}`} />
                ))}
              </div>
            )}
          </Card>

          {/* Completed */}
          {dealsCompleted.length ? (
            <Card className="mb-5">
              <CardHeader>
                <CardTitle>Completed</CardTitle>
                <Badge tone="green">{dealsCompleted.length}</Badge>
              </CardHeader>
              <div className="grid gap-2">
                {dealsCompleted.map((deal) => (
                  <DealRow key={deal.id} title={deal.title} subtitle={`Creator: ${creators.find((c) => c.id === deal.creator_id)?.display_name ?? "—"} · Released`} amountText={formatCurrency(deal.amount_cents, deal.currency)} statusLabel="released" tone="green" link={`/deals/${deal.id}`} />
                ))}
              </div>
            </Card>
          ) : null}

          {/* Declined - collapsible */}
          {dealsDeclined.length || projectsDeclined.length ? (
            <details className="mt-5">
              <summary className="cursor-pointer rounded-md border bg-white px-4 py-3 text-sm font-medium text-muted-foreground transition hover:bg-muted dark:border-white/8 dark:bg-card dark:hover:bg-white/4">
                Declined ({dealsDeclined.length + projectsDeclined.length})
              </summary>
              <div className="mt-3 grid gap-2">
                {dealsDeclined.map((deal) => (
                  <DealRow key={deal.id} title={deal.title} subtitle={`Creator: ${creators.find((c) => c.id === deal.creator_id)?.display_name ?? "—"}`} amountText={formatCurrency(deal.amount_cents, deal.currency)} statusLabel="declined" tone="red" />
                ))}
                {projectsDeclined.map((p) => (
                  <DealRow key={String(p.id)} title={String(p.title ?? "Freelancer project")} subtitle="Freelancer project" amountText={formatCurrency(Number(p.amount_cents ?? 0), String(p.currency ?? "inr"))} statusLabel="declined" tone="red" />
                ))}
              </div>
            </details>
          ) : null}
        </>
      ) : (
        <Card>
          <CardHeader><CardTitle>Pipeline</CardTitle><Badge tone="blue">{visibleDeals.length} deals</Badge></CardHeader>
          <div className="overflow-x-auto">
            <Table>
              <thead><tr><Th>Deal</Th><Th>Creator</Th><Th>Brand</Th><Th>Offer</Th><Th>Stage</Th><Th>Due</Th><Th>Risk</Th><Th className="text-right">Amount</Th></tr></thead>
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
                  </tr>
                ))}
                {visibleDeals.length === 0 ? (
                  <tr>
                    <Td colSpan={8} className="text-muted-foreground">No creator offers sent yet.</Td>
                  </tr>
                ) : null}
              </tbody>
            </Table>
          </div>
        </Card>
      )}

      {!isBrand ? <Card className="mt-5">
        <CardHeader><CardTitle>Freelancer Projects Sent</CardTitle><Badge tone="green">{freelancerProjects.length}</Badge></CardHeader>
        <div className="overflow-x-auto">
          <Table>
            <thead><tr><Th>Project</Th><Th>Status</Th><Th>Payment</Th><Th>Due</Th><Th>Scope</Th><Th className="text-right">Amount</Th></tr></thead>
            <tbody>
              {freelancerProjects.map((project) => (
                <tr key={String(project.id)}>
                  <Td className="font-semibold">{String(project.title ?? "Freelancer project")}</Td>
                  <Td><Badge tone={String(project.status) === "accepted" ? "green" : String(project.status) === "changes_requested" ? "amber" : "blue"}>{String(project.status ?? "submitted")}</Badge></Td>
                  <Td>{String(project.payment_status ?? "unpaid")}</Td>
                  <Td>{String(project.due_date ?? "not set")}</Td>
                  <Td className="max-w-md truncate">{String(project.scope ?? "")}</Td>
                  <Td className="text-right font-bold">{formatCurrency(Number(project.amount_cents ?? 0), String(project.currency ?? "inr"))}</Td>
                </tr>
              ))}
              {freelancerProjects.length === 0 ? (
                <tr>
                  <Td colSpan={6} className="text-muted-foreground">No freelancer projects sent yet.</Td>
                </tr>
              ) : null}
            </tbody>
          </Table>
        </div>
      </Card> : null}

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
    <div className="rounded-md border bg-white p-4 dark:border-white/8 dark:bg-card">
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

async function getDealAgreements(admin: NonNullable<ReturnType<typeof createAdminClient>>, dealIds: string[]) {
  const map = new Map<string, AgreementForReview>();
  if (!dealIds.length) return map;
  const { data } = await admin
    .from("deal_agreements")
    .select("id, deal_id, rendered_html, status, brand_signed_at, brand_signed_name, talent_signed_at, talent_signed_name")
    .in("deal_id", dealIds)
    .neq("status", "voided");
  (data ?? []).forEach((row: Record<string, unknown>) => {
    if (!row.deal_id) return;
    map.set(String(row.deal_id), {
      id: String(row.id),
      rendered_html: String(row.rendered_html ?? ""),
      status: String(row.status) as AgreementForReview["status"],
      brand_signed_at: row.brand_signed_at ? String(row.brand_signed_at) : null,
      brand_signed_name: row.brand_signed_name ? String(row.brand_signed_name) : null,
      talent_signed_at: row.talent_signed_at ? String(row.talent_signed_at) : null,
      talent_signed_name: row.talent_signed_name ? String(row.talent_signed_name) : null
    });
  });
  return map;
}

async function getProjectAgreements(admin: NonNullable<ReturnType<typeof createAdminClient>>, projectIds: string[]) {
  const map = new Map<string, AgreementForReview>();
  if (!projectIds.length) return map;
  const { data } = await admin
    .from("deal_agreements")
    .select("id, freelancer_project_id, rendered_html, status, brand_signed_at, brand_signed_name, talent_signed_at, talent_signed_name")
    .in("freelancer_project_id", projectIds)
    .neq("status", "voided");
  (data ?? []).forEach((row: Record<string, unknown>) => {
    if (!row.freelancer_project_id) return;
    map.set(String(row.freelancer_project_id), {
      id: String(row.id),
      rendered_html: String(row.rendered_html ?? ""),
      status: String(row.status) as AgreementForReview["status"],
      brand_signed_at: row.brand_signed_at ? String(row.brand_signed_at) : null,
      brand_signed_name: row.brand_signed_name ? String(row.brand_signed_name) : null,
      talent_signed_at: row.talent_signed_at ? String(row.talent_signed_at) : null,
      talent_signed_name: row.talent_signed_name ? String(row.talent_signed_name) : null
    });
  });
  return map;
}

function DealRow({ title, subtitle, amountText, statusLabel, tone, link }: {
  title: string;
  subtitle: string;
  amountText: string;
  statusLabel: string;
  tone: "blue" | "green" | "amber" | "red";
  link?: string;
}) {
  const titleEl = link ? <Link className="font-semibold text-primary hover:underline" href={link}>{title}</Link> : <span className="font-semibold">{title}</span>;
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border bg-white px-4 py-3 dark:border-white/8 dark:bg-card">
      <div className="min-w-0">
        {titleEl}
        <p className="mt-0.5 text-xs text-muted-foreground">{subtitle}</p>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-sm font-semibold">{amountText}</span>
        <Badge tone={tone}>{statusLabel}</Badge>
      </div>
    </div>
  );
}
