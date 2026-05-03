import Link from "next/link";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { MarketplaceTabs } from "@/components/marketplace/marketplace-tabs";
import { PageHeader } from "@/components/layout/page-header";
import { ProfileCompletenessCard } from "@/components/profile/profile-completeness-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, Td, Th } from "@/components/ui/table";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { creatorCompleteness } from "@/lib/profile/completeness";
import { getBangaloreFit, getIndiaAudiencePercent } from "@/lib/utils/creator-metrics";
import { formatCurrency } from "@/lib/utils/format";

export default async function CreatorHomePage() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect("/login");

  const admin = createAdminClient();
  if (!admin) redirect("/dashboard");

  const { data: creator } = await admin.from("creators").select("*").eq("profile_id", data.user.id).single();
  if (!creator) {
    return (
      <AppShell>
        <PageHeader
          title="Complete creator intake"
          eyebrow="Creator home"
          description="Your account exists, but Agently still needs your creator intake to build the profile brands will see. Intake powers matching, sponsor valuation, contract protection, verification signals, and payout workflows."
          action={<Link href="/intake"><Button>Run creator intake</Button></Link>}
        />
        <Card>
          <p className="font-semibold">Why this is required</p>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            Without intake, Agently does not know your niche, platforms, audience, city relevance, content style, or brand-fit signals. Complete it once, then you can edit and improve your profile later.
          </p>
        </Card>
      </AppShell>
    );
  }

  const [{ data: audits }, { data: deals }, { data: brands }, { data: freelancers }, { data: platforms }] = await Promise.all([
    admin.from("creator_audits").select("*").eq("creator_id", creator.id).order("created_at", { ascending: false }).limit(1),
    admin.from("deals").select("*").eq("creator_id", creator.id).order("created_at", { ascending: false }),
    admin.from("brands").select("*").order("created_at", { ascending: false }).limit(6),
    admin.from("freelancers").select("*").order("created_at", { ascending: false }).limit(6),
    admin.from("creator_platforms").select("*").eq("creator_id", creator.id)
  ]);

  const latestAudit = audits?.[0]?.result as Record<string, unknown> | undefined;
  const completeness = creatorCompleteness({ creator, platforms: platforms ?? [], deals: deals ?? [], hasAudit: Boolean(latestAudit) });

  return (
    <AppShell>
      <PageHeader
        eyebrow="Creator home"
        title={`Welcome, ${creator.display_name}`}
        description="Track your positioning, recommended sponsors, deal pipeline, and protected payouts."
        action={<div className="flex flex-wrap gap-2"><Link href="/profile"><Button variant="secondary">Edit profile</Button></Link><Link href="/offers"><Button variant="secondary">Review offers</Button></Link><Link href={`/creators/${creator.id}`}><Button>View full profile</Button></Link></div>}
      />

      <section className="grid gap-4 md:grid-cols-3">
        <Metric label="India audience" value={`${getIndiaAudiencePercent(creator)}%`} />
        <Metric label="Bangalore fit" value={`${getBangaloreFit(creator)}/100`} />
        <Metric label="Sponsor readiness" value={`${latestAudit?.sponsor_readiness_score ?? creator.monetization_score}/100`} />
      </section>

      <div className="mt-5">
        <ProfileCompletenessCard title="Creator Readiness Checklist" completeness={completeness} />
      </div>

      <Card className="mt-5">
        <CardHeader><CardTitle>Marketplace Network</CardTitle><Badge tone="green">{(brands?.length ?? 0) + (freelancers?.length ?? 0)}</Badge></CardHeader>
        <MarketplaceTabs
          tabs={[
            { id: "brands", label: `Brands (${brands?.length ?? 0})`, type: "brand", items: brands ?? [] },
            { id: "freelancers", label: `Freelancers (${freelancers?.length ?? 0})`, type: "freelancer", items: freelancers ?? [] }
          ]}
        />
      </Card>

      <section className="mt-5 grid gap-5 xl:grid-cols-[0.85fr_1.15fr]">
        <Card>
          <CardHeader><CardTitle>Latest AI Audit</CardTitle><Badge tone="blue">{audits?.[0]?.source ?? "profile"}</Badge></CardHeader>
          <p className="text-sm leading-6 text-muted-foreground">{String(latestAudit?.content_style_summary ?? creator.content_style ?? "Run a re-audit to refresh your profile.")}</p>
          <div className="mt-4 flex flex-wrap gap-2">
            {(Array.isArray(latestAudit?.brand_fit_categories) ? latestAudit.brand_fit_categories : creator.prior_sponsor_categories ?? []).slice(0, 8).map((item: unknown) => (
              <Badge key={String(item)}>{String(item)}</Badge>
            ))}
          </div>
        </Card>

        <Card>
          <CardHeader><CardTitle>Active Deals</CardTitle><Badge tone="green">{deals?.length ?? 0}</Badge></CardHeader>
          <div className="overflow-x-auto">
            <Table>
              <thead><tr><Th>Deal</Th><Th>Stage</Th><Th>Payment</Th><Th className="text-right">Amount</Th></tr></thead>
              <tbody>
                {(deals ?? []).map((deal) => (
                  <tr key={deal.id}>
                    <Td className="font-medium">{deal.title}</Td>
                    <Td><Badge>{deal.offer_status ?? deal.stage}</Badge></Td>
                    <Td>{deal.payment_status}</Td>
                    <Td className="text-right font-semibold">{formatCurrency(deal.amount_cents, deal.currency ?? "inr")}</Td>
                  </tr>
                ))}
              </tbody>
            </Table>
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
      <p className="mt-2 text-2xl font-bold">{value}</p>
    </Card>
  );
}
