import { redirect } from "next/navigation";
import { Activity, BarChart3, Banknote, FileWarning, MessageSquare, ShieldCheck, Target, Users } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, Td, Th } from "@/components/ui/table";
import { getCurrentUser } from "@/lib/auth/session";
import { homeForRole } from "@/lib/auth/guards";
import { createAdminClient } from "@/lib/supabase/admin";

type ProductEvent = {
  id: string;
  profile_id: string | null;
  role: string | null;
  event_name: string;
  entity_type: string | null;
  entity_id: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
};

type EventMetric = {
  label: string;
  value: number | string;
  detail: string;
  icon: React.ReactNode;
  tone: "blue" | "green" | "amber" | "red";
};

export const dynamic = "force-dynamic";

export default async function AnalyticsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role !== "admin") redirect(homeForRole(user.role));

  const admin = createAdminClient();
  if (!admin) redirect("/dashboard");

  if (user.role !== "admin") {
    return (
      <AppShell>
        <PageHeader
          eyebrow="Marketplace telemetry"
          title="Analytics"
          description="This view is reserved for Agently admins."
        />
        <Card>
          <p className="font-semibold">Admin access required</p>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">Creators, freelancers, and brands see role-specific insights on their own dashboards.</p>
        </Card>
      </AppShell>
    );
  }

  const events = await getProductEvents(admin);
  const metrics = getMetrics(events);
  const offerFunnel = getOfferFunnel(events);
  const riskBreakdown = getRiskBreakdown(events);
  const recent = events.slice(0, 40);

  return (
    <AppShell>
      <PageHeader
        eyebrow="Marketplace intelligence"
        title="Product Analytics"
        description="Internal event stream for the proprietary data moat: shortlists, offers, counters, payments, contracts, messages, social connects, and delivery outcomes."
      />

      <section className="mb-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {metrics.map((metric) => <MetricCard key={metric.label} metric={metric} />)}
      </section>

      <section className="mb-5 grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
        <Card>
          <CardHeader>
            <CardTitle>Offer Conversion</CardTitle>
            <Badge tone={offerFunnel.accepted > offerFunnel.declined ? "green" : "amber"}>{offerFunnel.conversionRate}% accepted</Badge>
          </CardHeader>
          <div className="grid gap-3 sm:grid-cols-4">
            <FunnelStat label="Sent" value={offerFunnel.sent} />
            <FunnelStat label="Accepted" value={offerFunnel.accepted} />
            <FunnelStat label="Countered" value={offerFunnel.countered} />
            <FunnelStat label="Declined" value={offerFunnel.declined} />
          </div>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Contract Intelligence</CardTitle>
            <Badge tone={riskBreakdown.high_risk ? "red" : riskBreakdown.caution ? "amber" : "green"}>{riskBreakdown.total} scans</Badge>
          </CardHeader>
          <div className="grid gap-3 sm:grid-cols-3">
            <FunnelStat label="Safe" value={riskBreakdown.safe} />
            <FunnelStat label="Caution" value={riskBreakdown.caution} />
            <FunnelStat label="High risk" value={riskBreakdown.high_risk} />
          </div>
        </Card>
      </section>

      <Card>
        <CardHeader>
          <CardTitle>Recent Product Events</CardTitle>
          <Badge tone="blue">{recent.length} latest</Badge>
        </CardHeader>
        <div className="overflow-x-auto">
          <Table>
            <thead>
              <tr>
                <Th>Event</Th>
                <Th>Role</Th>
                <Th>Entity</Th>
                <Th>Signal</Th>
                <Th>Time</Th>
              </tr>
            </thead>
            <tbody>
              {recent.map((event) => (
                <tr key={event.id}>
                  <Td className="font-medium">{humanize(event.event_name)}</Td>
                  <Td>{event.role || "unknown"}</Td>
                  <Td>{event.entity_type || "workflow"}</Td>
                  <Td>{eventSignal(event)}</Td>
                  <Td>{formatTime(event.created_at)}</Td>
                </tr>
              ))}
              {!recent.length ? (
                <tr>
                  <Td colSpan={5}>
                    <p className="rounded-md border bg-muted p-3 text-sm text-muted-foreground">
                      No product events yet. Run migration 028, then create a campaign, shortlist talent, send an offer, or scan a contract to start collecting data.
                    </p>
                  </Td>
                </tr>
              ) : null}
            </tbody>
          </Table>
        </div>
      </Card>
    </AppShell>
  );
}

async function getProductEvents(admin: NonNullable<ReturnType<typeof createAdminClient>>) {
  try {
    const { data, error } = await admin
      .from("product_events")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(500);

    if (error) return [];
    return (data ?? []) as ProductEvent[];
  } catch {
    return [];
  }
}

function getMetrics(events: ProductEvent[]): EventMetric[] {
  const campaigns = count(events, "campaign_created");
  const shortlists = count(events, "talent_shortlisted");
  const messages = count(events, "message_sent");
  const payments = count(events, "payment_status_updated") + count(events, "payment_link_created");
  const contracts = count(events, "contract_scanned");
  const socials = count(events, "social_connected");
  const delivery = count(events, "deliverable_submitted") + count(events, "deliverable_approved");
  const counters = count(events, "offer_countered") + count(events, "freelancer_project_countered") + count(events, "counter_accepted") + count(events, "counter_declined");

  return [
    { label: "Campaign briefs", value: campaigns, detail: "Brand demand entering the marketplace", icon: <Target className="h-4 w-4" />, tone: "blue" },
    { label: "Talent shortlists", value: shortlists, detail: "Discovery signals from brand intent", icon: <Users className="h-4 w-4" />, tone: "green" },
    { label: "Negotiation moves", value: counters, detail: "Counter behavior and term friction", icon: <BarChart3 className="h-4 w-4" />, tone: counters ? "amber" : "blue" },
    { label: "Messages sent", value: messages, detail: "Direct collaboration activity", icon: <MessageSquare className="h-4 w-4" />, tone: "blue" },
    { label: "Payment events", value: payments, detail: "Funding and payout workflow movement", icon: <Banknote className="h-4 w-4" />, tone: payments ? "green" : "blue" },
    { label: "Contract scans", value: contracts, detail: "Risk patterns from creator agreements", icon: <FileWarning className="h-4 w-4" />, tone: contracts ? "amber" : "blue" },
    { label: "Social connects", value: socials, detail: "Verified creator data sources", icon: <ShieldCheck className="h-4 w-4" />, tone: socials ? "green" : "blue" },
    { label: "Delivery events", value: delivery, detail: "Submissions and approvals", icon: <Activity className="h-4 w-4" />, tone: delivery ? "green" : "blue" }
  ];
}

function getOfferFunnel(events: ProductEvent[]) {
  const sent = count(events, "offer_sent") + count(events, "freelancer_project_sent");
  const accepted = count(events, "offer_accepted") + count(events, "freelancer_project_accepted");
  const countered = count(events, "offer_countered") + count(events, "freelancer_project_countered");
  const declined = count(events, "offer_declined") + count(events, "freelancer_project_declined");
  const conversionRate = sent ? Math.round((accepted / sent) * 100) : 0;
  return { accepted, conversionRate, countered, declined, sent };
}

function getRiskBreakdown(events: ProductEvent[]) {
  const scans = events.filter((event) => event.event_name === "contract_scanned");
  return {
    total: scans.length,
    safe: scans.filter((event) => event.metadata?.risk_level === "safe").length,
    caution: scans.filter((event) => event.metadata?.risk_level === "caution").length,
    high_risk: scans.filter((event) => event.metadata?.risk_level === "high_risk").length
  };
}

function MetricCard({ metric }: { metric: EventMetric }) {
  return (
    <Card className="p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">{metric.label}</p>
        <span className="text-primary">{metric.icon}</span>
      </div>
      <p className="mt-3 text-2xl font-bold tracking-normal">{metric.value}</p>
      <p className="mt-2 text-sm leading-5 text-muted-foreground">{metric.detail}</p>
      <Badge className="mt-3" tone={metric.tone}>tracked</Badge>
    </Card>
  );
}

function FunnelStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md border bg-muted/40 p-3">
      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">{label}</p>
      <p className="mt-2 text-2xl font-bold tracking-normal">{value}</p>
    </div>
  );
}

function count(events: ProductEvent[], eventName: string) {
  return events.filter((event) => event.event_name === eventName).length;
}

function humanize(value: string) {
  return value.split("_").map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(" ");
}

function eventSignal(event: ProductEvent) {
  const metadata = event.metadata ?? {};
  if (typeof metadata.amount_cents === "number") return `INR ${Math.round(metadata.amount_cents / 100).toLocaleString("en-IN")}`;
  if (typeof metadata.fit_score === "number") return `Fit ${Math.round(metadata.fit_score)}`;
  if (typeof metadata.risk_level === "string") return metadata.risk_level;
  if (typeof metadata.provider === "string") return metadata.provider;
  if (typeof metadata.status === "string") return metadata.status;
  if (typeof metadata.message_length === "number") return `${metadata.message_length} chars`;
  return "-";
}

function formatTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" });
}
