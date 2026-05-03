import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/layout/page-header";
import { MessageRecipientButton } from "@/components/messages/message-recipient-button";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, Td, Th } from "@/components/ui/table";
import { createAdminClient } from "@/lib/supabase/admin";
import { formatCurrency } from "@/lib/utils/format";

export default async function FreelancerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const data = await getFreelancerBundle(id);
  if (!data.freelancer) notFound();

  const freelancer = data.freelancer;

  return (
    <AppShell>
      <PageHeader
        eyebrow="Freelancer profile"
        title={String(freelancer.display_name)}
        description={String(freelancer.bio ?? "Production partner for creator campaigns.")}
        action={<div className="flex flex-wrap gap-2"><MessageRecipientButton entityId={String(freelancer.id)} entityType="freelancer" label="Message freelancer" /><Link className="inline-flex h-9 items-center gap-2 rounded-md border bg-white px-3 text-sm font-medium" href="/brand-home"><ArrowLeft className="h-4 w-4" /> Marketplace</Link></div>}
      />

      <section className="grid gap-5 xl:grid-cols-[0.85fr_1.15fr]">
        <Card>
          <CardHeader>
            <CardTitle>Service Scorecard</CardTitle>
            <Badge tone="green">{String(freelancer.service_category ?? "Creative services")}</Badge>
          </CardHeader>
          <div className="grid grid-cols-2 gap-4">
            <Score label="Portfolio" value={`${Number(freelancer.portfolio_score ?? 0)}/100`} />
            <Score label="Rating" value={`${Number(freelancer.rating_score ?? 0)}/5`} />
            <Score label="Hourly" value={formatCurrency(Number(freelancer.hourly_rate_cents ?? freelancer.day_rate_cents ?? 0), "inr")} />
            <Score label="Availability" value={String(freelancer.availability_status ?? "available")} />
          </div>
          <div className="mt-4 rounded-md border bg-white p-4 text-sm leading-6 text-muted-foreground">
            <p><span className="font-semibold text-foreground">City:</span> {String(freelancer.home_city ?? "Flexible")}</p>
            <p><span className="font-semibold text-foreground">Regions:</span> {toArray(freelancer.service_regions).join(", ") || "Remote"}</p>
            <p><span className="font-semibold text-foreground">Languages:</span> {toArray(freelancer.languages).join(", ") || "Not captured"}</p>
          </div>
        </Card>

        <Card>
          <CardHeader><CardTitle>Skills</CardTitle><Badge tone="blue">{toArray(freelancer.skills).length}</Badge></CardHeader>
          <div className="flex flex-wrap gap-2">
            {toArray(freelancer.skills).map((skill) => <Badge key={skill}>{skill}</Badge>)}
          </div>
          <p className="mt-4 text-sm leading-6 text-muted-foreground">
            Best used for brands that need production support around creator campaigns without requiring the freelancer to post on their own audience.
          </p>
        </Card>
      </section>

      <section className="mt-5 grid gap-5 xl:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Service Rates</CardTitle><Badge tone="blue">{data.serviceRates.length}</Badge></CardHeader>
          <div className="overflow-x-auto">
            <Table>
              <thead><tr><Th>Service</Th><Th>Description</Th><Th className="text-right">Rate</Th></tr></thead>
              <tbody>
                {data.serviceRates.map((rate) => (
                  <tr key={String(rate.id)}>
                    <Td className="font-medium">{String(rate.service_name)}</Td>
                    <Td>{String(rate.description ?? "")}</Td>
                    <Td className="text-right font-semibold">{formatCurrency(Number(rate.rate_cents ?? 0), "inr")}</Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </div>
        </Card>

        <Card>
          <CardHeader><CardTitle>Portfolio</CardTitle><Badge tone="green">{data.portfolio.length}</Badge></CardHeader>
          <div className="overflow-x-auto">
            <Table>
              <thead><tr><Th>Work</Th><Th>Category</Th><Th>Client</Th><Th>Link</Th></tr></thead>
              <tbody>
                {data.portfolio.map((item) => (
                  <tr key={String(item.id)}>
                    <Td className="font-medium">{String(item.title)}</Td>
                    <Td>{String(item.category ?? "")}</Td>
                    <Td>{String(item.brand_client ?? "")}</Td>
                    <Td><a className="text-primary" href={String(item.url)} target="_blank">Open</a></Td>
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

function Score({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border bg-white p-4">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-2 text-xl font-bold">{value}</p>
    </div>
  );
}

async function getFreelancerBundle(id: string) {
  const admin = createAdminClient();
  if (!admin) return { freelancer: null, serviceRates: [], portfolio: [] };

  const [freelancerResult, serviceRatesResult, portfolioResult] = await Promise.all([
    admin.from("freelancers").select("*").eq("id", id).maybeSingle(),
    admin.from("freelancer_service_rates").select("*").eq("freelancer_id", id).order("rate_cents", { ascending: true }),
    admin.from("portfolio_items").select("*").eq("freelancer_id", id).order("created_at", { ascending: false })
  ]);

  return {
    freelancer: freelancerResult.data,
    serviceRates: serviceRatesResult.data ?? [],
    portfolio: portfolioResult.data ?? []
  };
}

function toArray(value: unknown) {
  return Array.isArray(value) ? value.map(String) : [];
}
