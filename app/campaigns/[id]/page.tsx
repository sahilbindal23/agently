import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { RecommendationCard } from "@/components/campaigns/recommendation-card";
import { RemoveShortlistButton } from "@/components/campaigns/remove-shortlist-button";
import { AppShell } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { enrichRecommendationsWithRoi } from "@/lib/campaigns/enrich-roi";
import { projectCampaignPerformance, type CampaignPerformanceProjection } from "@/lib/campaigns/performance";
import { applyEventInformedRanking, rankCreators, rankFreelancers, type CampaignRecommendation, type FreelancerRecommendationInput, type RecommendationEventSignal, type ServiceRateInput } from "@/lib/campaigns/recommendations";
import { getCurrentUser } from "@/lib/auth/session";
import { canSeeDemoData, withoutDemoRows } from "@/lib/db/demo-visibility";
import { getAgentlyData } from "@/lib/db/live-data";
import { upsertRecommendationLedgerRows } from "@/lib/engines/outcome-ledger";
import { creatorAutomationDecision, freelancerAutomationDecision, isDiscoverable } from "@/lib/profile/automation";
import { createAdminClient } from "@/lib/supabase/admin";
import { formatCurrency, formatNumber } from "@/lib/utils/format";
import type { Campaign, CampaignInvite, CampaignShortlist, Creator, Deal } from "@/types";

export const dynamic = "force-dynamic";

export default async function CampaignDetailPage({
  params,
  searchParams
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { id } = await params;
  const query = await searchParams;
  const user = await getCurrentUser();
  const includeDemo = canSeeDemoData(user);
  const [{ creators, creatorPlatforms, deals }, campaignData] = await Promise.all([
    getAgentlyData({ includeDemo }),
    getCampaignData(id, includeDemo)
  ]);
  if (!campaignData.campaign) notFound();

  const campaign = campaignData.campaign;
  const creatorsWithTrust = withCreatorCompletedWork(creators, deals);
  const freelancersWithTrust = withFreelancerCompletedWork(campaignData.freelancers, campaignData.projects);
  const creatorPool = campaign.visibility === "invite_only" && campaignData.invites.length
    ? creatorsWithTrust.filter((creator) => campaignData.invites.some((invite) => invite.creator_id === creator.id))
    : creatorsWithTrust;
  const eligibleCreators = creatorPool.filter((creator) => isDiscoverable(creatorAutomationDecision({
    creator: creator as unknown as Record<string, unknown>,
    platforms: creatorPlatforms.filter((platform) => platform.creator_id === creator.id) as unknown as Array<Record<string, unknown>>
  })));
  const eligibleFreelancers = freelancersWithTrust.filter((freelancer) => isDiscoverable(freelancerAutomationDecision({
    freelancer: freelancer as unknown as Record<string, unknown>,
    serviceRates: campaignData.serviceRates.filter((rate) => rate.freelancer_id === freelancer.id) as unknown as Array<Record<string, unknown>>
  })));
  const creatorTrustFilter = ["verified", "api_synced"].includes(String(first(query.creatorTrust))) ? "verified" : "all";
  const allCreatorRecommendations = applyEventInformedRanking(rankCreators(campaign, eligibleCreators, creatorPlatforms), "creator", campaignData.productEvents, campaign.id);
  const adminClientForRoi = createAdminClient();
  const creatorRecommendationsBase = filterCreatorRecommendations(allCreatorRecommendations, creatorTrustFilter).slice(0, 8);
  const creatorRecommendations = adminClientForRoi
    ? await enrichRecommendationsWithRoi(adminClientForRoi, creatorRecommendationsBase, eligibleCreators, creatorPlatforms)
    : creatorRecommendationsBase;
  const freelancerRecommendations = applyEventInformedRanking(rankFreelancers(campaign, eligibleFreelancers, campaignData.serviceRates), "freelancer", campaignData.productEvents, campaign.id).slice(0, 8);
  const creatorShortlist = campaignData.shortlists.filter((item) => item.entity_type === "creator");
  const freelancerShortlist = campaignData.shortlists.filter((item) => item.entity_type === "freelancer");
  const projection = projectCampaignPerformance({
    campaign,
    creatorRecommendations,
    freelancerRecommendations,
    shortlists: campaignData.shortlists
  });
  await persistRecommendationSnapshots(campaign.id, creatorRecommendations, freelancerRecommendations);

  return (
    <AppShell>
      <PageHeader
        eyebrow="Campaign recommendations"
        title={campaign.title}
        description={campaign.campaign_goal || "Review recommended creators and freelancers for this campaign brief."}
        action={<Link className="inline-flex h-10 items-center gap-2 rounded-md border bg-white px-4 text-sm font-medium dark:border-white/8 dark:bg-card" href="/campaigns"><ArrowLeft className="h-4 w-4" /> Campaigns</Link>}
      />

      <section className="grid gap-4 md:grid-cols-4">
        <Metric label="Budget" value={formatCurrency(campaign.budget_cents, "inr")} />
        <Metric label="Focus" value={campaign.city_focus || campaign.region_focus || "Flexible"} />
        <Metric label="Length" value={campaign.campaign_length || "Not set"} />
        <Metric label="Shortlisted" value={`${campaignData.shortlists.length}`} />
      </section>

      <PerformanceProjectionCard projection={projection} />

      <Card className="mt-5">
        <CardHeader><CardTitle>Brief Inputs</CardTitle><Badge tone="blue">{campaign.status}</Badge></CardHeader>
        <div className="grid gap-3 md:grid-cols-3">
          <BriefItem label="Audience" value={campaign.target_audience || "Not set"} />
          <BriefItem label="Platforms" value={campaign.platforms.join(", ") || "Flexible"} />
          <BriefItem label="Languages" value={campaign.languages.join(", ") || "Flexible"} />
          <BriefItem label="Visibility" value={campaign.visibility.replace("_", " ")} />
          <BriefItem label="Creator categories" value={campaign.creator_categories.join(", ") || "Flexible"} />
          <BriefItem label="Freelancer needs" value={campaign.freelancer_needs.join(", ") || "Not requested"} />
          <BriefItem label="Region" value={campaign.region_focus || campaign.city_focus || "Flexible"} />
        </div>
      </Card>

      <Card className="mt-5">
        <CardHeader>
          <div>
            <CardTitle>Discovery Preferences</CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">Keep recommendations broad, or show only creators with synced platform metrics when brand trust matters more than reach volume.</p>
          </div>
          <Badge tone={creatorTrustFilter === "verified" ? "green" : "blue"}>{creatorTrustFilter === "verified" ? "verified creators" : "all eligible creators"}</Badge>
        </CardHeader>
        <div className="flex flex-wrap gap-2">
          <FilterLink active={creatorTrustFilter === "all"} href={`/campaigns/${campaign.id}`}>All eligible creators</FilterLink>
          <FilterLink active={creatorTrustFilter === "verified"} href={`/campaigns/${campaign.id}?creatorTrust=verified`}>Verified creators only</FilterLink>
        </div>
        {creatorTrustFilter === "verified" && creatorRecommendations.length === 0 ? (
          <p className="mt-3 rounded-md bg-amber-50 p-3 text-sm leading-6 text-amber-800">
            No verified creators match this brief yet. Switch back to all eligible creators or ask shortlisted talent to connect their Instagram, Facebook, or YouTube account for verification.
          </p>
        ) : null}
      </Card>

      <Card className="mt-5">
        <CardHeader><CardTitle>Shortlist</CardTitle><Badge tone="blue">{campaignData.shortlists.length}</Badge></CardHeader>
        {campaignData.shortlists.length ? (
          <div className="grid gap-3 md:grid-cols-2">
            <ShortlistGroup campaign={campaign} items={creatorShortlist} recommendations={creatorRecommendations} title="Creators" type="creator" />
            <ShortlistGroup campaign={campaign} items={freelancerShortlist} recommendations={freelancerRecommendations} title="Freelancers" type="freelancer" />
          </div>
        ) : (
          <p className="text-sm leading-6 text-muted-foreground">Shortlist talent from the recommendation cards below.</p>
        )}
      </Card>

      <section className="mt-5 grid gap-5 xl:grid-cols-2">
        <RecommendationColumn
          campaign={campaign}
          recommendations={creatorRecommendations}
          shortlists={campaignData.shortlists}
          title="Recommended Creators"
          type="creator"
        />
        <RecommendationColumn
          campaign={campaign}
          recommendations={freelancerRecommendations}
          shortlists={campaignData.shortlists}
          title="Recommended Freelancers"
          type="freelancer"
        />
      </section>
    </AppShell>
  );
}

function FilterLink({ active, children, href }: { active: boolean; children: React.ReactNode; href: string }) {
  return (
    <Link
      className={`inline-flex h-9 items-center rounded-md border px-3 text-sm font-medium transition ${active ? "border-primary bg-primary text-primary-foreground" : "bg-white hover:bg-muted dark:bg-card dark:border-white/8 dark:hover:bg-muted"}`}
      href={href}
    >
      {children}
    </Link>
  );
}

function filterCreatorRecommendations(recommendations: CampaignRecommendation[], filter: "all" | "verified") {
  if (filter === "verified") return recommendations.filter((item) => item.trust_source === "api_synced");
  return recommendations;
}

function ShortlistGroup({
  campaign,
  items,
  recommendations,
  title,
  type
}: {
  campaign: Campaign;
  items: CampaignShortlist[];
  recommendations: CampaignRecommendation[];
  title: string;
  type: "creator" | "freelancer";
}) {
  return (
    <div className="rounded-md border bg-white p-3 dark:border-white/8 dark:bg-card">
      <p className="font-semibold">{title}</p>
      <div className="mt-3 space-y-2">
        {items.length ? items.map((item) => {
          const recommendation = recommendations.find((match) => match.id === item.entity_id);
          return (
            <div className="rounded-md bg-muted p-3" key={item.id}>
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold">{recommendation?.name ?? item.entity_id}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{item.reason}</p>
                </div>
                <Badge tone="green">{item.fit_score}</Badge>
              </div>
              <div className="mt-2 flex flex-wrap gap-2">
                <RemoveShortlistButton campaignId={campaign.id} entityId={item.entity_id} entityType={type} />
              </div>
            </div>
          );
        }) : <p className="text-sm text-muted-foreground">No {title.toLowerCase()} shortlisted yet.</p>}
      </div>
    </div>
  );
}

function RecommendationColumn({
  campaign,
  recommendations,
  shortlists,
  title,
  type
}: {
  campaign: Campaign;
  recommendations: CampaignRecommendation[];
  shortlists: CampaignShortlist[];
  title: string;
  type: "creator" | "freelancer";
}) {
  return (
    <Card>
      <CardHeader><CardTitle>{title}</CardTitle><Badge tone="green">{recommendations.length}</Badge></CardHeader>
      <div className="space-y-3">
        {recommendations.map((item) => {
          const isShortlisted = shortlists.some((shortlist) => shortlist.campaign_id === campaign.id && shortlist.entity_type === type && shortlist.entity_id === item.id);
          return (
            <RecommendationCard campaignId={campaign.id} isShortlisted={isShortlisted} item={item} key={item.id} type={type} />
          );
        })}
      </div>
    </Card>
  );
}

function PerformanceProjectionCard({ projection }: { projection: CampaignPerformanceProjection }) {
  return (
    <Card className="mt-5">
      <CardHeader>
        <div>
          <CardTitle>Projected Performance Signals</CardTitle>
          <p className="mt-1 text-sm text-muted-foreground">Directional planning view based on the current recommendations or shortlist. Not a revenue guarantee.</p>
        </div>
        <Badge tone={projection.confidenceScore >= 70 ? "green" : projection.confidenceScore >= 48 ? "amber" : "red"}>
          {projection.confidenceScore}% confidence
        </Badge>
      </CardHeader>
      <div className="grid gap-3 md:grid-cols-4">
        <BriefItem label="Projected reach" value={formatNumber(projection.projectedReach)} />
        <BriefItem label="Projected engagements" value={formatNumber(projection.projectedEngagements)} />
        <BriefItem label="Projected CPM" value={projection.projectedCpmCents ? formatCurrency(projection.projectedCpmCents, "inr") : "Needs reach data"} />
        <BriefItem label="Cost per engagement" value={projection.projectedCostPerEngagementCents ? formatCurrency(projection.projectedCostPerEngagementCents, "inr") : "Needs engagement data"} />
      </div>
      <div className="mt-4 grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
        <div className="rounded-md border bg-white p-4 dark:border-white/8 dark:bg-card">
          <p className="text-xs font-semibold uppercase text-muted-foreground">Production contribution</p>
          <p className="mt-2 text-sm leading-6">{projection.productionContribution}</p>
          <p className="mt-2 text-xs text-muted-foreground">
            Projection uses {projection.creatorCount} creator{projection.creatorCount === 1 ? "" : "s"} and {projection.freelancerCount} freelancer{projection.freelancerCount === 1 ? "" : "s"}.
          </p>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          <SignalList title="What would improve ROI" items={projection.improvementLevers} tone="green" />
          <SignalList title="Risk notes" items={projection.riskNotes.length ? projection.riskNotes : ["No major projection risks detected from the current inputs."]} tone="amber" />
        </div>
      </div>
    </Card>
  );
}

function SignalList({ items, title, tone }: { items: string[]; title: string; tone: "green" | "amber" }) {
  return (
    <div className="rounded-md border bg-white p-4 dark:border-white/8 dark:bg-card">
      <div className="mb-3 flex items-center justify-between gap-3">
        <p className="text-xs font-semibold uppercase text-muted-foreground">{title}</p>
        <Badge tone={tone}>{items.length}</Badge>
      </div>
      <div className="space-y-2">
        {items.map((item) => (
          <p className="rounded-md bg-muted px-3 py-2 text-sm leading-5" key={item}>{item}</p>
        ))}
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-2 text-xl font-bold">{value}</p>
    </Card>
  );
}

function BriefItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border bg-white p-3 dark:border-white/8 dark:bg-card">
      <p className="text-xs font-semibold uppercase text-muted-foreground">{label}</p>
      <p className="mt-1 text-sm leading-5">{value}</p>
    </div>
  );
}

async function getCampaignData(id: string, includeDemo: boolean) {
  const admin = createAdminClient();
  if (!admin) {
    return { campaign: null, freelancers: [] as FreelancerRecommendationInput[], serviceRates: [] as ServiceRateInput[], shortlists: [] as CampaignShortlist[], invites: [] as CampaignInvite[], projects: [] as Array<Record<string, unknown>>, productEvents: [] as RecommendationEventSignal[] };
  }

  const [campaignResult, freelancersResult, serviceRatesResult, shortlistsResult, invitesResult, projectsResult, productEvents] = await Promise.all([
    admin.from("campaigns").select("*").eq("id", id).maybeSingle(),
    admin.from("freelancers").select("*").order("created_at", { ascending: false }),
    admin.from("freelancer_service_rates").select("*"),
    admin.from("campaign_shortlists").select("*").eq("campaign_id", id),
    admin.from("campaign_invites").select("*").eq("campaign_id", id),
    admin.from("freelancer_projects").select("id, freelancer_id, status, payment_status, deliverable_status"),
    getProductEvents(admin)
  ]);

  return {
    campaign: campaignResult.data && (includeDemo || !campaignResult.data.is_demo) ? normalizeCampaign(campaignResult.data) : null,
    freelancers: withoutDemoRows((freelancersResult.data ?? []) as FreelancerRecommendationInput[], includeDemo),
    serviceRates: (serviceRatesResult.data ?? []) as ServiceRateInput[],
    shortlists: (shortlistsResult.data ?? []).map(normalizeShortlist),
    invites: (invitesResult.data ?? []).map(normalizeInvite),
    projects: projectsResult.data ?? [],
    productEvents
  };
}

async function getProductEvents(admin: NonNullable<ReturnType<typeof createAdminClient>>) {
  try {
    const { data } = await admin
      .from("product_events")
      .select("event_name, entity_type, entity_id, metadata, created_at")
      .order("created_at", { ascending: false })
      .limit(750);
    return (data ?? []) as RecommendationEventSignal[];
  } catch {
    return [];
  }
}

function withCreatorCompletedWork(creators: Creator[], deals: Deal[]) {
  return creators.map((creator) => ({
    ...creator,
    completed_deal_count: deals.filter((deal) => deal.creator_id === creator.id && isCompletedCreatorDeal(deal)).length
  }));
}

function withFreelancerCompletedWork(freelancers: FreelancerRecommendationInput[], projects: Array<Record<string, unknown>>) {
  return freelancers.map((freelancer) => ({
    ...freelancer,
    completed_project_count: projects.filter((project) => String(project.freelancer_id) === freelancer.id && isCompletedFreelancerProject(project)).length
  }));
}

function isCompletedCreatorDeal(deal: Deal) {
  return ["approved", "paid", "closed"].includes(deal.stage) || ["release_ready", "released"].includes(deal.payment_status);
}

function isCompletedFreelancerProject(project: Record<string, unknown>) {
  return ["approved", "completed", "closed"].includes(String(project.status)) ||
    ["release_ready", "released"].includes(String(project.payment_status)) ||
    String(project.deliverable_status) === "approved";
}

function normalizeCampaign(row: Record<string, unknown>): Campaign {
  return {
    id: String(row.id),
    is_demo: Boolean(row.is_demo ?? false),
    brand_id: row.brand_id ? String(row.brand_id) : null,
    profile_id: row.profile_id ? String(row.profile_id) : null,
    title: String(row.title ?? "Untitled campaign"),
    campaign_goal: String(row.campaign_goal ?? ""),
    budget_cents: Number(row.budget_cents ?? 0),
    city_focus: String(row.city_focus ?? ""),
    region_focus: String(row.region_focus ?? ""),
    campaign_length: String(row.campaign_length ?? ""),
    target_audience: String(row.target_audience ?? ""),
    platforms: toStringArray(row.platforms),
    creator_categories: toStringArray(row.creator_categories),
    freelancer_needs: toStringArray(row.freelancer_needs),
    languages: toStringArray(row.languages),
    visibility: String(row.visibility ?? "open"),
    status: String(row.status ?? "brief")
  };
}

function normalizeInvite(row: Record<string, unknown>): CampaignInvite {
  return {
    id: String(row.id),
    campaign_id: String(row.campaign_id),
    creator_id: String(row.creator_id),
    status: String(row.status ?? "invited")
  };
}

function normalizeShortlist(row: Record<string, unknown>): CampaignShortlist {
  return {
    id: String(row.id),
    campaign_id: String(row.campaign_id),
    entity_type: String(row.entity_type) as "creator" | "freelancer",
    entity_id: String(row.entity_id),
    fit_score: Number(row.fit_score ?? 0),
    reason: String(row.reason ?? ""),
    status: String(row.status ?? "shortlisted")
  };
}

function toStringArray(value: unknown) {
  if (Array.isArray(value)) return value.map(String);
  if (typeof value === "string" && value.trim()) return value.split(",").map((item) => item.trim()).filter(Boolean);
  return [];
}

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

async function persistRecommendationSnapshots(campaignId: string, creators: CampaignRecommendation[], freelancers: CampaignRecommendation[]) {
  const admin = createAdminClient();
  if (!admin) return;

  const rows = [
    ...creators.map((item) => snapshotRow(campaignId, "creator", item)),
    ...freelancers.map((item) => snapshotRow(campaignId, "freelancer", item))
  ];
  if (!rows.length) return;

  await admin
    .from("campaign_recommendation_snapshots")
    .upsert(rows, { onConflict: "campaign_id,entity_type,entity_id" });

  await upsertRecommendationLedgerRows(admin, [
    ...creators.map((item, index) => ({
      campaignId,
      entityType: "creator" as const,
      finalRank: index + 1,
      item,
      originalRank: index + 1
    })),
    ...freelancers.map((item, index) => ({
      campaignId,
      entityType: "freelancer" as const,
      finalRank: index + 1,
      item,
      originalRank: index + 1
    }))
  ]);
}

function snapshotRow(campaignId: string, entityType: "creator" | "freelancer", item: CampaignRecommendation) {
  return {
    campaign_id: campaignId,
    entity_type: entityType,
    entity_id: item.id,
    fit_score: item.score,
    score_breakdown: item.score_breakdown,
    roi_estimate: item.roi_estimate,
    watchouts: item.watchouts,
    match_type: item.match_type,
    best_use_case: item.best_use_case,
    expected_outcome: item.expected_outcome,
    risk_level: item.risk_level,
    proof_points: item.proof_points,
    reason: item.reason,
    updated_at: new Date().toISOString()
  };
}
