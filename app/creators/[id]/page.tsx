import { notFound } from "next/navigation";
import { CreatorReauditPanel } from "@/components/creators/creator-reaudit-panel";
import { AppShell } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, Td, Th } from "@/components/ui/table";
import { getCreatorBundle } from "@/lib/db/live-data";
import { getBangaloreFit, getCreatorLanguages, getIndiaAudiencePercent } from "@/lib/utils/creator-metrics";
import { formatCurrency, formatNumber, formatPercent } from "@/lib/utils/format";

export default async function CreatorDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const bundle = await getCreatorBundle(id);
  if (!bundle.creator) notFound();

  return (
    <AppShell>
      <PageHeader
        eyebrow="Creator profile"
        title={bundle.creator.display_name}
        description={bundle.creator.bio}
      />
      <section className="grid gap-5 xl:grid-cols-[0.9fr_1.2fr]">
        <Card>
          <CardHeader>
            <CardTitle>Talent Scorecard</CardTitle>
            <Badge tone="green">{bundle.creator.primary_niche}</Badge>
          </CardHeader>
          <div className="grid grid-cols-2 gap-4">
            <Score label="Monetization" value={bundle.creator.monetization_score} />
            <Score label="Valuation" value={bundle.creator.valuation_score} />
            <Score label="India audience" value={getIndiaAudiencePercent(bundle.creator)} suffix="%" />
            <Score label="Bangalore fit" value={getBangaloreFit(bundle.creator)} />
          </div>
          <div className="mt-4 rounded-md border bg-white p-4 text-sm leading-6 text-muted-foreground">
            <p><span className="font-semibold text-foreground">Home city:</span> {bundle.creator.home_city || "Not captured"}</p>
            <p><span className="font-semibold text-foreground">Languages:</span> {getCreatorLanguages(bundle.creator)}</p>
            <p><span className="font-semibold text-foreground">Top Indian cities:</span> {bundle.creator.top_indian_cities.join(", ") || "Not captured"}</p>
          </div>
        </Card>

        <Card>
          <CardHeader><CardTitle>Platforms</CardTitle></CardHeader>
          <div className="overflow-x-auto">
            <Table>
              <thead><tr><Th>Platform</Th><Th>Handle</Th><Th>Followers</Th><Th>Avg views</Th><Th>Engagement</Th></tr></thead>
              <tbody>
                {bundle.platforms.map((platform) => (
                  <tr key={platform.id}>
                    <Td className="font-medium">{platform.platform}</Td>
                    <Td>{platform.handle}</Td>
                    <Td>{formatNumber(platform.followers)}</Td>
                    <Td>{formatNumber(platform.avg_views)}</Td>
                    <Td>{formatPercent(platform.engagement_rate)}</Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </div>
        </Card>
      </section>

      <section className="mt-5 grid gap-5 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader><CardTitle>Active Deals</CardTitle></CardHeader>
          <div className="space-y-3">
            {bundle.deals.map((deal) => (
              <div key={deal.id} className="flex flex-col gap-2 rounded-md border bg-white p-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="font-semibold">{deal.title}</p>
                  <p className="text-sm text-muted-foreground">{deal.deliverables}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge>{deal.stage}</Badge>
                  <p className="font-bold">{formatCurrency(deal.amount_cents, deal.currency)}</p>
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <CardHeader><CardTitle>AI Summary</CardTitle></CardHeader>
          <p className="text-sm leading-6 text-muted-foreground">
            Strong agency candidate with clear category authority, measurable audience quality, and several sponsor paths. Prioritize usage controls and paid media caps when packaging campaigns.
          </p>
        </Card>
      </section>

      <Card className="mt-5">
        <CardHeader><CardTitle>Recommended Brands</CardTitle></CardHeader>
        <div className="grid gap-3 md:grid-cols-3">
          {bundle.matches.map((match) => {
            const brand = bundle.brands.find((item) => item.id === match.brand_id);
            return (
              <div key={match.id} className="rounded-md border bg-white p-3">
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
    <div className="rounded-md border bg-white p-4">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-2 text-2xl font-bold">{value}{suffix}</p>
    </div>
  );
}
