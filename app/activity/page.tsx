import Link from "next/link";
import { AlertTriangle, ArrowRight, CheckCircle2, Clock3, ShieldCheck, Sparkles } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { getCurrentUser } from "@/lib/auth/session";
import { creatorCompleteness, freelancerCompleteness } from "@/lib/profile/completeness";
import { createAdminClient } from "@/lib/supabase/admin";
import { formatCurrency } from "@/lib/utils/format";
import { getWorkflowNudges } from "@/lib/workflow/nudges";

type ActivitySeverity = "high" | "medium" | "low" | "info";
type ActivityItem = {
  id: string;
  title: string;
  description: string;
  href: string;
  cta: string;
  severity: ActivitySeverity;
  group: string;
};

type AnyRow = Record<string, unknown>;
type AdminClient = NonNullable<ReturnType<typeof createAdminClient>>;
type LooseResult<T> = PromiseLike<{ data: T | null; error?: unknown }>;
type LooseQuery = LooseResult<AnyRow[]> & {
  select(columns: string): LooseQuery;
  eq(column: string, value: unknown): LooseQuery;
  in(column: string, values: string[]): LooseQuery;
  order(column: string, options?: { ascending?: boolean }): LooseQuery;
  limit(count: number): LooseQuery;
  maybeSingle(): LooseResult<AnyRow | null>;
};

const severityTone: Record<ActivitySeverity, "red" | "amber" | "green" | "blue"> = {
  high: "red",
  medium: "amber",
  low: "green",
  info: "blue"
};

const severityIcon = {
  high: AlertTriangle,
  medium: Clock3,
  low: CheckCircle2,
  info: Sparkles
};

export default async function ActivityPage() {
  const user = await getCurrentUser();
  const admin = createAdminClient();

  if (!user || !admin) {
    return (
      <AppShell>
        <PageHeader
          eyebrow="Operating center"
          title="Activity Center"
          description="Connect Supabase to see live workflow activity across campaigns, contracts, deliverables, payouts, and profile readiness."
        />
      </AppShell>
    );
  }

  const items = await getActivityItems(admin, user);
  const grouped = groupItems(items);
  const urgentCount = items.filter((item) => item.severity === "high" || item.severity === "medium").length;

  return (
    <AppShell>
      <PageHeader
        eyebrow="Operating center"
        title="Activity Center"
        description="A role-aware command center for the work that actually needs attention. Offers stay in Offers; this page tracks reviews, payouts, profile readiness, and workflow blockers."
      />

      <div className="mb-6 grid gap-3 sm:grid-cols-3">
        <MetricCard label="Open items" value={items.length} tone="blue" />
        <MetricCard label="Needs action" value={urgentCount} tone={urgentCount ? "amber" : "green"} />
        <MetricCard label="Role view" value={labelForRole(user.role)} tone="green" />
      </div>

      {items.length === 0 ? (
        <Card className="border-emerald-200 bg-emerald-50/60">
          <div className="flex items-start gap-3">
            <ShieldCheck className="mt-1 h-5 w-5 text-emerald-700" />
            <div>
              <h2 className="text-base font-semibold text-emerald-950">No urgent activity right now</h2>
              <p className="mt-1 text-sm leading-6 text-emerald-800">
                The current workflow is clean. Create a campaign, send offers, upload contracts, or submit deliverables and this center will start prioritizing the next actions.
              </p>
            </div>
          </div>
        </Card>
      ) : (
        <div className="grid gap-5">
          {Object.entries(grouped).map(([group, groupItems]) => (
            <Card key={group}>
              <CardHeader>
                <CardTitle>{group}</CardTitle>
                <Badge tone="neutral">{groupItems.length} item{groupItems.length === 1 ? "" : "s"}</Badge>
              </CardHeader>
              <div className="divide-y">
                {groupItems.map((item) => (
                  <ActivityRow key={item.id} item={item} />
                ))}
              </div>
            </Card>
          ))}
        </div>
      )}
    </AppShell>
  );
}

async function getActivityItems(admin: AdminClient, user: NonNullable<Awaited<ReturnType<typeof getCurrentUser>>>) {
  const [nudges, items] = await Promise.all([
    getWorkflowNudges(admin, user),
    user.role === "brand"
      ? getBrandActivity(admin, user)
      : user.role === "creator"
        ? getCreatorActivity(admin, user)
        : user.role === "freelancer"
          ? getFreelancerActivity(admin, user)
          : getAdminActivity(admin)
  ]);
  return dedupeItems([
    ...nudges.map((item) => ({ ...item, id: `nudge-${item.id}` })),
    ...items
  ]);
}

async function getBrandActivity(admin: AdminClient, user: NonNullable<Awaited<ReturnType<typeof getCurrentUser>>>) {
  const items: ActivityItem[] = [];
  const client = db(admin);
  const { data: brandRows } = await client.from("brands").select("*").eq("contact_email", user.email);
  const brands = asRows(brandRows);
  const { data: campaignRows } = await client.from("campaigns").select("*").eq("profile_id", user.id).order("created_at", { ascending: false });
  const campaigns = asRows(campaignRows);
  const brandIds = uniqueIds([...mapIds(brands), ...campaigns.map((campaign) => campaign.brand_id).filter((id): id is string => typeof id === "string")]);
  const deals = brandIds.length ? await selectIn(admin, "deals", "*", "brand_id", brandIds) : [];
  const projects = brandIds.length ? await selectIn(admin, "freelancer_projects", "*", "brand_id", brandIds) : [];

  const dealIds = mapIds(deals);
  const projectIds = mapIds(projects);
  const dealDeliverables = dealIds.length ? await selectIn(admin, "deliverables", "*", "deal_id", dealIds) : [];
  const projectDeliverables = projectIds.length ? await selectIn(admin, "deliverables", "*", "freelancer_project_id", projectIds) : [];
  const contracts = dealIds.length ? await selectIn(admin, "contracts", "*", "deal_id", dealIds) : [];

  for (const deliverable of [...dealDeliverables, ...projectDeliverables].filter((row: AnyRow) => row.status === "submitted")) {
    items.push({
      id: `deliverable-${deliverable.id}`,
      group: "Review queue",
      severity: "high",
      title: deliverable.title ? `Review deliverable: ${deliverable.title}` : "Review submitted deliverable",
      description: "A creator or freelancer has submitted work. Reviewing it keeps the payout workflow moving.",
      href: "/payments",
      cta: "Review delivery"
    });
  }

  for (const deal of deals.filter((row: AnyRow) => row.payment_status === "release_ready")) {
    items.push({
      id: `deal-release-${deal.id}`,
      group: "Payment control",
      severity: "high",
      title: `Release creator payout for ${deal.title ?? "deal"}`,
      description: `${formatCurrency(toNumber(deal.amount_cents), toText(deal.currency, "inr"))} is marked release-ready after approval.`,
      href: `/deals/${deal.id}`,
      cta: "Open payout"
    });
  }

  for (const project of projects.filter((row: AnyRow) => row.payment_status === "release_ready")) {
    items.push({
      id: `project-release-${project.id}`,
      group: "Payment control",
      severity: "high",
      title: `Release freelancer payout for ${toText(project.title, "project")}`,
      description: `${formatCurrency(toNumber(project.amount_cents), toText(project.currency, "inr"))} is marked release-ready after approval.`,
      href: "/payments",
      cta: "Open payouts"
    });
  }

  for (const contract of contracts.filter((row: AnyRow) => row.risk_level === "high_risk" || row.risk_level === "caution")) {
    items.push({
      id: `contract-${contract.id}`,
      group: "Contract protection",
      severity: contract.risk_level === "high_risk" ? "high" : "medium",
      title: contract.risk_level === "high_risk" ? "High-risk contract needs review" : "Contract scan has caution flags",
      description: toText(contract.summary, "Review scan flags before approving or moving the deal forward."),
      href: "/contracts",
      cta: "Review contract"
    });
  }

  for (const campaign of campaigns) {
    const campaignDeals = deals.filter((deal: AnyRow) => deal.campaign_id === campaign.id);
    const campaignProjects = projects.filter((project: AnyRow) => project.campaign_id === campaign.id);
    if (campaignDeals.length === 0 && campaignProjects.length === 0) {
      items.push({
        id: `campaign-empty-${campaign.id}`,
        group: "Campaign setup",
        severity: "medium",
        title: `${toText(campaign.title, "Campaign")} has no offers or projects sent`,
        description: "Use recommendations to invite creators or freelancers so the brief can turn into actual work.",
        href: `/campaigns/${campaign.id}`,
        cta: "Open recommendations"
      });
      continue;
    }

    const hasAcceptedTalent = [...campaignDeals, ...campaignProjects].some((row) => row.talent_response === "accepted" || row.status === "accepted");
    if (!hasAcceptedTalent) {
      items.push({
        id: `campaign-no-accepted-${campaign.id}`,
        group: "Campaign setup",
        severity: "medium",
      title: `${toText(campaign.title, "Campaign")} has no accepted talent yet`,
        description: "Shortlisted talent exists, but nobody has accepted. Consider revising budget, scope, or target fit.",
        href: `/campaigns/${campaign.id}`,
        cta: "Review campaign"
      });
    }
  }

  return limitItems(items);
}

async function getCreatorActivity(admin: AdminClient, user: NonNullable<Awaited<ReturnType<typeof getCurrentUser>>>) {
  const items: ActivityItem[] = [];
  const client = db(admin);
  const { data: creator } = await client.from("creators").select("*").eq("profile_id", user.id).maybeSingle();
  if (!creator) {
    const missingProfile: ActivityItem[] = [{
      id: "creator-profile",
      group: "Profile readiness",
      severity: "high",
      title: "Create your creator profile",
      description: "Your creator profile powers marketplace discovery, matching, valuation, and deal protection.",
      href: "/profile",
      cta: "Complete profile"
    }];
    return missingProfile;
  }

  const [{ data: platformRows }, { data: dealRows }, { data: auditRows }] = await Promise.all([
    client.from("creator_platforms").select("*").eq("creator_id", creator.id),
    client.from("deals").select("*").eq("creator_id", creator.id).order("created_at", { ascending: false }),
    client.from("creator_audits").select("*").eq("creator_id", creator.id).order("created_at", { ascending: false }).limit(1)
  ]);
  const platforms = asRows(platformRows);
  const deals = asRows(dealRows);
  const audits = asRows(auditRows);

  const dealIds = mapIds(deals);
  const deliverables = dealIds.length ? await selectIn(admin, "deliverables", "*", "deal_id", dealIds) : [];
  const contracts = dealIds.length ? await selectIn(admin, "contracts", "*", "deal_id", dealIds) : [];
  const payments = dealIds.length ? await selectIn(admin, "payments", "*", "deal_id", dealIds) : [];
  const completeness = creatorCompleteness({ creator, platforms, deals, hasAudit: Boolean(audits.length) });

  addCompletenessItems(items, completeness.items, "Profile readiness");

  for (const offer of deals.filter((row: AnyRow) => !["accepted", "declined"].includes(String(row.offer_status ?? "")))) {
    items.push({
      id: `creator-offer-${offer.id}`,
      group: "Offers needing response",
      severity: "high",
      title: `Respond to ${toText(offer.title, "new creator offer")}`,
      description: "Review the scope, scan contract terms if available, negotiate if needed, then accept or decline.",
      href: "/offers",
      cta: "Review offer"
    });
  }

  for (const deliverable of deliverables.filter((row: AnyRow) => row.status === "revision_requested")) {
    items.push({
      id: `revision-${deliverable.id}`,
      group: "Delivery workflow",
      severity: "high",
      title: deliverable.title ? `Revision requested: ${deliverable.title}` : "Deliverable revision requested",
      description: toText(deliverable.review_notes, "The brand requested a change before approval and payout release."),
      href: "/offers",
      cta: "Open offers"
    });
  }

  for (const contract of contracts.filter((row: AnyRow) => row.risk_level === "high_risk" || row.risk_level === "caution")) {
    items.push({
      id: `creator-contract-${contract.id}`,
      group: "Contract protection",
      severity: contract.risk_level === "high_risk" ? "high" : "medium",
      title: contract.risk_level === "high_risk" ? "High-risk terms detected" : "Contract caution flags detected",
      description: toText(contract.summary, "Review payment terms, usage rights, exclusivity, whitelisting, and licensing before delivery."),
      href: "/contracts",
      cta: "Review scan"
    });
  }

  for (const payment of payments.filter((row: AnyRow) => ["funded", "release_ready", "released"].includes(String(row.status)))) {
    items.push({
      id: `creator-payment-${payment.id}`,
      group: "Payment status",
      severity: payment.status === "release_ready" ? "medium" : "info",
      title: payment.status === "released" ? "Payment released" : payment.status === "release_ready" ? "Payment ready for release" : "Deal is funded",
      description: `${formatCurrency(toNumber(payment.creator_payout_cents ?? payment.amount_cents))} is tracked through Agently's protected payout workflow.`,
      href: "/payments",
      cta: "View payment"
    });
  }

  if (!audits.length) {
    items.push({
      id: "creator-audit-missing",
      group: "Profile readiness",
      severity: "medium",
      title: "Run your first AI profile audit",
      description: "The audit gives Agently stronger Bangalore/India fit, content positioning, and brand match signals.",
      href: "/profile",
      cta: "Run audit"
    });
  } else if (Number(creator.monetization_score ?? 0) < 65) {
    items.push({
      id: "creator-audit-refresh",
      group: "Profile readiness",
      severity: "low",
      title: "Refresh your profile audit after niche changes",
      description: "If your content direction has shifted, re-audit so brand matching does not rely on stale positioning.",
      href: "/profile",
      cta: "Refresh audit"
    });
  }

  return limitItems(items);
}

async function getFreelancerActivity(admin: AdminClient, user: NonNullable<Awaited<ReturnType<typeof getCurrentUser>>>) {
  const items: ActivityItem[] = [];
  const client = db(admin);
  const { data: freelancer } = await client.from("freelancers").select("*").eq("profile_id", user.id).maybeSingle();
  if (!freelancer) {
    const missingProfile: ActivityItem[] = [{
      id: "freelancer-profile",
      group: "Profile readiness",
      severity: "high",
      title: "Create your freelancer profile",
      description: "A freelancer profile lets brands discover your production skills, project rates, portfolio, and availability.",
      href: "/profile",
      cta: "Complete profile"
    }];
    return missingProfile;
  }

  const [{ data: rateRows }, { data: portfolioRows }, { data: projectRows }] = await Promise.all([
    client.from("freelancer_service_rates").select("*").eq("freelancer_id", freelancer.id),
    client.from("portfolio_items").select("*").eq("freelancer_id", freelancer.id),
    client.from("freelancer_projects").select("*").eq("freelancer_id", freelancer.id).order("created_at", { ascending: false })
  ]);
  const rates = asRows(rateRows);
  const portfolio = asRows(portfolioRows);
  const projects = asRows(projectRows);

  const projectIds = mapIds(projects);
  const deliverables = projectIds.length ? await selectIn(admin, "deliverables", "*", "freelancer_project_id", projectIds) : [];
  const completeness = freelancerCompleteness({ freelancer, serviceRates: rates, portfolio, projects });
  addCompletenessItems(items, completeness.items, "Profile readiness");

  for (const project of projects.filter((row: AnyRow) => !["accepted", "declined"].includes(String(row.status ?? "")))) {
    items.push({
      id: `freelancer-project-offer-${project.id}`,
      group: "Offers needing response",
      severity: "high",
      title: `Respond to ${toText(project.title, "new freelancer project")}`,
      description: "Review the project scope, usage, approval terms, and rate before accepting or requesting changes.",
      href: "/offers",
      cta: "Review project"
    });
  }

  for (const deliverable of deliverables.filter((row: AnyRow) => row.status === "revision_requested")) {
    items.push({
      id: `freelancer-revision-${deliverable.id}`,
      group: "Delivery workflow",
      severity: "high",
      title: deliverable.title ? `Revision requested: ${deliverable.title}` : "Project revision requested",
      description: toText(deliverable.review_notes, "The brand requested a change before approval and payout release."),
      href: "/offers",
      cta: "Open projects"
    });
  }

  for (const project of projects.filter((row: AnyRow) => ["release_ready", "released", "funded"].includes(String(row.payment_status)))) {
    items.push({
      id: `freelancer-payment-${project.id}`,
      group: "Payment status",
      severity: project.payment_status === "release_ready" ? "medium" : "info",
      title: project.payment_status === "released" ? "Freelancer payout released" : project.payment_status === "release_ready" ? "Freelancer payout ready for release" : "Project is funded",
      description: `${formatCurrency(toNumber(project.amount_cents), toText(project.currency, "inr"))} is tracked against ${toText(project.title, "this project")}.`,
      href: "/payments",
      cta: "View payment"
    });
  }

  for (const project of projects.filter((row: AnyRow) => !row.approval_terms)) {
    items.push({
      id: `approval-terms-${project.id}`,
      group: "Project protection",
      severity: "medium",
      title: `${toText(project.title, "Project")} is missing approval terms`,
      description: "Approval terms reduce confusion around revisions, usage, and final payout release.",
      href: "/offers",
      cta: "Review project"
    });
  }

  return limitItems(items);
}

async function getAdminActivity(admin: AdminClient) {
  const items: ActivityItem[] = [];
  const client = db(admin);
  const [
    { data: contractRows },
    { data: deliverableRows },
    { data: dealRows },
    { data: projectRows },
    { data: campaignRows },
    { data: creatorRows },
    { data: freelancerRows },
    { data: brandRows }
  ] = await Promise.all([
    client.from("contracts").select("*").in("risk_level", ["high_risk", "caution"]).order("created_at", { ascending: false }).limit(10),
    client.from("deliverables").select("*").eq("status", "submitted").order("created_at", { ascending: false }).limit(10),
    client.from("deals").select("*").order("created_at", { ascending: false }).limit(100),
    client.from("freelancer_projects").select("*").order("created_at", { ascending: false }).limit(100),
    client.from("campaigns").select("*").order("created_at", { ascending: false }).limit(25),
    client.from("creators").select("*").limit(100),
    client.from("freelancers").select("*").limit(100),
    client.from("brands").select("*").limit(100)
  ]);
  const contracts = asRows(contractRows);
  const deliverables = asRows(deliverableRows);
  const deals = asRows(dealRows);
  const projects = asRows(projectRows);
  const campaigns = asRows(campaignRows);
  const creators = asRows(creatorRows);
  const freelancers = asRows(freelancerRows);
  const brands = asRows(brandRows);

  for (const contract of contracts) {
    items.push({
      id: `admin-contract-${contract.id}`,
      group: "Contract protection",
      severity: contract.risk_level === "high_risk" ? "high" : "medium",
      title: contract.risk_level === "high_risk" ? "High-risk contract scan" : "Contract caution scan",
      description: toText(contract.summary, "Review AI scan output before this deal advances."),
      href: "/contracts",
      cta: "Open contracts"
    });
  }

  for (const deliverable of deliverables) {
    items.push({
      id: `admin-deliverable-${deliverable.id}`,
      group: "Review queue",
      severity: "high",
      title: deliverable.title ? `Deliverable awaiting review: ${deliverable.title}` : "Deliverable awaiting review",
      description: "Admin review can move this toward approval, revision, or payout release.",
      href: "/payments",
      cta: "Review delivery"
    });
  }

  for (const deal of deals.filter((row: AnyRow) => row.payment_status === "release_ready").slice(0, 8)) {
    items.push({
      id: `admin-deal-release-${deal.id}`,
      group: "Payment control",
      severity: "high",
      title: `Creator payout ready: ${toText(deal.title, "Deal")}`,
      description: `${formatCurrency(toNumber(deal.amount_cents), toText(deal.currency, "inr"))} is ready for release.`,
      href: `/deals/${deal.id}`,
      cta: "Open deal"
    });
  }

  for (const project of projects.filter((row: AnyRow) => row.payment_status === "release_ready").slice(0, 8)) {
    items.push({
      id: `admin-project-release-${project.id}`,
      group: "Payment control",
      severity: "high",
      title: `Freelancer payout ready: ${toText(project.title, "Project")}`,
      description: `${formatCurrency(toNumber(project.amount_cents), toText(project.currency, "inr"))} is ready for release.`,
      href: "/payments",
      cta: "Open payments"
    });
  }

  for (const campaign of campaigns) {
    const campaignDeals = deals.filter((deal: AnyRow) => deal.campaign_id === campaign.id);
    const campaignProjects = projects.filter((project: AnyRow) => project.campaign_id === campaign.id);
    const hasAcceptedTalent = [...campaignDeals, ...campaignProjects].some((row) => row.talent_response === "accepted" || row.status === "accepted");
    if (!hasAcceptedTalent) {
      items.push({
        id: `admin-campaign-${campaign.id}`,
        group: "Campaign setup",
        severity: campaignDeals.length || campaignProjects.length ? "medium" : "low",
      title: `${toText(campaign.title, "Campaign")} has no accepted talent`,
        description: campaignDeals.length || campaignProjects.length ? "Offers exist but no talent has accepted yet." : "No offers or freelancer projects have been sent yet.",
        href: `/campaigns/${campaign.id}`,
        cta: "Open campaign"
      });
    }
  }

  for (const creator of creators.filter((row: AnyRow) => !row.image_url || !row.primary_niche || !row.home_city).slice(0, 5)) {
    items.push({
      id: `admin-creator-${creator.id}`,
      group: "Profile readiness",
      severity: "low",
      title: `${toText(creator.display_name, "Creator")} has incomplete creator data`,
      description: "Missing image, niche, or city signals can weaken marketplace trust and matching.",
      href: `/creators/${creator.id}`,
      cta: "Open profile"
    });
  }

  for (const freelancer of freelancers.filter((row: AnyRow) => !row.image_url || !row.service_category || !toArray(row.skills).length).slice(0, 5)) {
    items.push({
      id: `admin-freelancer-${freelancer.id}`,
      group: "Profile readiness",
      severity: "low",
      title: `${toText(freelancer.display_name, "Freelancer")} has incomplete freelancer data`,
      description: "Missing image, category, or skills makes production matching less credible.",
      href: `/freelancers/${freelancer.id}`,
      cta: "Open profile"
    });
  }

  for (const brand of brands.filter((row: AnyRow) => !row.image_url || !row.industry).slice(0, 5)) {
    items.push({
      id: `admin-brand-${brand.id}`,
      group: "Profile readiness",
      severity: "low",
      title: `${toText(brand.name, "Brand")} has incomplete brand data`,
      description: "Brand category and visual identity help creators evaluate whether to collaborate.",
      href: "/dashboard",
      cta: "Review admin"
    });
  }

  const feedback = await safeSelect(admin, "tester_feedback", "*", { order: "created_at", limit: 8 });
  for (const note of feedback) {
    items.push({
      id: `feedback-${note.id}`,
      group: "Prototype feedback",
      severity: Number(note.rating ?? 5) <= 2 ? "medium" : "info",
      title: `${note.workflow ?? "Tester"} feedback from ${note.role ?? "user"}`,
      description: toText(note.what_was_confusing || note.missing_feature || note.what_worked, "New tester feedback submitted."),
      href: "/feedback",
      cta: "Open feedback"
    });
  }

  return limitItems(items, 40);
}

async function selectIn(admin: AdminClient, table: string, columns: string, column: string, values: string[]) {
  if (!values.length) return [];
  const { data, error } = await db(admin).from(table).select(columns).in(column, values);
  if (error) return [];
  return asRows(data);
}

async function safeSelect(admin: AdminClient, table: string, columns: string, options?: { order?: string; limit?: number }) {
  try {
    let query = db(admin).from(table).select(columns);
    if (options?.order) query = query.order(options.order, { ascending: false });
    if (options?.limit) query = query.limit(options.limit);
    const { data, error } = await query;
    if (error) return [];
    return asRows(data);
  } catch {
    return [];
  }
}

function addCompletenessItems(items: ActivityItem[], completenessItems: ReturnType<typeof creatorCompleteness>["items"], group: string) {
  for (const item of completenessItems.filter((entry) => !entry.done)) {
    items.push({
      id: `completeness-${item.label}`,
      group,
      severity: item.href ? "low" : "medium",
      title: item.label,
      description: item.reason,
      href: item.href ?? "/profile",
      cta: "Update profile"
    });
  }
}

function limitItems(items: ActivityItem[], limit = 25) {
  const rank: Record<ActivitySeverity, number> = { high: 0, medium: 1, low: 2, info: 3 };
  return items.sort((a, b) => rank[a.severity] - rank[b.severity] || a.group.localeCompare(b.group)).slice(0, limit);
}

function dedupeItems(items: ActivityItem[]) {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = `${item.group}:${item.title}:${item.href}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function groupItems(items: ActivityItem[]) {
  return items.reduce<Record<string, ActivityItem[]>>((groups, item) => {
    groups[item.group] = groups[item.group] ?? [];
    groups[item.group].push(item);
    return groups;
  }, {});
}

function MetricCard({ label, value, tone }: { label: string; value: string | number; tone: "blue" | "green" | "amber" }) {
  return (
    <Card className="p-4">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">{label}</p>
      <div className="mt-3 flex items-center justify-between gap-3">
        <p className="text-2xl font-bold tracking-normal">{value}</p>
        <Badge tone={tone}>{tone === "amber" ? "Review" : "Live"}</Badge>
      </div>
    </Card>
  );
}

function ActivityRow({ item }: { item: ActivityItem }) {
  const Icon = severityIcon[item.severity];
  return (
    <div className="flex flex-col gap-3 py-4 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 gap-3">
        <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-muted">
          <Icon className="h-4 w-4 text-muted-foreground" />
        </div>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-semibold tracking-normal">{item.title}</h3>
            <Badge tone={severityTone[item.severity]}>{item.severity.replace("_", " ")}</Badge>
          </div>
          <p className="mt-1 max-w-3xl text-sm leading-6 text-muted-foreground">{item.description}</p>
        </div>
      </div>
      <Link
        href={item.href}
        className="inline-flex h-9 shrink-0 items-center justify-center gap-2 rounded-md border bg-white px-3 text-sm font-medium transition hover:bg-muted"
      >
        {item.cta}
        <ArrowRight className="h-4 w-4" />
      </Link>
    </div>
  );
}

function labelForRole(role: string) {
  if (role === "brand") return "Brand";
  if (role === "creator") return "Creator";
  if (role === "freelancer") return "Freelancer";
  return "Admin";
}

function db(admin: AdminClient) {
  return admin as unknown as { from(table: string): LooseQuery };
}

function asRows(data: unknown): AnyRow[] {
  return Array.isArray(data) ? data.filter(isRow) : [];
}

function isRow(value: unknown): value is AnyRow {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function mapIds(rows: AnyRow[]) {
  return rows.map((row) => row.id).filter((id): id is string => typeof id === "string");
}

function uniqueIds(ids: string[]) {
  return Array.from(new Set(ids));
}

function toText(value: unknown, fallback: string) {
  return typeof value === "string" && value.trim() ? value : fallback;
}

function toNumber(value: unknown) {
  return typeof value === "number" ? value : 0;
}

function toArray(value: unknown) {
  return Array.isArray(value) ? value : [];
}
