import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { ArrowLeft, BriefcaseBusiness, ClipboardList, Globe2, Sparkles, Target } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/layout/page-header";
import { MessageRecipientButton } from "@/components/messages/message-recipient-button";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, Td, Th } from "@/components/ui/table";
import { VerificationBadge } from "@/components/verification/verification-badge";
import { getCurrentUser } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { formatCurrency } from "@/lib/utils/format";

export const dynamic = "force-dynamic";

export default async function BrandProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const admin = createAdminClient();
  if (!admin) notFound();

  const [{ data: brand }, { data: campaigns }, { data: deals }, { data: projects }, currentUser] = await Promise.all([
    admin.from("brands").select("*").eq("id", id).maybeSingle(),
    admin.from("campaigns").select("*").eq("brand_id", id).order("created_at", { ascending: false }).limit(8),
    admin.from("deals").select("*").eq("brand_id", id).order("created_at", { ascending: false }).limit(6),
    admin.from("freelancer_projects").select("*").eq("brand_id", id).order("created_at", { ascending: false }).limit(6),
    getCurrentUser()
  ]);

  if (!brand) notFound();
  const isOwnProfile = String(brand.profile_id ?? "") === currentUser?.id;

  return (
    <AppShell>
      <PageHeader
        eyebrow="Brand profile"
        title={String(brand.name ?? "Brand")}
        description={String(brand.industry ?? "Campaign partner")}
        action={<div className="flex flex-wrap gap-2">{isOwnProfile ? null : <MessageRecipientButton entityId={String(brand.id)} entityType="brand" label="Message brand" />}<Link className="inline-flex h-9 items-center gap-2 rounded-md border bg-white px-3 text-sm font-medium" href="/"><ArrowLeft className="h-4 w-4" /> Home</Link></div>}
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

      <section className="mt-5 grid gap-5 xl:grid-cols-3">
        <BrandProofCard
          icon={<Target className="h-4 w-4" />}
          title="Brand Categories"
          items={[
            String(brand.industry ?? "Category not listed"),
            ...unique((campaigns ?? []).flatMap((campaign) => toArray(campaign.creator_categories))).slice(0, 5)
          ]}
        />
        <BrandProofCard
          icon={<Sparkles className="h-4 w-4" />}
          title="Creator Collaboration Fit"
          items={collaborationFit(String(brand.industry ?? ""), campaigns ?? [])}
        />
        <BrandProofCard
          icon={<BriefcaseBusiness className="h-4 w-4" />}
          title="Production Needs"
          items={productionNeeds(campaigns ?? [], projects ?? [])}
        />
      </section>

      <section className="mt-5 grid gap-5 xl:grid-cols-[1.1fr_0.9fr]">
        <Card>
          <CardHeader>
            <CardTitle>Active Campaign Briefs</CardTitle>
            <Badge tone="green">{(campaigns ?? []).filter((campaign) => String(campaign.status ?? "") !== "closed").length}</Badge>
          </CardHeader>
          <div className="grid gap-3 md:grid-cols-2">
            {(campaigns ?? []).slice(0, 6).map((campaign) => (
              <div className="rounded-md border bg-white p-4" key={campaign.id}>
                <div className="mb-3 flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold">{String(campaign.title ?? "Campaign")}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{String(campaign.campaign_goal ?? "Campaign goal not listed")}</p>
                  </div>
                  <Badge tone={String(campaign.status ?? "") === "active" ? "green" : "blue"}>{String(campaign.status ?? "draft")}</Badge>
                </div>
                <div className="flex flex-wrap gap-2">
                  {toArray(campaign.platforms).slice(0, 3).map((platform) => <Badge key={platform}>{platform}</Badge>)}
                  {campaign.city_focus ? <Badge tone="blue">{String(campaign.city_focus)}</Badge> : null}
                  {campaign.campaign_length ? <Badge>{String(campaign.campaign_length)}</Badge> : null}
                </div>
              </div>
            ))}
            {(campaigns ?? []).length === 0 ? <p className="text-sm leading-6 text-muted-foreground">No public campaign briefs are available yet.</p> : null}
          </div>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Campaign History</CardTitle>
            <ClipboardList className="h-4 w-4 text-primary" />
          </CardHeader>
          <div className="space-y-3">
            {[...(deals ?? []).map((deal) => ({ title: deal.title, type: "Creator offer", status: deal.offer_status ?? deal.stage })),
              ...(projects ?? []).map((project) => ({ title: project.title, type: "Freelancer project", status: project.status }))].slice(0, 6).map((item) => (
              <div className="rounded-md border bg-white p-3" key={`${item.type}-${item.title}`}>
                <div className="flex items-center justify-between gap-3">
                  <p className="font-semibold">{String(item.title ?? "Campaign work")}</p>
                  <Badge>{String(item.status ?? "submitted")}</Badge>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">{item.type}</p>
              </div>
            ))}
            {(deals ?? []).length + (projects ?? []).length === 0 ? <p className="text-sm leading-6 text-muted-foreground">No creator or freelancer work has been recorded yet.</p> : null}
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

function BrandProofCard({ icon, title, items }: { icon: ReactNode; title: string; items: string[] }) {
  const cleaned = unique(items.map((item) => item.trim()).filter(Boolean));
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <div className="rounded-md bg-muted p-2 text-primary">{icon}</div>
      </CardHeader>
      <div className="space-y-2">
        {cleaned.slice(0, 5).map((item) => (
          <div className="rounded-md border bg-white p-3 text-sm leading-5" key={item}>{item}</div>
        ))}
      </div>
    </Card>
  );
}

function toArray(value: unknown) {
  return Array.isArray(value) ? value.map(String) : [];
}

function unique(items: string[]) {
  return Array.from(new Set(items));
}

function collaborationFit(industry: string, campaigns: Array<Record<string, unknown>>) {
  const categories = unique(campaigns.flatMap((campaign) => toArray(campaign.creator_categories))).slice(0, 4);
  if (categories.length) return categories.map((category) => `Looking for ${category} creators`);
  if (industry.toLowerCase().includes("fashion")) return ["Fashion creators", "Lifestyle reels", "Launch and product styling"];
  if (industry.toLowerCase().includes("gaming")) return ["Gaming creators", "Tech reviewers", "Live stream integrations"];
  return ["Creator-led awareness", "India-first campaign storytelling", "Niche communities with clear audience fit"];
}

function productionNeeds(campaigns: Array<Record<string, unknown>>, projects: Array<Record<string, unknown>>) {
  const needs = unique(campaigns.flatMap((campaign) => toArray(campaign.freelancer_needs))).slice(0, 4);
  if (needs.length) return needs;
  if (projects.length) return ["Production support", "Editing and creative assets", "Campaign delivery support"];
  return ["Freelancers can support campaign shoots, edits, graphics, and content production"];
}
