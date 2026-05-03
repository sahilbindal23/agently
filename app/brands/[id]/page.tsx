import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Globe2 } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/layout/page-header";
import { MessageRecipientButton } from "@/components/messages/message-recipient-button";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, Td, Th } from "@/components/ui/table";
import { VerificationBadge } from "@/components/verification/verification-badge";
import { createAdminClient } from "@/lib/supabase/admin";
import { formatCurrency } from "@/lib/utils/format";

export const dynamic = "force-dynamic";

export default async function BrandProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const admin = createAdminClient();
  if (!admin) notFound();

  const [{ data: brand }, { data: campaigns }, { data: deals }, { data: projects }] = await Promise.all([
    admin.from("brands").select("*").eq("id", id).maybeSingle(),
    admin.from("campaigns").select("*").eq("brand_id", id).order("created_at", { ascending: false }).limit(6),
    admin.from("deals").select("*").eq("brand_id", id).order("created_at", { ascending: false }).limit(6),
    admin.from("freelancer_projects").select("*").eq("brand_id", id).order("created_at", { ascending: false }).limit(6)
  ]);

  if (!brand) notFound();

  return (
    <AppShell>
      <PageHeader
        eyebrow="Brand profile"
        title={String(brand.name ?? "Brand")}
        description={String(brand.industry ?? "Campaign partner")}
        action={<div className="flex flex-wrap gap-2"><MessageRecipientButton entityId={String(brand.id)} entityType="brand" label="Message brand" /><Link className="inline-flex h-9 items-center gap-2 rounded-md border bg-white px-3 text-sm font-medium" href="/"><ArrowLeft className="h-4 w-4" /> Home</Link></div>}
      />

      <section className="grid gap-5 lg:grid-cols-[0.8fr_1.2fr]">
        <Card>
          <CardHeader>
            <CardTitle>Brand Snapshot</CardTitle>
            <VerificationBadge status={brand.verification_status} tier={brand.verification_tier} />
          </CardHeader>
          {brand.image_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img alt={String(brand.name)} className="mb-4 h-48 w-full rounded-md object-cover" src={String(brand.image_url)} />
          ) : null}
          <div className="space-y-3 text-sm">
            <Info label="Industry" value={String(brand.industry ?? "Not listed")} />
            <Info label="Status" value={String(brand.status ?? "target")} />
            <Info label="Contact" value={String(brand.contact_email ?? "Not listed")} />
            {brand.website ? (
              <a className="inline-flex items-center gap-2 text-sm font-medium text-primary" href={String(brand.website)} rel="noreferrer" target="_blank">
                <Globe2 className="h-4 w-4" />
                Website
              </a>
            ) : null}
          </div>
        </Card>

        <Card>
          <CardHeader><CardTitle>Campaign Activity</CardTitle><Badge tone="blue">{(campaigns?.length ?? 0) + (deals?.length ?? 0) + (projects?.length ?? 0)}</Badge></CardHeader>
          <div className="grid gap-3 md:grid-cols-3">
            <Metric label="Campaigns" value={String(campaigns?.length ?? 0)} />
            <Metric label="Creator offers" value={String(deals?.length ?? 0)} />
            <Metric label="Freelancer projects" value={String(projects?.length ?? 0)} />
          </div>
          <div className="mt-4 overflow-x-auto">
            <Table>
              <thead><tr><Th>Recent work</Th><Th>Type</Th><Th>Status</Th><Th className="text-right">Amount</Th></tr></thead>
              <tbody>
                {(deals ?? []).map((deal) => (
                  <tr key={`deal-${deal.id}`}>
                    <Td>{deal.title}</Td>
                    <Td>Creator offer</Td>
                    <Td>{deal.offer_status ?? deal.stage}</Td>
                    <Td className="text-right">{formatCurrency(Number(deal.amount_cents ?? 0), String(deal.currency ?? "inr"))}</Td>
                  </tr>
                ))}
                {(projects ?? []).map((project) => (
                  <tr key={`project-${project.id}`}>
                    <Td>{project.title}</Td>
                    <Td>Freelancer project</Td>
                    <Td>{project.status}</Td>
                    <Td className="text-right">{formatCurrency(Number(project.amount_cents ?? 0), String(project.currency ?? "inr"))}</Td>
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

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase text-muted-foreground">{label}</p>
      <p className="mt-1 font-medium">{value}</p>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md bg-muted p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-xl font-bold">{value}</p>
    </div>
  );
}
