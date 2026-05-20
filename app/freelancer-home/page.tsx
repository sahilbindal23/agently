import { redirect } from "next/navigation";
import Link from "next/link";
import { AppShell } from "@/components/layout/app-shell";
import { MarketplaceTabs } from "@/components/marketplace/marketplace-tabs";
import { PageHeader } from "@/components/layout/page-header";
import { CreateFreelancerProfileForm } from "@/components/freelancers/create-freelancer-profile-form";
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
import { freelancerCompleteness } from "@/lib/profile/completeness";
import { formatCurrency } from "@/lib/utils/format";

export default async function FreelancerHomePage() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect("/login");

  const admin = createAdminClient();
  if (!admin) redirect("/dashboard");
  const currentUser = await getCurrentUser();
  const includeDemo = canSeeDemoData(currentUser);

  const { data: freelancer } = await admin.from("freelancers").select("*").eq("profile_id", data.user.id).single();
  if (!freelancer) {
    return (
      <AppShell>
        <PageHeader
          title="Add your freelancer profile"
          eyebrow="Production talent add-on"
          description="You already have an Agently account. Add a freelancer profile here so brands can discover your editing, shooting, design, production, and project-rate services without making another account."
        />
        <Card className="mb-5 border-blue-200 bg-blue-50/50 dark:border-sky-900/60 dark:bg-sky-950/25">
          <CardHeader><CardTitle>Why this add-on matters</CardTitle><Badge tone="blue">same account</Badge></CardHeader>
          <p className="text-sm leading-6 text-muted-foreground">
            Creator work means you post to your audience. Freelancer work means you produce the asset, edit, shoot, design, or manage production without needing to publish it. This profile keeps those two workflows separate while letting brands find both sides of your talent.
          </p>
        </Card>
        <Card>
          <CardHeader><CardTitle>Freelancer profile details</CardTitle><Badge tone="green">discoverable after save</Badge></CardHeader>
          <CreateFreelancerProfileForm defaultDisplayName={data.user.user_metadata?.full_name ?? ""} />
        </Card>
      </AppShell>
    );
  }

  const [{ data: portfolio }, { data: serviceRates }, { data: projects }, { data: brands }, { data: creators }, { data: platforms }] = await Promise.all([
    admin.from("portfolio_items").select("*").eq("freelancer_id", freelancer.id).order("created_at", { ascending: false }),
    admin.from("freelancer_service_rates").select("*").eq("freelancer_id", freelancer.id).order("created_at", { ascending: false }),
    admin.from("freelancer_projects").select("*").eq("freelancer_id", freelancer.id).order("created_at", { ascending: false }),
    admin.from("brands").select("*").order("created_at", { ascending: false }).limit(24),
    admin.from("creators").select("*").order("created_at", { ascending: false }).limit(24),
    admin.from("creator_platforms").select("*")
  ]);
  const hourlyRate = freelancer.hourly_rate_cents ?? freelancer.day_rate_cents ?? 0;
  const completeness = freelancerCompleteness({ freelancer, serviceRates: serviceRates ?? [], portfolio: portfolio ?? [], projects: projects ?? [] });
  const automation = freelancerAutomationDecision({ freelancer, serviceRates: serviceRates ?? [], portfolio: portfolio ?? [] });
  // Pagination + filters handled inside MarketplaceTabs — pass the
  // full eligible dataset so the client can flip through pages.
  // Full browsing experience is at /creators and /brands.
  const visibleBrands = withoutDemoRows(brands ?? [], includeDemo).filter((brand) => isDiscoverable(brandAutomationDecision({ brand })));
  const visibleCreators = withoutDemoRows(creators ?? [], includeDemo).filter((creator) => isDiscoverable(creatorAutomationDecision({
    creator,
    platforms: (platforms ?? []).filter((platform) => platform.creator_id === creator.id)
  })));

  return (
    <AppShell>
      <PageHeader
        eyebrow="Freelancer home"
        title={freelancer.display_name}
        description="Manage your production services, portfolio, rates, and availability for brands looking to build creator campaigns."
        action={<Link href="/profile"><Button variant="secondary">Edit profile</Button></Link>}
      />
      <section className="grid gap-4 md:grid-cols-4">
        <Metric label="Portfolio score" value={`${freelancer.portfolio_score ?? 0}/100`} />
        <Metric label="Availability" value={freelancer.availability_status ?? "available"} />
        <Metric label="Hourly rate" value={formatCurrency(hourlyRate, "inr")} />
        <Metric label="Project offers" value={`${projects?.length ?? 0}`} />
      </section>

      <section className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
        <Card>
          <CardHeader><CardTitle>Marketplace Network</CardTitle><Badge tone="green">{visibleBrands.length + visibleCreators.length}</Badge></CardHeader>
          <MarketplaceTabs
            tabs={[
              { id: "brands", label: `Brands (${visibleBrands.length})`, type: "brand", items: visibleBrands },
              { id: "creators", label: `Creators (${visibleCreators.length})`, type: "creator", items: visibleCreators, platforms: platforms ?? [] }
            ]}
          />
        </Card>
        <aside className="space-y-3 xl:sticky xl:top-5 xl:self-start">
          <MarketplaceEligibilityCard decision={automation} />
          <ProfileCompletenessCard compact title="Readiness" completeness={completeness} />
        </aside>
      </section>

      <section className="mt-5 grid gap-5 xl:grid-cols-[0.9fr_1.1fr]">
        <Card>
          <CardHeader><CardTitle>Service Profile</CardTitle><Badge tone="green">{freelancer.service_category}</Badge></CardHeader>
          <p className="text-sm leading-6 text-muted-foreground">{freelancer.bio || "Add a short production bio during intake."}</p>
          <div className="mt-4 flex flex-wrap gap-2">
            {(freelancer.skills ?? []).map((skill: string) => <Badge key={skill}>{skill}</Badge>)}
          </div>
        </Card>
        <Card>
          <CardHeader><CardTitle>Service Pricing</CardTitle><Badge tone="blue">{serviceRates?.length ?? 0}</Badge></CardHeader>
          <div className="overflow-x-auto">
            <Table>
              <thead><tr><Th>Service</Th><Th>Description</Th><Th className="text-right">Rate</Th></tr></thead>
              <tbody>
                {(serviceRates ?? []).map((rate) => (
                  <tr key={rate.id}>
                    <Td className="font-medium">{rate.service_name}</Td>
                    <Td>{rate.description}</Td>
                    <Td className="text-right font-semibold">{formatCurrency(rate.rate_cents ?? 0, "inr")}</Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </div>
        </Card>
        <Card>
          <CardHeader><CardTitle>Portfolio</CardTitle><Badge tone="blue">{portfolio?.length ?? 0}</Badge></CardHeader>
          <div className="overflow-x-auto">
            <Table>
              <thead><tr><Th>Title</Th><Th>Category</Th><Th>Link</Th></tr></thead>
              <tbody>
                {(portfolio ?? []).map((item) => (
                  <tr key={item.id}>
                    <Td className="font-medium">{item.title}</Td>
                    <Td>{item.category}</Td>
                    <Td><a className="text-primary" href={item.url} target="_blank">Open</a></Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </div>
        </Card>
        <Card>
          <CardHeader><CardTitle>Project Offers</CardTitle><Badge tone="green">{projects?.length ?? 0}</Badge></CardHeader>
          {(projects ?? []).length === 0 ? (
            <div className="rounded-md border border-dashed bg-muted/40 p-5 text-center dark:border-white/8">
              <p className="text-sm font-semibold">No project offers yet</p>
              <p className="mx-auto mt-1 max-w-md text-sm leading-6 text-muted-foreground">
                Brands send project offers (editing, design, shooting, production support) here. Make sure your service pricing and portfolio are filled — that&apos;s what brands see when they shortlist you.
              </p>
              <div className="mt-3 flex flex-wrap justify-center gap-2">
                <Link className="inline-flex h-9 items-center gap-2 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90" href="/profile">Update service pricing</Link>
                <Link className="inline-flex h-9 items-center gap-2 rounded-md border bg-white px-4 text-sm font-medium hover:bg-muted dark:border-white/10 dark:bg-card" href="/offers">View offer inbox</Link>
              </div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <thead><tr><Th>Project</Th><Th>Status</Th><Th className="text-right">Amount</Th></tr></thead>
                <tbody>
                  {(projects ?? []).map((project) => (
                    <tr key={project.id}>
                      <Td className="font-medium">{project.title}</Td>
                      <Td><Badge>{project.status}</Badge></Td>
                      <Td className="text-right font-semibold">{formatCurrency(project.amount_cents ?? 0, "inr")}</Td>
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
      <p className="mt-2 text-xl font-bold">{value}</p>
    </Card>
  );
}
