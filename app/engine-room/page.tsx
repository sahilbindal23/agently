import { redirect } from "next/navigation";
import { BrainCircuit, Calculator, ShieldCheck, SlidersHorizontal, Target } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, Td, Th } from "@/components/ui/table";
import { applyEventInformedRanking, rankCreators, rankFreelancers, type CampaignRecommendation, type FreelancerRecommendationInput, type RecommendationEventSignal, type ServiceRateInput } from "@/lib/campaigns/recommendations";
import { getCurrentUser } from "@/lib/auth/session";
import { getAgentlyData, getCreatorMetricSnapshots } from "@/lib/db/live-data";
import { enginePrinciples, engineWeights } from "@/lib/engines/math";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Campaign, CampaignInvite, CampaignShortlist } from "@/types";

export const dynamic = "force-dynamic";

export default async function EngineRoomPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  if (user.role !== "admin") {
    return (
      <AppShell>
        <PageHeader
          eyebrow="Engine governance"
          title="Engine Room"
          description="This page is reserved for Agently admins."
        />
        <Card>
          <p className="font-semibold">Admin access required</p>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">Engine calibration is internal because it controls marketplace trust, pricing, and recommendations.</p>
        </Card>
      </AppShell>
    );
  }

  const [{ creators, creatorPlatforms }, campaignData] = await Promise.all([getAgentlyData(), getCampaignData()]);
  const snapshots = await getCreatorMetricSnapshots(creators.map((c) => c.id));
  const latestCampaign = campaignData.campaigns[0];
  const creatorRecommendations = latestCampaign
    ? applyEventInformedRanking(rankCreators(latestCampaign, creators, creatorPlatforms, snapshots), "creator", campaignData.productEvents, latestCampaign.id).slice(0, 6)
    : [];
  const freelancerRecommendations = latestCampaign
    ? applyEventInformedRanking(rankFreelancers(latestCampaign, campaignData.freelancers, campaignData.serviceRates), "freelancer", campaignData.productEvents, latestCampaign.id).slice(0, 6)
    : [];

  return (
    <AppShell>
      <PageHeader
        eyebrow="Engine governance"
        title="Engine Room"
        description="Internal math notes, assumptions, score weights, and live score audits for the recommendation, valuation, verification, and payment protection engines."
      />

      <section className="mb-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <EngineMetric icon={<BrainCircuit className="h-4 w-4" />} label="Core engine" value="Recommendations" copy="Campaign fit, trust, behavior, and ROI signals." />
        <EngineMetric icon={<Calculator className="h-4 w-4" />} label="Pricing engine" value="INR bands" copy="Platform-specific base valuation. Usage rights, paid usage, and exclusivity negotiated case-by-case in the offer." />
        <EngineMetric icon={<ShieldCheck className="h-4 w-4" />} label="Trust engine" value="API + outcomes" copy="Social verification and completed Agently workflow signals." />
        <EngineMetric icon={<SlidersHorizontal className="h-4 w-4" />} label="Calibration mode" value="Read-only" copy="Weights are documented now; editable controls can come next." />
      </section>

      <section className="mb-5 grid gap-5 xl:grid-cols-[0.8fr_1.2fr]">
        <PrinciplesCard />
        <RecommendationWeightsCard />
      </section>

      <section className="mb-5 grid gap-5 xl:grid-cols-2">
        <FormulaCard
          description="Starting sponsor value bands for Indian creator deals. These should be calibrated as you collect Bangalore/India closed deal data."
          items={engineWeights.creatorValuation}
          title="Creator Valuation Formula"
        />
        <FormulaCard
          description="Commercial terms that should push price up or down before a creator accepts."
          items={engineWeights.valuationMultipliers}
          title="Valuation Multipliers"
        />
      </section>

      <section className="mb-5 grid gap-5 xl:grid-cols-2">
        <FormulaCard
          description="Anti-bot health score. Real engagement signals are harder to fake than audience numbers, so this dimension gets weight even though follower demographics are capped."
          items={engineWeights.engagementQuality}
          title="Engagement Quality (anti-bot)"
        />
        <FormulaCard description="Category demand assumptions used in pricing." items={engineWeights.categoryDemand} title="Category Demand" />
      </section>

      <section className="mb-5 grid gap-5 xl:grid-cols-2">
        <FormulaCard description="Trust and marketplace behavior boosts that make the engine self-improving." items={engineWeights.trustAndBehavior} title="Trust + Behavior" />
        <FormulaCard description="Signals used during creator and brand audit intake." items={engineWeights.auditSignals} title="Audit Signals" />
      </section>

      <section className="mb-5">
        <FormulaCard description="Prototype protection pricing assumptions. This is workflow protection positioning, not regulated insurance." items={engineWeights.protection} title="Payment Protection Assumptions" />
      </section>

      <section className="grid gap-5 xl:grid-cols-2">
        <ScoreAuditCard campaign={latestCampaign} recommendations={creatorRecommendations} shortlists={campaignData.shortlists} title="Creator Score Audit" type="creator" />
        <ScoreAuditCard campaign={latestCampaign} recommendations={freelancerRecommendations} shortlists={campaignData.shortlists} title="Freelancer Score Audit" type="freelancer" />
      </section>
    </AppShell>
  );
}

function EngineMetric({ copy, icon, label, value }: { copy: string; icon: React.ReactNode; label: string; value: string }) {
  return (
    <Card className="p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">{label}</p>
        <span className="text-primary">{icon}</span>
      </div>
      <p className="mt-3 text-xl font-bold tracking-normal">{value}</p>
      <p className="mt-2 text-sm leading-5 text-muted-foreground">{copy}</p>
    </Card>
  );
}

function PrinciplesCard() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Engine Principles</CardTitle>
        <Badge tone="green">governance</Badge>
      </CardHeader>
      <div className="grid gap-2">
        {enginePrinciples.map((principle) => (
          <div className="flex gap-3 rounded-md border bg-white p-3" key={principle}>
            <Target className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
            <p className="text-sm leading-6">{principle}</p>
          </div>
        ))}
      </div>
    </Card>
  );
}

function RecommendationWeightsCard() {
  const total = engineWeights.campaignRecommendation.reduce((sum, item) => sum + item.weight, 0);
  return (
    <Card>
      <CardHeader>
        <CardTitle>Campaign Recommendation Weights</CardTitle>
        <Badge tone={Math.abs(total - 1) < 0.001 ? "green" : "amber"}>{Math.round(total * 100)}%</Badge>
      </CardHeader>
      <div className="grid gap-3">
        {engineWeights.campaignRecommendation.map((item) => (
          <div className="rounded-md border bg-white p-3" key={item.key}>
            <div className="mb-2 flex items-center justify-between gap-3">
              <p className="text-sm font-semibold">{item.label}</p>
              <Badge tone="blue">{Math.round(item.weight * 100)}%</Badge>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-muted">
              <div className="h-full rounded-full bg-primary" style={{ width: `${item.weight * 100}%` }} />
            </div>
            <p className="mt-2 text-sm leading-5 text-muted-foreground">{item.description}</p>
          </div>
        ))}
      </div>
    </Card>
  );
}

function FormulaCard({
  description,
  items,
  title
}: {
  description: string;
  items: Array<{ description: string; formula?: string; label: string; value?: string }>;
  title: string;
}) {
  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>{title}</CardTitle>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">{description}</p>
        </div>
        <Badge tone="blue">{items.length}</Badge>
      </CardHeader>
      <div className="grid gap-2">
        {items.map((item) => (
          <div className="rounded-md border bg-white p-3" key={item.label}>
            <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-semibold">{item.label}</p>
              <Badge tone="neutral">{item.formula ?? item.value}</Badge>
            </div>
            <p className="text-sm leading-5 text-muted-foreground">{item.description}</p>
          </div>
        ))}
      </div>
    </Card>
  );
}

function ScoreAuditCard({
  campaign,
  recommendations,
  shortlists,
  title,
  type
}: {
  campaign?: Campaign;
  recommendations: CampaignRecommendation[];
  shortlists: CampaignShortlist[];
  title: string;
  type: "creator" | "freelancer";
}) {
  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>{title}</CardTitle>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">
            {campaign ? `Live audit against ${campaign.title}.` : "Create a campaign to generate live score audits."}
          </p>
        </div>
        <Badge tone="green">{recommendations.length}</Badge>
      </CardHeader>
      <div className="overflow-x-auto">
        <Table>
          <thead>
            <tr>
              <Th>Talent</Th>
              <Th>Final</Th>
              <Th>Strongest</Th>
              <Th>Weakest</Th>
              <Th>Behavior</Th>
            </tr>
          </thead>
          <tbody>
            {recommendations.map((item) => {
              const entries = scoreEntries(item);
              const strongest = [...entries].sort((a, b) => b.value - a.value)[0];
              const weakest = [...entries].sort((a, b) => a.value - b.value)[0];
              const shortlisted = shortlists.some((shortlist) => shortlist.entity_type === type && shortlist.entity_id === item.id);
              return (
                <tr key={item.id}>
                  <Td className="min-w-52">
                    <p className="font-medium">{item.name}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{item.match_type}</p>
                  </Td>
                  <Td><Badge tone={item.score >= 80 ? "green" : item.score >= 60 ? "amber" : "red"}>{item.score}</Badge></Td>
                  <Td>{strongest.label}: {strongest.value}</Td>
                  <Td>{weakest.label}: {weakest.value}</Td>
                  <Td className="min-w-56">
                    <div className="flex flex-wrap gap-1.5">
                      {shortlisted ? <Badge tone="green">shortlisted</Badge> : null}
                      {(item.marketplace_signals ?? []).map((signal) => <Badge key={signal} tone="blue">{signal}</Badge>)}
                      {!shortlisted && !item.marketplace_signals?.length ? <Badge tone="neutral">no behavior signal</Badge> : null}
                    </div>
                  </Td>
                </tr>
              );
            })}
            {!recommendations.length ? (
              <tr>
                <Td colSpan={5} className="text-muted-foreground">No recommendations available yet.</Td>
              </tr>
            ) : null}
          </tbody>
        </Table>
      </div>
    </Card>
  );
}

function scoreEntries(item: CampaignRecommendation) {
  return Object.entries(item.score_breakdown).map(([key, value]) => ({
    label: key.replaceAll("_", " "),
    value
  }));
}

async function getCampaignData() {
  const admin = createAdminClient();
  if (!admin) {
    return {
      campaigns: [] as Campaign[],
      freelancers: [] as FreelancerRecommendationInput[],
      invites: [] as CampaignInvite[],
      productEvents: [] as RecommendationEventSignal[],
      serviceRates: [] as ServiceRateInput[],
      shortlists: [] as CampaignShortlist[]
    };
  }

  const [campaignsResult, freelancersResult, serviceRatesResult, shortlistsResult, invitesResult, productEvents] = await Promise.all([
    admin.from("campaigns").select("*").order("created_at", { ascending: false }),
    admin.from("freelancers").select("*").order("created_at", { ascending: false }),
    admin.from("freelancer_service_rates").select("*"),
    admin.from("campaign_shortlists").select("*"),
    admin.from("campaign_invites").select("*"),
    getProductEvents(admin)
  ]);

  return {
    campaigns: (campaignsResult.data ?? []).map(normalizeCampaign),
    freelancers: (freelancersResult.data ?? []) as FreelancerRecommendationInput[],
    invites: (invitesResult.data ?? []).map(normalizeInvite),
    productEvents,
    serviceRates: (serviceRatesResult.data ?? []) as ServiceRateInput[],
    shortlists: (shortlistsResult.data ?? []).map(normalizeShortlist)
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

function normalizeCampaign(row: Record<string, unknown>): Campaign {
  return {
    id: String(row.id),
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
