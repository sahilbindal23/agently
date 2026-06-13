import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { OfferComposerForm } from "@/components/campaigns/offer-composer-form";
import { AppShell } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { getCurrentUser } from "@/lib/auth/session";
import { canAccessCampaign } from "@/lib/auth/guards";
import { createAdminClient } from "@/lib/supabase/admin";
import { formatCurrency } from "@/lib/utils/format";
import type { Campaign, Creator } from "@/types";

export default async function OfferComposerPage({ params }: { params: Promise<{ id: string; creatorId: string }> }) {
  const { id, creatorId } = await params;
  // Only the campaign owner (or admin) may compose an offer from it — otherwise
  // a brand could read a competitor's campaign budget/audience via this page.
  const user = await getCurrentUser();
  if (!(await canAccessCampaign(user, id))) notFound();
  const data = await getOfferData(id, creatorId);
  if (!data.campaign || !data.creator) notFound();

  return (
    <AppShell>
      <PageHeader
        eyebrow="Offer composer"
        title={`Offer for ${data.creator.display_name}`}
        description="Confirm the commercial terms before this becomes a managed deal. This keeps campaign matching separate from real offers."
        action={<Link className="inline-flex h-10 items-center gap-2 rounded-md border bg-white px-4 text-sm font-medium dark:border-white/8 dark:bg-card" href={`/campaigns/${id}`}><ArrowLeft className="h-4 w-4" /> Back to campaign</Link>}
      />

      <section className="grid gap-5 xl:grid-cols-[0.8fr_1.2fr]">
        <Card>
          <CardHeader><CardTitle>Campaign Context</CardTitle><Badge tone={data.campaign.visibility === "invite_only" ? "amber" : "green"}>{data.campaign.visibility.replace("_", " ")}</Badge></CardHeader>
          <div className="space-y-3 text-sm leading-6">
            <Info label="Campaign" value={data.campaign.title} />
            <Info label="Budget" value={formatCurrency(data.campaign.budget_cents, "inr")} />
            <Info label="Audience" value={data.campaign.target_audience || "Not set"} />
            <Info label="Goal" value={data.campaign.campaign_goal || "Not set"} />
          </div>
        </Card>

        <Card>
          <CardHeader>
            <div>
              <CardTitle>Compose Offer</CardTitle>
              <p className="mt-1 text-sm text-muted-foreground">The brand can edit deliverables, amount, dates, usage, and approval terms before submitting.</p>
            </div>
            <Badge tone="blue">pre-deal</Badge>
          </CardHeader>
          <OfferComposerForm
            brandName={data.brandName}
            campaignId={data.campaign.id}
            campaignGoal={data.campaign.campaign_goal}
            campaignTitle={data.campaign.title}
            creatorId={data.creator.id}
            defaultAmountInr={Math.round(data.campaign.budget_cents / 100)}
          />
        </Card>
      </section>
    </AppShell>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border bg-white p-3 dark:border-white/8 dark:bg-card">
      <p className="text-xs font-semibold uppercase text-muted-foreground">{label}</p>
      <p className="mt-1">{value}</p>
    </div>
  );
}

async function getOfferData(campaignId: string, creatorId: string) {
  const admin = createAdminClient();
  if (!admin) return { campaign: null, creator: null, brandName: "Brand" };

  const [campaignResult, creatorResult] = await Promise.all([
    admin.from("campaigns").select("*").eq("id", campaignId).maybeSingle(),
    admin.from("creators").select("*").eq("id", creatorId).maybeSingle()
  ]);

  const campaign = campaignResult.data ? normalizeCampaign(campaignResult.data) : null;
  const creator = creatorResult.data ? normalizeCreator(creatorResult.data) : null;
  const brand = campaign?.brand_id
    ? await admin.from("brands").select("name").eq("id", campaign.brand_id).maybeSingle()
    : { data: null };

  return {
    campaign,
    creator,
    brandName: brand.data?.name ? String(brand.data.name) : "Brand"
  };
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

function normalizeCreator(row: Record<string, unknown>): Creator {
  return {
    id: String(row.id),
    display_name: String(row.display_name ?? "Creator"),
    primary_niche: String(row.primary_niche ?? ""),
    bio: String(row.bio ?? ""),
    country: String(row.country ?? ""),
    us_audience_percent: Number(row.us_audience_percent ?? 0),
    india_audience_percent: Number(row.india_audience_percent ?? 0),
    home_city: String(row.home_city ?? ""),
    languages: toStringArray(row.languages),
    top_indian_cities: toStringArray(row.top_indian_cities),
    audience_age_range: String(row.audience_age_range ?? ""),
    content_style: String(row.content_style ?? ""),
    prior_sponsor_categories: toStringArray(row.prior_sponsor_categories),
    monetization_score: Number(row.monetization_score ?? 0),
    valuation_score: Number(row.valuation_score ?? 0)
  };
}

function toStringArray(value: unknown) {
  if (Array.isArray(value)) return value.map(String);
  if (typeof value === "string" && value.trim()) return value.split(",").map((item) => item.trim()).filter(Boolean);
  return [];
}
