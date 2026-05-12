import Link from "next/link";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { MarketplaceTabs } from "@/components/marketplace/marketplace-tabs";
import { PageHeader } from "@/components/layout/page-header";
import { MarketplaceEligibilityCard } from "@/components/profile/marketplace-eligibility-card";
import { ProfileCompletenessCard } from "@/components/profile/profile-completeness-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, Td, Th } from "@/components/ui/table";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth/session";
import { canSeeDemoData, withoutDemoRows } from "@/lib/db/demo-visibility";
import { brandAutomationDecision, creatorAutomationDecision, freelancerAutomationDecision, isDiscoverable } from "@/lib/profile/automation";
import { creatorCompleteness } from "@/lib/profile/completeness";
import { getBangaloreFit, getIndiaAudiencePercent } from "@/lib/utils/creator-metrics";
import { formatCurrency } from "@/lib/utils/format";

export default async function CreatorHomePage() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect("/login");

  const admin = createAdminClient();
  if (!admin) redirect("/dashboard");
  const currentUser = await getCurrentUser();
  const includeDemo = canSeeDemoData(currentUser);

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

  const [{ data: audits }, { data: deals }, { data: brands }, { data: freelancers }, { data: serviceRates }, { data: platforms }] = await Promise.all([
    admin.from("creator_audits").select("*").eq("creator_id", creator.id).order("created_at", { ascending: false }).limit(1),
    admin.from("deals").select("*").eq("creator_id", creator.id).order("created_at", { ascending: false }),
    admin.from("brands").select("*").order("created_at", { ascending: false }).limit(24),
    admin.from("freelancers").select("*").order("created_at", { ascending: false }).limit(24),
    admin.from("freelancer_service_rates").select("*"),
    admin.from("creator_platforms").select("*").eq("creator_id", creator.id)
  ]);

  const latestAudit = audits?.[0]?.result as Record<string, unknown> | undefined;
  const completeness = creatorCompleteness({ creator, platforms: platforms ?? [], deals: deals ?? [], hasAudit: Boolean(latestAudit) });
  const automation = creatorAutomationDecision({ creator, platforms: platforms ?? [] });
  const visibleBrands = withoutDemoRows(brands ?? [], includeDemo).filter((brand) => isDiscoverable(brandAutomationDecision({ brand }))).slice(0, 6);
  const visibleFreelancers = withoutDemoRows(freelancers ?? [], includeDemo).filter((freelancer) => isDiscoverable(freelancerAutomationDecision({
    freelancer,
    serviceRates: (serviceRates ?? []).filter((rate) => rate.freelancer_id === freelancer.id)
  }))).slice(0, 6);

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

      <section className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
        <Card>
          <CardHeader><CardTitle>Marketplace Network</CardTitle><Badge tone="green">{visibleBrands.length + visibleFreelancers.length}</Badge></CardHeader>
          <MarketplaceTabs
            tabs={[
              { id: "brands", label: `Brands (${visibleBrands.length})`, type: "brand", items: visibleBrands },
              { id: "freelancers", label: `Freelancers (${visibleFreelancers.length})`, type: "freelancer", items: visibleFreelancers }
            ]}
          />
        </Card>
        <aside className="space-y-3 xl:sticky xl:top-5 xl:self-start">
          <MarketplaceEligibilityCard decision={automation} />
          <ProfileCompletenessCard compact title="Readiness" completeness={completeness} />
        </aside>
      </section>

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
          {(deals ?? []).length === 0 ? (
            <div className="rounded-md border border-dashed bg-muted/40 p-5 text-center dark:border-white/8">
              <p className="text-sm font-semibold">No deals yet</p>
              <p className="mx-auto mt-1 max-w-md text-sm leading-6 text-muted-foreground">
                When a brand sends you an offer and you accept, it lands here. Connect Instagram or YouTube and finish your intake — verified creators with strong engagement quality rank higher in brand recommendations.
              </p>
              <div className="mt-3 flex flex-wrap justify-center gap-2">
                <Link className="inline-flex h-9 items-center gap-2 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90" href="/profile">Finish profile</Link>
                <Link className="inline-flex h-9 items-center gap-2 rounded-md border bg-white px-4 text-sm font-medium hover:bg-muted dark:border-white/10 dark:bg-card" href="/offers">View offer inbox</Link>
              </div>
            </div>
          ) : (
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
          )}
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
