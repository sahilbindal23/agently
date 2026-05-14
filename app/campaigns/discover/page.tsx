import Link from "next/link";
import { redirect } from "next/navigation";
import { Briefcase, Search } from "lucide-react";
import { ApplyToCampaignButton } from "@/components/campaigns/apply-to-campaign-button";
import { AppShell } from "@/components/layout/app-shell";
import { EmptyState } from "@/components/layout/empty-state";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { getCurrentUser } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { formatCurrency } from "@/lib/utils/format";

export const dynamic = "force-dynamic";

type CampaignRow = {
  id: string;
  title: string;
  campaign_goal: string | null;
  budget_cents: number | null;
  city_focus: string | null;
  region_focus: string | null;
  campaign_length: string | null;
  target_audience: string | null;
  platforms: string[] | null;
  creator_categories: string[] | null;
  languages: string[] | null;
  brand_id: string | null;
  created_at: string;
};

type BrandRow = { id: string; name: string | null; industry: string | null };

export default async function DiscoverCampaignsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  // Brand and admin land on /campaigns (their own management view). This
  // page is the creator/freelancer-facing discovery board.
  if (user.role === "brand") redirect("/campaigns");

  const admin = createAdminClient();
  if (!admin) redirect("/creator-home");

  // Fetch open campaigns + their brand info + creator's existing
  // applications so we can mark the ones they already applied to.
  const [{ data: campaigns }, { data: brands }, creatorRecord] = await Promise.all([
    admin
      .from("campaigns")
      .select("id, title, campaign_goal, budget_cents, city_focus, region_focus, campaign_length, target_audience, platforms, creator_categories, languages, brand_id, created_at")
      .eq("visibility", "open")
      .order("created_at", { ascending: false })
      .limit(60),
    admin.from("brands").select("id, name, industry"),
    admin.from("creators").select("id").eq("profile_id", user.id).maybeSingle()
  ]);

  const creatorId = creatorRecord.data?.id ? String(creatorRecord.data.id) : null;
  const applications = creatorId
    ? (await admin
        .from("campaign_invites")
        .select("campaign_id, status, source")
        .eq("creator_id", creatorId)).data ?? []
    : [];

  const applicationByCampaign = new Map<string, { status: string; source: string }>();
  for (const row of applications) {
    applicationByCampaign.set(String(row.campaign_id), {
      status: String(row.status ?? ""),
      source: String(row.source ?? "")
    });
  }

  const brandsById = new Map<string, BrandRow>();
  for (const brand of brands ?? []) {
    brandsById.set(String(brand.id), brand as BrandRow);
  }

  const openCampaigns = ((campaigns ?? []) as CampaignRow[]);

  return (
    <AppShell>
      <PageHeader
        eyebrow="Campaign discovery"
        title="Open campaigns"
        description="Brands looking for creators right now. Apply directly — the brand sees your application on their campaign dashboard and can send an offer."
      />

      {openCampaigns.length === 0 ? (
        <EmptyState
          icon={<Search className="h-6 w-6" />}
          title="No open campaigns right now"
          description="Brands haven&apos;t posted any public campaigns at the moment. Check back soon — and make sure your profile is complete so brands find you when they do post."
          actions={[
            { label: "Complete profile", href: "/profile" },
            { label: "Back home", href: user.role === "freelancer" ? "/freelancer-home" : "/creator-home", variant: "secondary" }
          ]}
        />
      ) : (
        <section className="grid gap-4 lg:grid-cols-2">
          {openCampaigns.map((campaign) => {
            const brand = campaign.brand_id ? brandsById.get(String(campaign.brand_id)) : null;
            const existing = applicationByCampaign.get(campaign.id);
            return (
              <Card key={campaign.id}>
                <CardHeader>
                  <div>
                    <CardTitle>{campaign.title}</CardTitle>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {brand?.name ?? "Brand"}{brand?.industry ? ` · ${brand.industry}` : ""}
                      {campaign.city_focus ? ` · ${campaign.city_focus}` : ""}
                    </p>
                  </div>
                  <Badge tone="blue">{campaign.campaign_length || "Open brief"}</Badge>
                </CardHeader>

                {campaign.campaign_goal ? (
                  <p className="text-sm leading-6 text-muted-foreground">{campaign.campaign_goal}</p>
                ) : null}

                <div className="mt-3 grid gap-2 text-xs sm:grid-cols-2">
                  <Detail label="Budget" value={campaign.budget_cents ? formatCurrency(campaign.budget_cents, "inr") : "Not specified"} />
                  <Detail label="Region" value={campaign.region_focus || campaign.city_focus || "India"} />
                  <Detail label="Target audience" value={campaign.target_audience || "Open"} />
                  <Detail label="Languages" value={(campaign.languages ?? []).join(", ") || "Any"} />
                </div>

                {(campaign.creator_categories ?? []).length || (campaign.platforms ?? []).length ? (
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {(campaign.creator_categories ?? []).slice(0, 6).map((cat) => (
                      <Badge key={`cat-${cat}`} tone="neutral">{cat}</Badge>
                    ))}
                    {(campaign.platforms ?? []).slice(0, 4).map((platform) => (
                      <Badge key={`plat-${platform}`} tone="green">{platform}</Badge>
                    ))}
                  </div>
                ) : null}

                <div className="mt-4 flex flex-wrap items-center gap-2">
                  {creatorId ? (
                    <ApplyToCampaignButton
                      campaignId={campaign.id}
                      existing={existing}
                    />
                  ) : (
                    <Link
                      className="inline-flex h-9 items-center gap-2 rounded-md border bg-white px-4 text-sm font-medium hover:bg-muted dark:border-white/10 dark:bg-card"
                      href="/intake"
                    >
                      Complete intake to apply
                    </Link>
                  )}
                  <span className="text-xs text-muted-foreground">Posted {new Date(campaign.created_at).toLocaleDateString("en-IN")}</span>
                </div>
              </Card>
            );
          })}
        </section>
      )}

      <Card className="mt-5 border-blue-200 bg-blue-50/40 dark:border-sky-900/50 dark:bg-sky-950/20">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-blue-900 dark:text-sky-200">
            <Briefcase className="h-4 w-4" />
            How applications work
          </CardTitle>
        </CardHeader>
        <ul className="grid gap-2 text-sm leading-6 text-blue-900/80 dark:text-sky-100/80">
          <li>Apply with one click — no separate form. Brands see your profile, social metrics, and verified status.</li>
          <li>If the brand wants to move forward, they send a formal offer to your /offers inbox.</li>
          <li>Invite-only campaigns don&apos;t show up here — only brand-initiated for those.</li>
          <li>The more complete your profile (Phyllo-verified socials, India audience %, niche), the more competitive your application.</li>
        </ul>
      </Card>
    </AppShell>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md bg-muted px-3 py-2">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-0.5 font-medium">{value}</p>
    </div>
  );
}
