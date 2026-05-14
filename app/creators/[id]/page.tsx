import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { BarChart3, PlaySquare, ShieldCheck, Sparkles, Target } from "lucide-react";
import { CreatorReauditPanel } from "@/components/creators/creator-reaudit-panel";
import { AppShell } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/layout/page-header";
import { MessageRecipientButton } from "@/components/messages/message-recipient-button";
import { AgentlySignalCard } from "@/components/profile/agently-signal-card";
import { SocialTrustBadge } from "@/components/social/social-trust-badge";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, Td, Th } from "@/components/ui/table";
import { VerificationBadge } from "@/components/verification/verification-badge";
import { getCurrentUser } from "@/lib/auth/session";
import { getCreatorBundle } from "@/lib/db/live-data";
import { getCreatorLanguages, getIndiaAudiencePercent } from "@/lib/utils/creator-metrics";
import { formatCurrency, formatNumber, formatPercent } from "@/lib/utils/format";

export default async function CreatorDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [bundle, currentUser] = await Promise.all([getCreatorBundle(id), getCurrentUser()]);
  if (!bundle.creator) notFound();
  const isOwnProfile = bundle.creator.profile_id === currentUser?.id;
  const primaryPlatform = [...bundle.platforms].sort((a, b) => b.avg_views - a.avg_views)[0];
  const latestValuation = bundle.valuations[0];
  const bestFor = getCreatorBestFor(bundle.creator.primary_niche, bundle.creator.content_style);
  const pastBrandDeals = bundle.deals.filter((deal) => ["approved", "paid", "closed", "delivered", "live"].includes(deal.stage));

  return (
    <AppShell>
      <PageHeader
        eyebrow="Creator profile"
        title={bundle.creator.display_name}
        description={bundle.creator.bio}
        action={isOwnProfile ? undefined : <MessageRecipientButton entityId={bundle.creator.id} entityType="creator" label="Message creator" />}
      />
      <section className="grid gap-5 xl:grid-cols-[0.9fr_1.2fr]">
        <Card>
          <CardHeader>
            <CardTitle>Talent Snapshot</CardTitle>
            <div className="flex flex-wrap gap-2">
              <Badge tone="green">{bundle.creator.primary_niche}</Badge>
              <VerificationBadge status={bundle.creator.verification_status} tier={bundle.creator.verification_tier} />
              <SocialTrustBadge source={primaryPlatform?.metric_source} compact />
            </div>
          </CardHeader>
          {bundle.creator.image_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img alt={bundle.creator.display_name} className="mb-4 aspect-[4/3] w-full rounded-md object-cover" src={bundle.creator.image_url} />
          ) : null}
          {/* Public score panel. City fit removed — kept internally for
              campaign-specific recommendation ranking, not surfaced here. */}
          <div className="grid grid-cols-3 gap-4">
            <Score label="Monetization" value={bundle.creator.monetization_score} />
            <Score label="Valuation" value={bundle.creator.valuation_score} />
            <Score label="India audience" value={getIndiaAudiencePercent(bundle.creator)} suffix="%" />
          </div>
          <div className="mt-4 rounded-md border bg-white p-4 dark:border-white/8 dark:bg-card text-sm leading-6 text-muted-foreground">
            <p><span className="font-semibold text-foreground">Home city:</span> {bundle.creator.home_city || "Not captured"}</p>
            <p><span className="font-semibold text-foreground">Languages:</span> {getCreatorLanguages(bundle.creator)}</p>
            <p><span className="font-semibold text-foreground">Top Indian cities:</span> {bundle.creator.top_indian_cities.join(", ") || "Not captured"}</p>
          </div>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Audience Snapshot</CardTitle>
            <Badge tone="blue">{primaryPlatform?.platform ?? "platforms"}</Badge>
          </CardHeader>
          <div className="mb-4 grid gap-3 md:grid-cols-3">
            <Insight label="Largest audience" value={primaryPlatform ? formatNumber(primaryPlatform.followers) : "Not captured"} />
            <Insight label="Avg views" value={primaryPlatform ? formatNumber(primaryPlatform.avg_views) : "Not captured"} />
            <Insight label="Engagement" value={primaryPlatform ? formatPercent(primaryPlatform.engagement_rate) : "Not captured"} />
          </div>
          <div className="overflow-x-auto">
            <Table>
              <thead><tr><Th>Platform</Th><Th>Handle</Th><Th>Followers</Th><Th>Avg views</Th><Th>Engagement</Th><Th>Metric trust</Th></tr></thead>
              <tbody>
                {bundle.platforms.map((platform) => (
                  <tr key={platform.id}>
                    <Td className="font-medium">{platform.platform}</Td>
                    <Td>{platform.handle}</Td>
                    <Td>{formatNumber(platform.followers)}</Td>
                    <Td>{formatNumber(platform.avg_views)}</Td>
                    <Td>{formatPercent(platform.engagement_rate)}</Td>
                    <Td><SocialTrustBadge source={platform.metric_source} compact /></Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </div>
        </Card>
      </section>

      <section className="mt-5 grid gap-5 xl:grid-cols-3">
        <ProofCard
          icon={<Target className="h-4 w-4" />}
          title="Best For"
          items={bestFor}
        />
        <ProofCard
          icon={<Sparkles className="h-4 w-4" />}
          title="Niche Proof"
          items={[
            bundle.creator.content_style || `Consistent ${bundle.creator.primary_niche} positioning`,
            `${getIndiaAudiencePercent(bundle.creator)}% India audience signal`,
            bundle.creator.languages.length ? `Creates in ${bundle.creator.languages.slice(0, 3).join(", ")}` : "Languages not captured"
          ]}
        />
        <ProofCard
          icon={<ShieldCheck className="h-4 w-4" />}
          title="Rate Guidance"
          items={latestValuation ? [
            `Base sponsor estimate: ${formatCurrency(latestValuation.base_estimate_cents, "inr")}`,
            `Range: ${formatCurrency(latestValuation.low_estimate_cents, "inr")} - ${formatCurrency(latestValuation.high_estimate_cents, "inr")}`,
            latestValuation.package_recommendation
          ] : [
            "Run Sponsor Growth Calculator for rate guidance",
            "Use average views, audience location, and engagement rate",
            "Confirm usage rights and deliverables before accepting"
          ]}
        />
      </section>

      <Card className="mt-5">
        <CardHeader>
          <CardTitle>Recent Content Showcase</CardTitle>
          <Badge tone="blue">{bundle.platforms.length} channels</Badge>
        </CardHeader>
        <div className="grid gap-3 md:grid-cols-3">
          {bundle.platforms.slice(0, 3).map((platform) => (
            <div className="rounded-md border bg-white p-4 dark:border-white/8 dark:bg-card" key={platform.id}>
              <div className="mb-3 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <PlaySquare className="h-4 w-4 text-primary" />
                  <p className="font-semibold">{platform.platform}</p>
                </div>
                <Badge>{platform.posting_frequency}</Badge>
              </div>
              <p className="text-sm text-muted-foreground">{platform.handle}</p>
              <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                <Insight label="Followers" value={formatNumber(platform.followers)} />
                <Insight label="Avg views" value={formatNumber(platform.avg_views)} />
              </div>
              {platform.url ? <a className="mt-3 inline-flex text-sm font-medium text-primary" href={platform.url} target="_blank">Open social profile</a> : null}
            </div>
          ))}
        </div>
      </Card>

      <section className="mt-5 grid gap-5 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader><CardTitle>Past Brand Work</CardTitle><Badge tone="green">{pastBrandDeals.length || bundle.deals.length}</Badge></CardHeader>
          <div className="space-y-3">
            {(pastBrandDeals.length ? pastBrandDeals : bundle.deals).slice(0, 5).map((deal) => (
              <div key={deal.id} className="flex flex-col gap-2 rounded-md border bg-white p-3 sm:flex-row dark:border-white/8 dark:bg-card sm:items-center sm:justify-between">
                <div>
                  <p className="font-semibold">{deal.title}</p>
                  <p className="text-sm text-muted-foreground">{deal.deliverables}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge>{deal.stage}</Badge>
                </div>
              </div>
            ))}
            {bundle.deals.length === 0 ? <p className="text-sm leading-6 text-muted-foreground">No brand work has been recorded yet.</p> : null}
          </div>
        </Card>

        <AgentlySignalCard
          title="Agently Verified Signals"
          description="These signals are generated by the platform so brands are not relying only on self-reported claims. They help explain why this creator appears in discovery."
          signals={[
            `${getIndiaAudiencePercent(bundle.creator)}% India audience signal from intake and profile review`,
            bundle.creator.home_city ? `Based in ${bundle.creator.home_city}${bundle.creator.top_indian_cities.length ? ` with audience in ${bundle.creator.top_indian_cities.slice(0, 3).join(", ")}` : ""}` : "Home city not captured yet",
            latestValuation ? `Current rate guidance anchors around ${formatCurrency(latestValuation.base_estimate_cents, "inr")}` : "Rate guidance can be generated from views, engagement, audience quality, and format",
            `${bundle.platforms.length} social channel${bundle.platforms.length === 1 ? "" : "s"} attached for profile review`,
            bundle.creator.verification_tier && bundle.creator.verification_tier !== "unverified" ? "Verified by Agently" : "Verification still needs review"
          ]}
        />

        <Card>
          <CardHeader><CardTitle>Fit Summary</CardTitle><BarChart3 className="h-4 w-4 text-primary" /></CardHeader>
          <p className="text-sm leading-6 text-muted-foreground">
            Strong candidate when campaign goals match their niche, India audience, city signal, and posting format. Use contract scan and negotiation support before finalizing usage rights, paid media, or exclusivity.
          </p>
        </Card>
      </section>

      <Card className="mt-5">
        <CardHeader><CardTitle>Recommended Brands</CardTitle></CardHeader>
        <div className="grid gap-3 md:grid-cols-3">
          {bundle.matches.map((match) => {
            const brand = bundle.brands.find((item) => item.id === match.brand_id);
            return (
              <div key={match.id} className="rounded-md border bg-white p-3 dark:border-white/8 dark:bg-card">
                <div className="mb-2 flex items-center justify-between">
                  <p className="font-semibold">{brand?.name}</p>
                  <Badge tone="blue">{match.fit_score}</Badge>
                </div>
                <p className="text-sm leading-5 text-muted-foreground">{match.match_reason}</p>
              </div>
            );
          })}
        </div>
      </Card>

      <CreatorReauditPanel creator={bundle.creator} platforms={bundle.platforms} />
    </AppShell>
  );
}

function Score({ label, value, suffix = "" }: { label: string; value: number; suffix?: string }) {
  return (
    <div className="rounded-md border bg-white p-4 dark:border-white/8 dark:bg-card">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-2 text-2xl font-bold">{value}{suffix}</p>
    </div>
  );
}

function Insight({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md bg-muted p-3">
      <p className="text-xs font-semibold uppercase text-muted-foreground">{label}</p>
      <p className="mt-1 text-sm font-bold">{value}</p>
    </div>
  );
}

function ProofCard({ icon, title, items }: { icon: ReactNode; title: string; items: string[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <div className="rounded-md bg-muted p-2 text-primary">{icon}</div>
      </CardHeader>
      <div className="space-y-2">
        {items.map((item) => (
          <div className="rounded-md border bg-white p-3 dark:border-white/8 dark:bg-card text-sm leading-5" key={item}>{item}</div>
        ))}
      </div>
    </Card>
  );
}

function getCreatorBestFor(niche: string, contentStyle: string) {
  const lower = `${niche} ${contentStyle}`.toLowerCase();
  if (lower.includes("fashion") || lower.includes("beauty")) return ["Launch shoots and lookbooks", "Reels for product drops", "Bangalore lifestyle campaigns"];
  if (lower.includes("gaming")) return ["Gaming integrations", "Tech product trials", "Community-led live formats"];
  if (lower.includes("food")) return ["Restaurant openings", "Cafe discovery", "Short-form local recommendations"];
  if (lower.includes("fitness")) return ["Wellness launches", "Gym or app campaigns", "Habit-building series"];
  return ["Awareness campaigns", "Creator-led product explainers", "India-first sponsor packages"];
}
