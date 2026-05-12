import Link from "next/link";
import { AgentlyContractTemplate } from "@/components/contracts/agently-contract-template";
import { FileText } from "lucide-react";
import { DealContractScanForm } from "@/components/contracts/deal-contract-scan-form";
import { ContractSummaryCard } from "@/components/contracts/contract-summary-card";
import { AppShell } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { getCurrentUser } from "@/lib/auth/session";
import { canSeeDemoData } from "@/lib/db/demo-visibility";
import { getAgentlyData } from "@/lib/db/live-data";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Deal } from "@/types";

export default async function ContractsPage() {
  const user = await getCurrentUser();
  const admin = createAdminClient();
  const { brands, contracts, creators, deals } = await getAgentlyData({ includeDemo: canSeeDemoData(user) });
  const scope = admin && user ? await getContractScope(admin, user) : { brandIds: [], creatorIds: [] };
  const visibleDeals = filterDealsForContracts(deals, user?.role, scope);
  const visibleContracts = contracts.filter((contract) => visibleDeals.some((deal) => deal.id === contract.deal_id));
  const latestContract = visibleContracts[0];
  const dealOptions = visibleDeals.map((deal) => ({
    id: deal.id,
    title: deal.title,
    creatorName: creators.find((creator) => creator.id === deal.creator_id)?.display_name,
    brandName: brands.find((brand) => brand.id === deal.brand_id)?.name
  }));
  const needsScan = visibleDeals.filter((deal) => !visibleContracts.some((contract) => contract.deal_id === deal.id)).length;
  const cautionCount = visibleContracts.filter((contract) => contract.risk_level === "caution").length;
  const highRiskCount = visibleContracts.filter((contract) => contract.risk_level === "high_risk").length;

  return (
    <AppShell>
      <PageHeader
        eyebrow="Contract protection"
        title="AI contract intelligence"
        description="Attach brand agreements to deals, scan terms, and create a contract packet before acceptance, funding, or final delivery."
      />
      <section className="mb-5 grid gap-3 md:grid-cols-4">
        <StatusMetric label="Visible deals" value={visibleDeals.length} tone="blue" />
        <StatusMetric label="Scan needed" value={needsScan} tone={needsScan ? "amber" : "green"} />
        <StatusMetric label="Caution" value={cautionCount} tone={cautionCount ? "amber" : "green"} />
        <StatusMetric label="High risk" value={highRiskCount} tone={highRiskCount ? "red" : "green"} />
      </section>
      <AgentlyContractTemplate />
      <section className="grid gap-5 xl:grid-cols-[0.9fr_1.1fr]">
        <Card>
          <CardHeader><CardTitle>Attach Contract Packet</CardTitle><Badge>{dealOptions.length ? "role scoped" : "no eligible deals"}</Badge></CardHeader>
          {dealOptions.length ? <DealContractScanForm deals={dealOptions} /> : (
            <p className="text-sm leading-6 text-muted-foreground">No deals are currently available for contract scanning in your account.</p>
          )}
        </Card>
        <ContractSummaryCard contract={latestContract} />
      </section>

      <section className="mt-5">
        <Card>
          <CardHeader>
            <CardTitle>Saved Contract Reviews</CardTitle>
            <Badge>{visibleContracts.length} scans</Badge>
          </CardHeader>
          <div className="grid gap-3">
            {visibleContracts.map((contract) => {
              const deal = deals.find((item) => item.id === contract.deal_id);
              return (
                <div key={contract.id} className="flex flex-col gap-3 rounded-md border bg-white p-3 md:flex-row md:items-center md:justify-between">
                  <div>
                    <p className="font-semibold">{deal?.title ?? "Deal contract"}</p>
                    <p className="mt-1 text-sm text-muted-foreground">{contract.summary}</p>
                    <div className="mt-2 flex flex-wrap gap-2 text-xs font-medium text-muted-foreground">
                      <span>{contractGuidance(contract.risk_level)}</span>
                      {contract.file_name ? (
                        <a
                          className="rounded-full bg-muted px-2 py-0.5 text-primary underline-offset-4 hover:underline"
                          href={`/api/storage/contracts/${contract.id}`}
                          rel="noreferrer"
                          target="_blank"
                        >
                          file: {contract.file_name}
                        </a>
                      ) : null}
                      {contract.review_status ? <span className="rounded-full bg-muted px-2 py-0.5">gate: {contract.review_status}</span> : null}
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <Badge tone={contract.risk_level === "safe" ? "green" : contract.risk_level === "caution" ? "amber" : "red"}>
                      {contract.risk_level}
                    </Badge>
                    <Link href={`/deals/${contract.deal_id}`}>
                      <Button type="button" variant="secondary" size="sm"><FileText className="h-4 w-4" /> Deal</Button>
                    </Link>
                  </div>
                </div>
              );
            })}
            {visibleContracts.length === 0 ? (
              <p className="text-sm text-muted-foreground">No saved scans yet for your visible deals. Run a scan above to attach contract intelligence before acceptance or delivery.</p>
            ) : null}
          </div>
        </Card>
      </section>
    </AppShell>
  );
}

type ContractScope = {
  brandIds: string[];
  creatorIds: string[];
};

async function getContractScope(admin: NonNullable<ReturnType<typeof createAdminClient>>, user: NonNullable<Awaited<ReturnType<typeof getCurrentUser>>>): Promise<ContractScope> {
  if (user.role === "admin") return { brandIds: [], creatorIds: [] };

  const [{ data: brands }, { data: audits }, { data: campaigns }, { data: creators }] = await Promise.all([
    admin.from("brands").select("id").eq("contact_email", user.email),
    admin.from("brand_audits").select("brand_id").eq("profile_id", user.id),
    admin.from("campaigns").select("brand_id").eq("profile_id", user.id),
    admin.from("creators").select("id").eq("profile_id", user.id)
  ]);

  return {
    brandIds: Array.from(new Set([
      ...((brands ?? []).map((brand) => String(brand.id))),
      ...((audits ?? []).map((audit) => String(audit.brand_id)).filter(Boolean)),
      ...((campaigns ?? []).map((campaign) => String(campaign.brand_id)).filter(Boolean))
    ])),
    creatorIds: (creators ?? []).map((creator) => String(creator.id))
  };
}

function filterDealsForContracts(deals: Deal[], role: string | undefined, scope: ContractScope) {
  if (role === "admin") return deals;
  if (role === "brand") return deals.filter((deal) => scope.brandIds.includes(deal.brand_id));
  if (role === "creator") return deals.filter((deal) => scope.creatorIds.includes(deal.creator_id));
  return [];
}

function StatusMetric({ label, value, tone }: { label: string; value: number; tone: "blue" | "green" | "amber" | "red" }) {
  return (
    <Card className="p-4">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">{label}</p>
      <div className="mt-3 flex items-center justify-between gap-3">
        <p className="text-2xl font-bold tracking-normal">{value}</p>
        <Badge tone={tone}>{tone === "red" ? "blocker" : tone === "amber" ? "review" : "clear"}</Badge>
      </div>
    </Card>
  );
}

function contractGuidance(risk: string) {
  if (risk === "high_risk") return "Do not accept until usage, exclusivity, payment, and revision risks are narrowed or explicitly acknowledged.";
  if (risk === "caution") return "Review flagged terms before acceptance. This may still be workable with a cleaner counter.";
  return "No major risk flags found. Keep the scan attached for approval and payment history.";
}
