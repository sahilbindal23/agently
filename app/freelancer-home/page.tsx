import { redirect } from "next/navigation";
import Link from "next/link";
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
import { freelancerCompleteness } from "@/lib/profile/completeness";
import { formatCurrency } from "@/lib/utils/format";

export default async function FreelancerHomePage() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect("/login");

  const admin = createAdminClient();
  if (!admin) redirect("/dashboard");

  const { data: freelancer } = await admin.from("freelancers").select("*").eq("profile_id", data.user.id).single();
  if (!freelancer) {
    return (
      <AppShell>
        <PageHeader
          title="Complete freelancer intake"
          eyebrow="Production talent"
          description="Your account exists, but Agently still needs your freelancer intake to build the production profile brands will see. Intake powers project matching, service-rate clarity, portfolio verification, and protected payout workflows."
          action={<Link href="/intake"><Button>Run freelancer intake</Button></Link>}
        />
        <Card>
          <CardHeader><CardTitle>Why this is required</CardTitle><Badge tone="blue">setup step</Badge></CardHeader>
          <p className="text-sm leading-6 text-muted-foreground">
            Without intake, Agently does not know your service category, skills, portfolio links, hourly/project rates, city coverage, or availability. Complete it once, then you can customize your profile later.
          </p>
        </Card>
      </AppShell>
    );
  }

  const [{ data: portfolio }, { data: serviceRates }, { data: projects }, { data: brands }, { data: creators }, { data: platforms }] = await Promise.all([
    admin.from("portfolio_items").select("*").eq("freelancer_id", freelancer.id).order("created_at", { ascending: false }),
    admin.from("freelancer_service_rates").select("*").eq("freelancer_id", freelancer.id).order("created_at", { ascending: false }),
    admin.from("freelancer_projects").select("*").eq("freelancer_id", freelancer.id).order("created_at", { ascending: false }),
    admin.from("brands").select("*").order("created_at", { ascending: false }).limit(6),
    admin.from("creators").select("*").order("created_at", { ascending: false }).limit(6),
    admin.from("creator_platforms").select("*")
  ]);
  const hourlyRate = freelancer.hourly_rate_cents ?? freelancer.day_rate_cents ?? 0;
  const completeness = freelancerCompleteness({ freelancer, serviceRates: serviceRates ?? [], portfolio: portfolio ?? [], projects: projects ?? [] });

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

      <div className="mt-5">
        <ProfileCompletenessCard title="Freelancer Readiness Checklist" completeness={completeness} />
      </div>

      <Card className="mt-5">
        <CardHeader><CardTitle>Marketplace Network</CardTitle><Badge tone="green">{(brands?.length ?? 0) + (creators?.length ?? 0)}</Badge></CardHeader>
        <MarketplaceTabs
          tabs={[
            { id: "brands", label: `Brands (${brands?.length ?? 0})`, type: "brand", items: brands ?? [] },
            { id: "creators", label: `Creators (${creators?.length ?? 0})`, type: "creator", items: creators ?? [], platforms: platforms ?? [] }
          ]}
        />
      </Card>

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
