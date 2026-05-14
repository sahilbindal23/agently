import { AlertTriangle, Banknote, Bot, CheckCircle2, Clock, ShieldCheck, TrendingUp, Users } from "lucide-react";
import { VerificationActions } from "@/components/admin/verification-actions";
import { AppShell } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, Td, Th } from "@/components/ui/table";
import { VerificationBadge } from "@/components/verification/verification-badge";
import { getAgentlyData } from "@/lib/db/live-data";
import { createAdminClient } from "@/lib/supabase/admin";
import { formatCurrency } from "@/lib/utils/format";

export default async function DashboardPage() {
  const { brands, contracts, creators, deals, payments, source } = await getAgentlyData();
  const verificationQueue = await getVerificationQueue();
  const pipelineValue = deals.reduce((sum, deal) => sum + deal.amount_cents, 0);
  const activeDeals = deals.filter((deal) => !["paid", "closed"].includes(deal.stage)).length;
  const fundedValue = payments.filter((payment) => ["funded", "release_ready"].includes(payment.status)).reduce((sum, payment) => sum + payment.amount_cents, 0);
  const releaseQueue = payments.filter((payment) => payment.status === "release_ready");

  return (
    <AppShell>
      <PageHeader
        eyebrow="Digital talent manager"
        title="Agency command center"
        description={`Track creator value, brand negotiations, contract risk, and protected payment workflows from one operating system. Data source: ${source}.`}
      />

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Metric title="Pipeline value" value={formatCurrency(pipelineValue, "inr")} icon={<TrendingUp className="h-5 w-5" />} />
        <Metric title="Active deals" value={activeDeals.toString()} icon={<Clock className="h-5 w-5" />} />
        <Metric title="Funded payments" value={formatCurrency(fundedValue, "inr")} icon={<Banknote className="h-5 w-5" />} />
        <Metric title="Creators represented" value={creators.length.toString()} icon={<Users className="h-5 w-5" />} />
      </section>

      <section className="mt-5 grid gap-5 xl:grid-cols-[1.4fr_0.8fr]">
        <Card>
          <CardHeader>
            <CardTitle>Recent Deals</CardTitle>
            <Badge tone="blue">Workflow controlled</Badge>
          </CardHeader>
          <div className="overflow-x-auto">
            <Table>
              <thead>
                <tr>
                  <Th>Deal</Th>
                  <Th>Creator</Th>
                  <Th>Brand</Th>
                  <Th>Stage</Th>
                  <Th>Payment</Th>
                  <Th className="text-right">Amount</Th>
                </tr>
              </thead>
              <tbody>
                {deals.map((deal) => (
                  <tr key={deal.id}>
                    <Td className="font-medium">{deal.title}</Td>
                    <Td>{creators.find((creator) => creator.id === deal.creator_id)?.display_name}</Td>
                    <Td>{brands.find((brand) => brand.id === deal.brand_id)?.name}</Td>
                    <Td><Badge>{deal.stage}</Badge></Td>
                    <Td><PaymentBadge status={deal.payment_status} /></Td>
                    <Td className="text-right font-semibold">{formatCurrency(deal.amount_cents, deal.currency)}</Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </div>
        </Card>

        <div className="grid gap-5">
          <Card>
            <CardHeader>
              <CardTitle>AI Insight Cards</CardTitle>
              <Bot className="h-5 w-5 text-primary" />
            </CardHeader>
            <div className="space-y-3 text-sm">
              <Insight icon={<ShieldCheck className="h-4 w-4" />} title="Contract intelligence" copy="1 deal has paid usage language that should be capped before signature." />
              <Insight icon={<TrendingUp className="h-4 w-4" />} title="Pricing signal" copy="Maya's TikTok package is underpriced if usage extends beyond 30 days." />
              <Insight icon={<CheckCircle2 className="h-4 w-4" />} title="Payment control" copy={`${releaseQueue.length} funded payment is ready for release review.`} />
            </div>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Contract Risks</CardTitle>
              <AlertTriangle className="h-5 w-5 text-amber-600" />
            </CardHeader>
            <div className="space-y-3">
              {contracts.flatMap((contract) => contract.flags).map((flag) => (
                <div key={flag.id} className="rounded-md border bg-white p-3 dark:border-white/8 dark:bg-card">
                  <div className="mb-1 flex items-center justify-between gap-3">
                    <p className="text-sm font-semibold">{flag.flag_type.replace("_", " ")}</p>
                    <Badge tone={flag.severity === "high" ? "red" : "amber"}>{flag.severity}</Badge>
                  </div>
                  <p className="text-xs leading-5 text-muted-foreground">{flag.recommendation}</p>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </section>

      <section className="mt-5">
        <Card>
          <CardHeader>
            <div>
              <CardTitle>Verification Queue</CardTitle>
              <p className="mt-1 text-sm text-muted-foreground">
                Admin trust controls for marketplace listings. Verified means Agently has reviewed profile quality and basic credibility signals, not that outcomes are guaranteed.
              </p>
            </div>
            <Badge tone="amber">{verificationQueue.length} to review</Badge>
          </CardHeader>
          <div className="overflow-x-auto">
            <Table>
              <thead>
                <tr>
                  <Th>Profile</Th>
                  <Th>Type</Th>
                  <Th>Trust tier</Th>
                  <Th>Signals</Th>
                  <Th>Checks</Th>
                  <Th>Admin action</Th>
                </tr>
              </thead>
              <tbody>
                {verificationQueue.map((item) => (
                  <tr key={`${item.type}-${item.id}`}>
                    <Td className="font-medium">{item.name}</Td>
                    <Td>{item.type}</Td>
                    <Td><VerificationBadge status={item.status} tier={item.tier} /></Td>
                    <Td>{item.signals}</Td>
                    <Td>{item.checkSummary}</Td>
                    <Td><VerificationActions entityId={item.id} entityType={item.type} initialChecks={item.checks} /></Td>
                  </tr>
                ))}
                {verificationQueue.length === 0 ? (
                  <tr>
                    <Td colSpan={6} className="text-muted-foreground">No profiles need verification review right now.</Td>
                  </tr>
                ) : null}
              </tbody>
            </Table>
          </div>
        </Card>
      </section>
    </AppShell>
  );
}

async function getVerificationQueue() {
  const admin = createAdminClient();
  if (!admin) return [];

  try {
    // Queue shows anyone who hasn't been decided yet: tier is null,
    // 'unverified', or 'reviewing'. Rows where the admin already clicked
    // Verify or Reject drop out of the queue automatically. Legacy
    // values ('performance', 'social', 'profile') are treated as already
    // verified per the 2-tier model — see lib/campaigns/recommendations
    // isVerifiedTier().
    const pendingFilter = "verification_tier.is.null,verification_tier.eq.unverified,verification_tier.eq.reviewing";
    const [{ data: creators }, { data: freelancers }, { data: brands }] = await Promise.all([
      admin.from("creators").select("*").or(pendingFilter).order("created_at", { ascending: false }).limit(12),
      admin.from("freelancers").select("*").or(pendingFilter).order("created_at", { ascending: false }).limit(12),
      admin.from("brands").select("*").or(pendingFilter).order("created_at", { ascending: false }).limit(12)
    ]);

    return [
      ...(creators ?? []).map((creator) => ({
        id: String(creator.id),
        name: String(creator.display_name ?? "Creator"),
        type: "creator" as const,
        status: String(creator.verification_status ?? "unverified"),
        tier: String(creator.verification_tier ?? "unverified"),
        checks: verificationChecks(creator.verification_checks),
        checkSummary: checkedCount(creator.verification_checks),
        signals: `${creator.primary_niche ?? "No niche"} - India ${Number(creator.india_audience_percent ?? 0)}% - monetization ${Number(creator.monetization_score ?? 0)}/100`
      })),
      ...(freelancers ?? []).map((freelancer) => ({
        id: String(freelancer.id),
        name: String(freelancer.display_name ?? "Freelancer"),
        type: "freelancer" as const,
        status: String(freelancer.verification_status ?? "unverified"),
        tier: String(freelancer.verification_tier ?? "unverified"),
        checks: verificationChecks(freelancer.verification_checks),
        checkSummary: checkedCount(freelancer.verification_checks),
        signals: `${freelancer.service_category ?? "No category"} - ${freelancer.home_city ?? "No city"} - portfolio ${Number(freelancer.portfolio_score ?? 0)}/100`
      })),
      ...(brands ?? []).map((brand) => ({
        id: String(brand.id),
        name: String(brand.name ?? "Brand"),
        type: "brand" as const,
        status: String(brand.verification_status ?? "unverified"),
        tier: String(brand.verification_tier ?? "unverified"),
        checks: verificationChecks(brand.verification_checks),
        checkSummary: checkedCount(brand.verification_checks),
        signals: `${brand.industry ?? "No industry"} - ${brand.website ?? "No website"}`
      }))
    ].slice(0, 12);
  } catch {
    return [];
  }
}

function verificationChecks(value: unknown) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function checkedCount(value: unknown) {
  const checks = verificationChecks(value);
  const completed = Object.values(checks).filter(Boolean).length;
  const total = Object.keys(checks).length;
  return total ? `${completed}/${total} checked` : "No checks yet";
}

function Metric({ title, value, icon }: { title: string; value: string; icon: React.ReactNode }) {
  return (
    <Card>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-muted-foreground">{title}</p>
          <p className="mt-2 text-2xl font-bold">{value}</p>
        </div>
        <div className="rounded-md bg-primary/10 p-3 text-primary">{icon}</div>
      </div>
    </Card>
  );
}

function Insight({ icon, title, copy }: { icon: React.ReactNode; title: string; copy: string }) {
  return (
    <div className="flex gap-3 rounded-md border bg-white p-3 dark:border-white/8 dark:bg-card">
      <div className="mt-0.5 text-primary">{icon}</div>
      <div>
        <p className="font-semibold">{title}</p>
        <p className="mt-1 leading-5 text-muted-foreground">{copy}</p>
      </div>
    </div>
  );
}

function PaymentBadge({ status }: { status: string }) {
  const tone = status === "funded" || status === "release_ready" ? "green" : status === "pending" ? "amber" : "neutral";
  return <Badge tone={tone}>{status}</Badge>;
}
