import Link from "next/link";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { MarketplaceTabs } from "@/components/marketplace/marketplace-tabs";
import { PageHeader } from "@/components/layout/page-header";
import { ProfileCompletenessCard } from "@/components/profile/profile-completeness-card";
import { MarketplaceEligibilityCard } from "@/components/profile/marketplace-eligibility-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, Td, Th } from "@/components/ui/table";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { brandAutomationDecision, creatorAutomationDecision, freelancerAutomationDecision, isDiscoverable } from "@/lib/profile/automation";
import { brandCompleteness } from "@/lib/profile/completeness";
import { formatCurrency } from "@/lib/utils/format";

export default async function BrandHomePage() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect("/login");

  const admin = createAdminClient();
  if (!admin) redirect("/dashboard");

  const { data: audit } = await admin.from("brand_audits").select("*").eq("profile_id", data.user.id).order("created_at", { ascending: false }).limit(1).single();
  const { data: brand } = audit?.brand_id
    ? await admin.from("brands").select("*").eq("id", audit.brand_id).single()
    : { data: null };
  const [{ data: deals }, { data: creators }, { data: platforms }, { data: freelancers }, { data: serviceRates }, { data: campaigns }, { data: projects }] = await Promise.all([
    brand?.id
    ? await admin.from("deals").select("*").eq("brand_id", brand.id).order("created_at", { ascending: false })
    : { data: [] },
    admin.from("creators").select("*").order("created_at", { ascending: false }).limit(6),
    admin.from("creator_platforms").select("*"),
    admin.from("freelancers").select("*").order("created_at", { ascending: false }).limit(6),
    admin.from("freelancer_service_rates").select("*"),
    admin.from("campaigns").select("*").eq("profile_id", data.user.id).order("created_at", { ascending: false }),
    brand?.id
      ? await admin.from("freelancer_projects").select("*").eq("brand_id", brand.id).order("created_at", { ascending: false })
      : { data: [] }
  ]);

  const result = audit?.result as Record<string, unknown> | undefined;
  const completeness = brandCompleteness({ brand, audit: audit ?? null, campaigns: campaigns ?? [], deals: deals ?? [], projects: projects ?? [] });
  const automation = brand ? brandAutomationDecision({ brand, audit: audit ?? null, campaigns: campaigns ?? [] }) : null;
  const visibleCreators = (creators ?? []).filter((creator) => isDiscoverable(creatorAutomationDecision({
    creator,
    platforms: (platforms ?? []).filter((platform) => platform.creator_id === creator.id)
  })));
  const visibleFreelancers = (freelancers ?? []).filter((freelancer) => isDiscoverable(freelancerAutomationDecision({
    freelancer,
    serviceRates: (serviceRates ?? []).filter((rate) => rate.freelancer_id === freelancer.id)
  })));

  if (!brand) {
    return (
      <AppShell>
        <PageHeader
          eyebrow="Brand home"
          title="Complete brand intake"
          description="Your account exists, but Agently still needs your brand intake to create your campaign workspace. Intake powers creator/freelancer matching, campaign recommendations, verification signals, and future performance insights."
          action={<Link href="/intake"><Button>Run brand intake</Button></Link>}
        />
        <Card>
          <p className="font-semibold">Why this is required</p>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            Without intake, Agently does not know your category, target audience, budget range, campaign goal, timeline, or launch market. Complete it once, then refine campaign briefs from your workspace.
          </p>
        </Card>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <PageHeader
        eyebrow="Brand home"
        title={brand?.name ? `${brand.name} campaign workspace` : "Brand campaign workspace"}
        description="Review your AI campaign audit, creator archetypes, submitted offers, and payment flow."
        action={<div className="flex flex-wrap gap-2"><Link href="/profile"><Button variant="secondary">Edit profile</Button></Link><Link href="/brand-insights"><Button variant="secondary">View insights</Button></Link><Link href="/campaigns"><Button>Create campaign brief</Button></Link></div>}
      />

      <section className="grid gap-4 md:grid-cols-3">
        <Metric label="Bangalore launch fit" value={`${result?.bangalore_launch_fit_score ?? "-"}/100`} />
        <Metric label="Creator size band" value={String(result?.creator_size_band ?? "Run intake")} />
        <Metric label="Active offers" value={`${deals?.length ?? 0}`} />
      </section>

      <section className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
        <Card>
          <CardHeader><CardTitle>Marketplace Talent</CardTitle><Badge tone="green">{visibleCreators.length + visibleFreelancers.length}</Badge></CardHeader>
          <MarketplaceTabs
            tabs={[
              { id: "creators", label: `Available Creators (${visibleCreators.length})`, type: "creator", items: visibleCreators, platforms: platforms ?? [] },
              { id: "freelancers", label: `Available Freelancers (${visibleFreelancers.length})`, type: "freelancer", items: visibleFreelancers }
            ]}
          />
        </Card>
        <aside className="space-y-3 xl:sticky xl:top-5 xl:self-start">
          {automation ? <MarketplaceEligibilityCard decision={automation} /> : null}
          <ProfileCompletenessCard compact title="Launch readiness" completeness={completeness} />
        </aside>
      </section>

      <section className="mt-5 grid gap-5 xl:grid-cols-[0.9fr_1.1fr]">
        <Card>
          <CardHeader><CardTitle>Campaign Audit</CardTitle><Badge tone="blue">{audit?.source ?? "intake"}</Badge></CardHeader>
          <p className="text-sm leading-6 text-muted-foreground">{String(result?.outreach_brief ?? "Run brand intake to generate a campaign profile.")}</p>
          <div className="mt-4 space-y-2">
            {(Array.isArray(result?.ideal_creator_archetypes) ? result?.ideal_creator_archetypes : []).map((item) => (
              <p key={String(item)} className="rounded-md border bg-white p-3 text-sm dark:border-white/8 dark:bg-card">{String(item)}</p>
            ))}
          </div>
        </Card>

        <Card>
          <CardHeader><CardTitle>Submitted Offers</CardTitle><Badge tone="green">{deals?.length ?? 0}</Badge></CardHeader>
          <div className="overflow-x-auto">
            <Table>
              <thead><tr><Th>Deal</Th><Th>Stage</Th><Th>Payment</Th><Th className="text-right">Amount</Th></tr></thead>
              <tbody>
                {(deals ?? []).map((deal) => (
                  <tr key={deal.id}>
                    <Td className="font-medium">{deal.title}</Td>
                    <Td><Badge>{deal.stage}</Badge></Td>
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
      <p className="mt-2 text-xl font-bold">{value}</p>
    </Card>
  );
}
