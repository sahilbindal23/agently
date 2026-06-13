import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { ArrowLeft, Clock3, ExternalLink, Layers3, PenTool, ShieldCheck, Wrench } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/layout/page-header";
import { MessageRecipientButton } from "@/components/messages/message-recipient-button";
import { AgentlySignalCard } from "@/components/profile/agently-signal-card";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, Td, Th } from "@/components/ui/table";
import { VerificationBadge } from "@/components/verification/verification-badge";
import { getCurrentUser } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { formatCurrency } from "@/lib/utils/format";
import { safeExternalHref } from "@/lib/utils/safe-url";

export default async function FreelancerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [data, currentUser] = await Promise.all([getFreelancerBundle(id), getCurrentUser()]);
  if (!data.freelancer) notFound();

  const freelancer = data.freelancer;
  const isOwnProfile = String(freelancer.profile_id ?? "") === currentUser?.id;
  const skills = toArray(freelancer.skills);
  const serviceRegions = toArray(freelancer.service_regions);
  const languages = toArray(freelancer.languages);
  const pastClients = unique(data.portfolio.map((item) => String(item.brand_client ?? "")).filter(Boolean));

  return (
    <AppShell>
      <PageHeader
        eyebrow="Freelancer profile"
        title={String(freelancer.display_name)}
        description={String(freelancer.bio ?? "Production partner for creator campaigns.")}
        action={<div className="flex flex-wrap gap-2">{isOwnProfile ? null : <MessageRecipientButton entityId={String(freelancer.id)} entityType="freelancer" label="Message freelancer" />}<Link className="inline-flex h-9 items-center gap-2 rounded-md border bg-white px-3 text-sm font-medium" href="/brand-home"><ArrowLeft className="h-4 w-4" /> Marketplace</Link></div>}
      />

      <section className="grid gap-5 xl:grid-cols-[0.85fr_1.15fr]">
        <Card>
          <CardHeader>
            <CardTitle>Service Scorecard</CardTitle>
            <div className="flex flex-wrap gap-2">
              <Badge tone="green">{String(freelancer.service_category ?? "Creative services")}</Badge>
              <VerificationBadge status={freelancer.verification_status} tier={freelancer.verification_tier} />
            </div>
          </CardHeader>
          {freelancer.image_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img alt={String(freelancer.display_name)} className="mb-4 aspect-[4/3] w-full rounded-md object-cover" src={String(freelancer.image_url)} />
          ) : null}
          <div className="grid grid-cols-2 gap-4">
            <Score label="Portfolio" value={`${Number(freelancer.portfolio_score ?? 0)}/100`} />
            <Score label="Rating" value={`${Number(freelancer.rating_score ?? 0)}/5`} />
            <Score label="Hourly" value={formatCurrency(Number(freelancer.hourly_rate_cents ?? freelancer.day_rate_cents ?? 0), "inr")} />
            <Score label="Availability" value={String(freelancer.availability_status ?? "available")} />
          </div>
          <div className="mt-4 rounded-md border bg-white p-4 text-sm leading-6 text-muted-foreground">
            <p><span className="font-semibold text-foreground">City:</span> {String(freelancer.home_city ?? "Flexible")}</p>
            <p><span className="font-semibold text-foreground">Regions:</span> {serviceRegions.join(", ") || "Remote"}</p>
            <p><span className="font-semibold text-foreground">Languages:</span> {languages.join(", ") || "Not captured"}</p>
          </div>
        </Card>

        <Card>
          <CardHeader><CardTitle>Skills & Toolkit</CardTitle><Badge tone="blue">{skills.length}</Badge></CardHeader>
          <div className="flex flex-wrap gap-2">
            {skills.map((skill) => <Badge key={skill}>{skill}</Badge>)}
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <ProofTile icon={<Wrench className="h-4 w-4" />} label="Production toolkit" value={toolkitFromSkills(skills, String(freelancer.service_category ?? ""))} />
            <ProofTile icon={<Clock3 className="h-4 w-4" />} label="Turnaround posture" value={turnaroundFromAvailability(String(freelancer.availability_status ?? "available"))} />
            <ProofTile icon={<Layers3 className="h-4 w-4" />} label="Best for" value={bestForFreelancer(String(freelancer.service_category ?? ""), skills)} />
            <ProofTile icon={<ShieldCheck className="h-4 w-4" />} label="Revision policy" value="Set per project before work starts" />
          </div>
        </Card>
      </section>

      <section className="mt-5 grid gap-5 xl:grid-cols-[0.85fr_1.15fr]">
        <Card>
          <CardHeader><CardTitle>Service Packages</CardTitle><Badge tone="blue">{data.serviceRates.length}</Badge></CardHeader>
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
          <CardHeader><CardTitle>Portfolio Gallery</CardTitle><Badge tone="green">{data.portfolio.length}</Badge></CardHeader>
          <div className="grid gap-3 md:grid-cols-2">
            {data.portfolio.slice(0, 6).map((item) => (
              <a className="group rounded-md border bg-white p-4 transition hover:border-primary hover:shadow-soft" href={safeExternalHref(item.url) ?? "#"} key={String(item.id)} target="_blank" rel="noopener noreferrer nofollow">
                <div className="mb-3 flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold">{String(item.title)}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{String(item.category ?? "Portfolio work")}</p>
                  </div>
                  <ExternalLink className="h-4 w-4 text-muted-foreground transition group-hover:text-primary" />
                </div>
                <p className="text-sm leading-6 text-muted-foreground">{String(item.description ?? "Portfolio proof for production capability.")}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {item.brand_client ? <Badge tone="blue">{String(item.brand_client)}</Badge> : null}
                  {item.media_type ? <Badge>{String(item.media_type)}</Badge> : null}
                </div>
              </a>
            ))}
            {data.portfolio.length === 0 ? <p className="text-sm leading-6 text-muted-foreground">No portfolio items have been added yet.</p> : null}
          </div>
        </Card>
      </section>

      <section className="mt-5 grid gap-5 xl:grid-cols-3">
        <Card>
          <CardHeader><CardTitle>Past Clients</CardTitle><PenTool className="h-4 w-4 text-primary" /></CardHeader>
          <div className="flex flex-wrap gap-2">
            {pastClients.length ? pastClients.map((client) => <Badge key={client} tone="blue">{client}</Badge>) : <p className="text-sm text-muted-foreground">No client names listed yet.</p>}
          </div>
        </Card>
        <AgentlySignalCard
          title="Production Trust Signals"
          description="Freelancer profiles should help brands judge execution risk, not audience reach. These signals focus on proof of work, service clarity, and delivery readiness."
          signals={[
            `${data.portfolio.length} portfolio item${data.portfolio.length === 1 ? "" : "s"} attached`,
            `${data.serviceRates.length} service package${data.serviceRates.length === 1 ? "" : "s"} listed for clearer quoting`,
            skills.length ? `Core skills: ${skills.slice(0, 4).join(", ")}` : "Core skills still need to be added",
            serviceRegions.length ? `Available in ${serviceRegions.slice(0, 4).join(", ")}` : "Remote or city coverage still needs review",
            "Scope, file formats, revision count, usage, and approval timing should be confirmed before acceptance"
          ]}
        />
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

function unique(items: string[]) {
  return Array.from(new Set(items));
}

function ProofTile({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-md border bg-white p-3">
      <div className="mb-2 flex items-center gap-2 text-primary">{icon}<p className="text-xs font-semibold uppercase text-muted-foreground">{label}</p></div>
      <p className="text-sm font-medium leading-5">{value}</p>
    </div>
  );
}

function toolkitFromSkills(skills: string[], category: string) {
  const text = `${skills.join(" ")} ${category}`.toLowerCase();
  if (text.includes("video") || text.includes("shoot")) return "Video production, editing, creator campaign assets";
  if (text.includes("design") || text.includes("graphic")) return "Design systems, social assets, campaign creatives";
  if (text.includes("podcast") || text.includes("audio")) return "Podcast capture, edits, clips, and audio cleanup";
  return "Creative production support for campaign execution";
}

function turnaroundFromAvailability(availability: string) {
  if (availability.toLowerCase().includes("limited")) return "Plan ahead; confirm dates before shortlisting";
  if (availability.toLowerCase().includes("busy")) return "Good for scheduled work, less ideal for rush jobs";
  return "Suitable for active campaign briefs and near-term projects";
}

function bestForFreelancer(category: string, skills: string[]) {
  const text = `${category} ${skills.join(" ")}`.toLowerCase();
  if (text.includes("edit")) return "Editing, cutdowns, reels, and post-production";
  if (text.includes("shoot") || text.includes("video")) return "On-ground shoots, product videos, and campaign assets";
  if (text.includes("design")) return "Static creatives, decks, graphics, and visual identity work";
  return "Production work that supports creator or brand campaigns";
}
