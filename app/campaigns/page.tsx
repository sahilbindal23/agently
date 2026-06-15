import Link from "next/link";
import { ClipboardList, Sparkles } from "lucide-react";
import { CreateCampaignForm } from "@/components/campaigns/create-campaign-form";
import { RecommendationCard } from "@/components/campaigns/recommendation-card";
import { AppShell } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, Td, Th } from "@/components/ui/table";
import { applyEventInformedRanking, rankCreators, rankFreelancers, type CampaignRecommendation, type FreelancerRecommendationInput, type RecommendationEventSignal, type ServiceRateInput } from "@/lib/campaigns/recommendations";
import { getCurrentUser } from "@/lib/auth/session";
import { canSeeDemoData, withoutDemoRows } from "@/lib/db/demo-visibility";
import { getAgentlyData, getCreatorMetricSnapshots } from "@/lib/db/live-data";
import { creatorAutomationDecision, freelancerAutomationDecision, isDiscoverable } from "@/lib/profile/automation";
import { createAdminClient } from "@/lib/supabase/admin";
import { formatCurrency } from "@/lib/utils/format";
import type { Campaign, CampaignShortlist } from "@/types";

export default async function CampaignsPage() {
  const user = await getCurrentUser();
  const includeDemo = canSeeDemoData(user);
  const [{ creators, creatorPlatforms, brands }, campaignData] = await Promise.all([
    getAgentlyData({ includeDemo }),
    getCampaignData(includeDemo, user)
  ]);
  const latestCampaign = campaignData.campaigns[0];
  const latestCampaignBrand = latestCampaign?.brand_id ? brands.find((brand) => brand.id === latestCampaign.brand_id) ?? null : null;
  const latestInvites = latestCampaign ? campaignData.invites.filter((invite) => invite.campaign_id === latestCampaign.id) : [];
  const creatorPool = latestCampaign?.visibility === "invite_only" && latestInvites.length
    ? creators.filter((creator) => latestInvites.some((invite) => invite.creator_id === creator.id))
    : creators;
  const eligibleCreators = creatorPool.filter((creator) => isDiscoverable(creatorAutomationDecision({
    creator: creator as unknown as Record<string, unknown>,
    platforms: creatorPlatforms.filter((platform) => platform.creator_id === creator.id) as unknown as Array<Record<string, unknown>>
  })));
  const eligibleFreelancers = campaignData.freelancers.filter((freelancer) => isDiscoverable(freelancerAutomationDecision({
    freelancer: freelancer as unknown as Record<string, unknown>,
    serviceRates: campaignData.serviceRates.filter((rate) => rate.freelancer_id === freelancer.id) as unknown as Array<Record<string, unknown>>
  })));
  const snapshots = await getCreatorMetricSnapshots(eligibleCreators.map((c) => c.id));
  const creatorRecommendations = latestCampaign
    ? applyEventInformedRanking(rankCreators(latestCampaign, eligibleCreators, creatorPlatforms, snapshots, latestCampaignBrand), "creator", campaignData.productEvents, latestCampaign.id).slice(0, 5)
    : [];
  const freelancerRecommendations = latestCampaign
    ? applyEventInformedRanking(rankFreelancers(latestCampaign, eligibleFreelancers, campaignData.serviceRates), "freelancer", campaignData.productEvents, latestCampaign.id).slice(0, 5)
    : [];

  return (
    <AppShell>
      <PageHeader
        eyebrow="Campaign brief engine"
        title="Campaigns"
        description="Brands create a brief first. Agently ranks creators and freelancers against campaign goals, city focus, audience, category, language, budget, and production needs."
        action={<Link className="inline-flex h-10 items-center gap-2 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground transition hover:bg-primary/90" href="#new-campaign"><ClipboardList className="h-4 w-4" /> New campaign</Link>}
      />

      <section className="grid gap-5 xl:grid-cols-[0.9fr_1.1fr]">
        <Card id="new-campaign" className="scroll-mt-24">
          <CardHeader>
            <div>
              <CardTitle>Create Campaign Brief</CardTitle>
              <p className="mt-1 text-sm text-muted-foreground">Use this before creating deals so matching is based on a campaign, not a blank marketplace search.</p>
            </div>
            <Badge tone="green">brand side</Badge>
          </CardHeader>
          <CreateCampaignForm creators={creators} />
        </Card>

        <Card>
          <CardHeader><CardTitle>Recent Campaigns</CardTitle><Badge tone="blue">{campaignData.campaigns.length}</Badge></CardHeader>
          <div className="overflow-x-auto">
            <Table>
              <thead><tr><Th>Campaign</Th><Th>Focus</Th><Th>Visibility</Th><Th>Length</Th><Th>Status</Th><Th className="text-right">Budget</Th></tr></thead>
              <tbody>
                {campaignData.campaigns.map((campaign) => (
                  <tr key={campaign.id}>
                    <Td><Link className="font-semibold text-primary" href={`/campaigns/${campaign.id}`}>{campaign.title}</Link></Td>
                    <Td>{campaign.city_focus || campaign.region_focus || "Flexible"}</Td>
                    <Td><Badge tone={campaign.visibility === "invite_only" ? "amber" : "green"}>{campaign.visibility.replace("_", " ")}</Badge></Td>
                    <Td>{campaign.campaign_length || "Not set"}</Td>
                    <Td><Badge>{campaign.status}</Badge></Td>
                    <Td className="text-right font-semibold">{formatCurrency(campaign.budget_cents, "inr")}</Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </div>
        </Card>
      </section>

      {latestCampaign ? (
        <section className="mt-5 grid gap-5 xl:grid-cols-2">
          <RecommendationColumn
            campaign={latestCampaign}
            recommendations={creatorRecommendations}
            shortlists={campaignData.shortlists}
            title="Recommended Creators"
            type="creator"
          />
          <RecommendationColumn
            campaign={latestCampaign}
            recommendations={freelancerRecommendations}
            shortlists={campaignData.shortlists}
            title="Recommended Freelancers"
            type="freelancer"
          />
        </section>
      ) : (
        <Card className="mt-5">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary/10 text-primary">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <p className="font-semibold">Create a campaign to unlock recommendations</p>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">Agently will rank both creators and freelancers once there is a real brief to match against.</p>
            </div>
          </div>
        </Card>
      )}
    </AppShell>
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

async function getCampaignData(includeDemo: boolean, user: Awaited<ReturnType<typeof getCurrentUser>>) {
  const admin = createAdminClient();
  if (!admin) {
    return { campaigns: [] as Campaign[], freelancers: [] as FreelancerRecommendationInput[], serviceRates: [] as ServiceRateInput[], shortlists: [] as CampaignShortlist[], invites: [] as { campaign_id: string; creator_id: string }[], productEvents: [] as RecommendationEventSignal[] };
  }

  const [campaignsResult, freelancersResult, serviceRatesResult, shortlistsResult, invitesResult, productEvents] = await Promise.all([
    admin.from("campaigns").select("*").order("created_at", { ascending: false }),
    admin.from("freelancers").select("*").order("created_at", { ascending: false }),
    admin.from("freelancer_service_rates").select("*"),
    admin.from("campaign_shortlists").select("*"),
    admin.from("campaign_invites").select("*"),
    getProductEvents(admin)
  ]);

  // Scope campaigns to the viewer's OWN briefs unless they're an admin.
  // Without this, every brand sees every other brand's campaign title, budget,
  // and focus in the "Recent Campaigns" list (cross-tenant leak). The detail
  // page is already guarded by canAccessCampaign; this closes the list view.
  let campaignRows = (campaignsResult.data ?? []) as Array<Record<string, unknown>>;
  if (user?.role !== "admin") {
    const brandIds = user ? await getBrandIdsForUser(admin, user.id, user.email) : [];
    campaignRows = user
      ? campaignRows.filter((c) =>
          String(c.profile_id ?? "") === user.id ||
          (Boolean(c.brand_id) && brandIds.includes(String(c.brand_id))))
      : [];
  }

  return {
    campaigns: withoutDemoRows(campaignRows.map(normalizeCampaign), includeDemo),
    freelancers: withoutDemoRows((freelancersResult.data ?? []) as FreelancerRecommendationInput[], includeDemo),
    serviceRates: (serviceRatesResult.data ?? []) as ServiceRateInput[],
    shortlists: (shortlistsResult.data ?? []).map(normalizeShortlist),
    invites: (invitesResult.data ?? []).map((row) => ({ campaign_id: String(row.campaign_id), creator_id: String(row.creator_id) })),
    productEvents
  };
}

async function getBrandIdsForUser(admin: NonNullable<ReturnType<typeof createAdminClient>>, profileId: string, email: string) {
  const [{ data: brands }, { data: audits }] = await Promise.all([
    admin.from("brands").select("id").eq("contact_email", email),
    admin.from("brand_audits").select("brand_id").eq("profile_id", profileId)
  ]);
  return Array.from(new Set([
    ...((brands ?? []).map((brand) => String(brand.id))),
    ...((audits ?? []).map((audit) => String(audit.brand_id)).filter(Boolean))
  ]));
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
