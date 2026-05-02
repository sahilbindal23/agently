import Link from "next/link";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, Td, Th } from "@/components/ui/table";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { formatCurrency, formatNumber } from "@/lib/utils/format";

type CampaignRow = {
  id: string;
  title: string;
  campaign_goal?: string;
  budget_cents?: number;
  city_focus?: string;
  region_focus?: string;
  status?: string;
};

type DealRow = {
  id: string;
  campaign_id?: string | null;
  title: string;
  amount_cents: number;
  currency?: string;
  offer_status?: string;
  payment_status?: string;
  deliverable_status?: string;
};

type ProjectRow = {
  id: string;
  campaign_id?: string | null;
  title: string;
  amount_cents: number;
  currency?: string;
  status?: string;
  payment_status?: string;
  deliverable_status?: string;
};

type SnapshotRow = {
  id: string;
  campaign_id: string;
  entity_type: "creator" | "freelancer";
  fit_score: number;
  reason?: string;
  roi_estimate?: {
    expected_reach?: number;
    expected_engagements?: number;
    estimated_cpm_cents?: number;
    estimated_cpe_cents?: number;
    confidence_score?: number;
  };
  watchouts?: string[];
};

type DeliverableRow = {
  id: string;
  deal_id?: string | null;
  freelancer_project_id?: string | null;
  status?: string;
};

export default async function BrandInsightsPage() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect("/login");

  const admin = createAdminClient();
  if (!admin) redirect("/brand-home");

  const { data: brands } = await admin.from("brands").select("*").eq("contact_email", data.user.email ?? "");
  const brandIds = (brands ?? []).map((brand) => String(brand.id));
  const [{ data: campaigns }, { data: deals }, { data: projects }, { data: snapshots }] = await Promise.all([
    admin.from("campaigns").select("*").eq("profile_id", data.user.id).order("created_at", { ascending: false }),
    brandIds.length ? admin.from("deals").select("*").in("brand_id", brandIds).order("created_at", { ascending: false }) : { data: [] },
    brandIds.length ? admin.from("freelancer_projects").select("*").in("brand_id", brandIds).order("created_at", { ascending: false }) : { data: [] },
    admin.from("campaign_recommendation_snapshots").select("*").order("updated_at", { ascending: false }).limit(50)
  ]);

  const campaignRows = (campaigns ?? []) as CampaignRow[];
  const dealRows = (deals ?? []) as DealRow[];
  const projectRows = (projects ?? []) as ProjectRow[];
  const snapshotRows = (snapshots ?? []) as SnapshotRow[];
  const deliverables = await getDeliverables(dealRows.map((deal) => deal.id), projectRows.map((project) => project.id));

  const acceptedDeals = dealRows.filter((deal) => deal.offer_status === "accepted");
  const acceptedProjects = projectRows.filter((project) => project.status === "accepted");
  const activeSpend = [...dealRows, ...projectRows].reduce((sum, item) => sum + Number(item.amount_cents ?? 0), 0);
  const approvedDeliverables = deliverables.filter((item) => item.status === "approved").length;
  const submittedDeliverables = deliverables.filter((item) => item.status === "submitted").length;
  const releaseReady = [...dealRows, ...projectRows].filter((item) => item.payment_status === "release_ready").length;
  const estimatedReach = snapshotRows.reduce((sum, snapshot) => sum + Number(snapshot.roi_estimate?.expected_reach ?? 0), 0);
  const estimatedEngagements = snapshotRows.reduce((sum, snapshot) => sum + Number(snapshot.roi_estimate?.expected_engagements ?? 0), 0);
  const blendedCpm = estimatedReach ? Math.round((activeSpend / estimatedReach) * 1000) : 0;
  const avgFit = average(snapshotRows.map((snapshot) => Number(snapshot.fit_score ?? 0)));
  const campaignsWithInsights = campaignRows.map((campaign) => campaignInsight(campaign, dealRows, projectRows, snapshotRows, deliverables));

  return (
    <AppShell>
      <PageHeader
        eyebrow="Brand-safe intelligence"
        title="Campaign Insights"
        description="One place for brand teams to track campaign briefs, creator offers, freelancer production, deliverables, payment readiness, and early ROI signals."
        action={<Link href="/campaigns"><Button>Create campaign</Button></Link>}
      />

      <section className="grid gap-4 md:grid-cols-4">
        <Metric label="Active campaign spend" value={formatCurrency(activeSpend, "inr")} />
        <Metric label="Accepted talent" value={`${acceptedDeals.length + acceptedProjects.length}`} />
        <Metric label="Deliverables in review" value={`${submittedDeliverables}`} />
        <Metric label="Payment release queue" value={`${releaseReady}`} />
      </section>

      <section className="mt-5 grid gap-4 md:grid-cols-4">
        <Metric label="Projected reach" value={formatNumber(estimatedReach)} />
        <Metric label="Projected engagements" value={formatNumber(estimatedEngagements)} />
        <Metric label="Blended est. CPM" value={blendedCpm ? formatCurrency(blendedCpm, "inr") : "-"} />
        <Metric label="Avg recommendation fit" value={`${Math.round(avgFit) || 0}/100`} />
      </section>

      <section className="mt-5 grid gap-5 xl:grid-cols-[1.1fr_0.9fr]">
        <Card>
          <CardHeader><CardTitle>Campaign Performance Console</CardTitle><Badge tone="green">{campaignRows.length} briefs</Badge></CardHeader>
          <div className="overflow-x-auto">
            <Table>
              <thead>
                <tr>
                  <Th>Campaign</Th>
                  <Th>Talent</Th>
                  <Th>Deliverables</Th>
                  <Th>Payment</Th>
                  <Th>Fit</Th>
                  <Th className="text-right">Spend</Th>
                </tr>
              </thead>
              <tbody>
                {campaignsWithInsights.map((item) => (
                  <tr key={item.id}>
                    <Td>
                      <Link className="font-semibold text-primary" href={`/campaigns/${item.id}`}>{item.title}</Link>
                      <p className="mt-1 text-xs text-muted-foreground">{item.focus}</p>
                    </Td>
                    <Td>{item.acceptedTalent}/{item.totalTalent} accepted</Td>
                    <Td><Badge tone={item.deliverablesApproved ? "green" : item.deliverablesSubmitted ? "amber" : "neutral"}>{item.deliverableLabel}</Badge></Td>
                    <Td><Badge tone={item.releaseReady ? "green" : item.funded ? "blue" : "amber"}>{item.paymentLabel}</Badge></Td>
                    <Td>{Math.round(item.avgFit) || 0}/100</Td>
                    <Td className="text-right font-semibold">{formatCurrency(item.spendCents, "inr")}</Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </div>
        </Card>

        <Card>
          <CardHeader><CardTitle>ROI Signals</CardTitle><Badge tone="blue">directional</Badge></CardHeader>
          <div className="space-y-3">
            <InsightLine label="Reach model" value={estimatedReach ? `${formatNumber(estimatedReach)} estimated impressions/views from ranked creator matches.` : "Open a campaign detail page to generate recommendation snapshots."} />
            <InsightLine label="Engagement model" value={estimatedEngagements ? `${formatNumber(estimatedEngagements)} expected engagements based on captured average views and engagement rate.` : "Engagement confidence improves as creators connect richer platform data."} />
            <InsightLine label="Spend check" value={blendedCpm ? `Current projected CPM is ${formatCurrency(blendedCpm, "inr")}. Use this as an early planning check, not final ROI proof.` : "Projected CPM appears once campaign spend and reach estimates exist."} />
            <InsightLine label="Protection check" value={`${submittedDeliverables} deliverables await review and ${approvedDeliverables} have been approved for payout logic.`} />
          </div>
        </Card>
      </section>

      <section className="mt-5 grid gap-5 xl:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Recommendation Quality</CardTitle><Badge tone="blue">{Math.round(avgFit) || 0}/100 avg fit</Badge></CardHeader>
          <div className="space-y-3">
            {snapshotRows.slice(0, 6).map((snapshot) => (
              <div className="rounded-md border bg-white p-3" key={snapshot.id}>
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-semibold">{snapshot.entity_type} recommendation</p>
                  <Badge tone={Number(snapshot.fit_score) >= 80 ? "green" : "amber"}>{snapshot.fit_score}</Badge>
                </div>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">{snapshot.reason}</p>
                {(snapshot.watchouts ?? []).slice(0, 2).map((watchout) => (
                  <p className="mt-2 text-xs text-amber-700" key={watchout}>{watchout}</p>
                ))}
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <CardHeader><CardTitle>Operating Notes</CardTitle><Badge>prototype moat</Badge></CardHeader>
          <div className="space-y-3">
            <InsightLine label="What Agently learns" value="Recommendation scores, acceptance rates, delivery speed, revision patterns, payout readiness, and projected reach are now tied into one brand-facing view." />
            <InsightLine label="Why this matters" value="This moves the product away from a simple listing marketplace and toward a campaign operating system brands can trust after launch." />
            <InsightLine label="Next data upgrade" value="After real campaigns, replace projected ROI with actual post metrics, discount-code sales, UTM clicks, and payout dispute outcomes." />
          </div>
        </Card>
      </section>
    </AppShell>
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

function InsightLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border bg-white p-3">
      <p className="text-xs font-semibold uppercase text-muted-foreground">{label}</p>
      <p className="mt-1 text-sm leading-6">{value}</p>
    </div>
  );
}

function campaignInsight(campaign: CampaignRow, deals: DealRow[], projects: ProjectRow[], snapshots: SnapshotRow[], deliverables: DeliverableRow[]) {
  const campaignDeals = deals.filter((deal) => deal.campaign_id === campaign.id);
  const campaignProjects = projects.filter((project) => project.campaign_id === campaign.id);
  const campaignSnapshots = snapshots.filter((snapshot) => snapshot.campaign_id === campaign.id);
  const dealIds = new Set(campaignDeals.map((deal) => deal.id));
  const projectIds = new Set(campaignProjects.map((project) => project.id));
  const campaignDeliverables = deliverables.filter((deliverable) =>
    (deliverable.deal_id && dealIds.has(deliverable.deal_id)) ||
    (deliverable.freelancer_project_id && projectIds.has(deliverable.freelancer_project_id))
  );
  const acceptedTalent = campaignDeals.filter((deal) => deal.offer_status === "accepted").length + campaignProjects.filter((project) => project.status === "accepted").length;
  const totalTalent = campaignDeals.length + campaignProjects.length;
  const deliverablesApproved = campaignDeliverables.filter((deliverable) => deliverable.status === "approved").length;
  const deliverablesSubmitted = campaignDeliverables.filter((deliverable) => deliverable.status === "submitted").length;
  const releaseReady = [...campaignDeals, ...campaignProjects].filter((item) => item.payment_status === "release_ready").length;
  const funded = [...campaignDeals, ...campaignProjects].filter((item) => item.payment_status === "funded").length;

  return {
    id: campaign.id,
    title: campaign.title,
    focus: campaign.city_focus || campaign.region_focus || campaign.campaign_goal || "Flexible",
    acceptedTalent,
    totalTalent,
    deliverablesApproved,
    deliverablesSubmitted,
    deliverableLabel: deliverablesApproved ? `${deliverablesApproved} approved` : deliverablesSubmitted ? `${deliverablesSubmitted} in review` : "not submitted",
    releaseReady,
    funded,
    paymentLabel: releaseReady ? `${releaseReady} release ready` : funded ? `${funded} funded` : "not funded",
    avgFit: average(campaignSnapshots.map((snapshot) => Number(snapshot.fit_score ?? 0))),
    spendCents: [...campaignDeals, ...campaignProjects].reduce((sum, item) => sum + Number(item.amount_cents ?? 0), 0)
  };
}

async function getDeliverables(dealIds: string[], projectIds: string[]) {
  const admin = createAdminClient();
  if (!admin) return [] as DeliverableRow[];

  try {
    const [dealDeliverables, projectDeliverables] = await Promise.all([
      dealIds.length ? admin.from("deliverables").select("*").in("deal_id", dealIds) : { data: [] },
      projectIds.length ? admin.from("deliverables").select("*").in("freelancer_project_id", projectIds) : { data: [] }
    ]);
    return ([...(dealDeliverables.data ?? []), ...(projectDeliverables.data ?? [])] as DeliverableRow[]);
  } catch {
    return [];
  }
}

function average(values: number[]) {
  const filtered = values.filter(Boolean);
  return filtered.length ? filtered.reduce((sum, value) => sum + value, 0) / filtered.length : 0;
}
