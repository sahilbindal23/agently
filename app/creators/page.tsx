import Link from "next/link";
import { Plus, Search } from "lucide-react";
import { CreateCreatorForm } from "@/components/creators/create-creator-form";
import { AppShell } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { VerificationBadge } from "@/components/verification/verification-badge";
import { getCurrentUser } from "@/lib/auth/session";
import { canSeeDemoData } from "@/lib/db/demo-visibility";
import { getAgentlyData } from "@/lib/db/live-data";
import { getBangaloreFit, getIndiaAudiencePercent } from "@/lib/utils/creator-metrics";
import { formatCurrency, formatNumber, formatPercent } from "@/lib/utils/format";

export default async function CreatorsPage() {
  const user = await getCurrentUser();
  const { creatorPlatforms, creators } = await getAgentlyData({ includeDemo: canSeeDemoData(user) });

  return (
    <AppShell>
      <PageHeader
        eyebrow="Creator CRM"
        title="Represented creators"
        description="Manage creator profiles, platform metrics, audience quality, monetization scores, and sponsorship rate bands."
        action={<div className="inline-flex h-10 items-center gap-2 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground"><Plus className="h-4 w-4" /> Add creator</div>}
      />
      <Card className="mb-5">
        <div className="flex flex-col gap-3 md:flex-row">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input className="pl-9" placeholder="Search creators, niches, platforms" />
          </div>
          <select className="h-10 rounded-md border bg-white px-3 text-sm">
            <option>All niches</option>
            <option>Fashion</option>
            <option>Gaming</option>
            <option>Wellness</option>
          </select>
        </div>
      </Card>

      <section className="grid gap-5 lg:grid-cols-3">
        {creators.map((creator) => {
          const platforms = creatorPlatforms.filter((platform) => platform.creator_id === creator.id);
          const primary = platforms[0] ?? {
            platform: "Unlinked",
            followers: 0,
            avg_views: 0,
            engagement_rate: 0
          };
          const estimatedRate = primary.platform === "YouTube" ? primary.avg_views * 38 : primary.avg_views * 45;
          return (
            <Link href={`/creators/${creator.id}`} key={creator.id}>
              <Card className="h-full transition hover:-translate-y-0.5 hover:border-primary/50">
                <CardHeader>
                  <div>
                    <CardTitle>{creator.display_name}</CardTitle>
                    <p className="mt-1 text-sm text-muted-foreground">{creator.primary_niche}</p>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <VerificationBadge status={creator.verification_status} tier={creator.verification_tier} />
                    <Badge tone="green">{creator.monetization_score}/100</Badge>
                  </div>
                </CardHeader>
                <p className="mb-4 line-clamp-2 text-sm leading-6 text-muted-foreground">{creator.bio}</p>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <Stat label="Platform" value={primary.platform} />
                  <Stat label="Followers" value={formatNumber(primary.followers)} />
                  <Stat label="Avg views" value={formatNumber(primary.avg_views)} />
                  <Stat label="India audience" value={formatPercent(getIndiaAudiencePercent(creator))} />
                  <Stat label="Bangalore fit" value={`${getBangaloreFit(creator)}/100`} />
                </div>
                <div className="mt-4 rounded-md bg-muted p-3">
                  <p className="text-xs text-muted-foreground">Estimated rate</p>
                  <p className="text-lg font-bold">{formatCurrency(Math.round(estimatedRate), "inr")}</p>
                </div>
              </Card>
            </Link>
          );
        })}
      </section>

      <Card className="mt-5">
        <CardHeader>
          <CardTitle>Add Creator</CardTitle>
          <Badge tone="green">writes to Supabase</Badge>
        </CardHeader>
        <CreateCreatorForm />
      </Card>
    </AppShell>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="font-semibold">{value}</p>
    </div>
  );
}
