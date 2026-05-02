import Link from "next/link";
import { FileText } from "lucide-react";
import { DealContractScanForm } from "@/components/contracts/deal-contract-scan-form";
import { ContractSummaryCard } from "@/components/contracts/contract-summary-card";
import { AppShell } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { getAgentlyData } from "@/lib/db/live-data";

export default async function ContractsPage() {
  const { brands, contracts, creators, deals } = await getAgentlyData();
  const latestContract = contracts[0];
  const dealOptions = deals.map((deal) => ({
    id: deal.id,
    title: deal.title,
    creatorName: creators.find((creator) => creator.id === deal.creator_id)?.display_name,
    brandName: brands.find((brand) => brand.id === deal.brand_id)?.name
  }));

  return (
    <AppShell>
      <PageHeader
        eyebrow="Contract protection"
        title="AI contract intelligence"
        description="Upload or paste brand agreements and flag risky usage, exclusivity, whitelisting, cancellation, revision, and payment terms."
      />
      <section className="grid gap-5 xl:grid-cols-[0.9fr_1.1fr]">
        <Card>
          <CardHeader><CardTitle>Attach Scan To Deal</CardTitle><Badge>saved to Supabase</Badge></CardHeader>
          <DealContractScanForm deals={dealOptions} />
        </Card>
        <ContractSummaryCard contract={latestContract} />
      </section>

      <section className="mt-5">
        <Card>
          <CardHeader>
            <CardTitle>Saved Contract Reviews</CardTitle>
            <Badge>{contracts.length} scans</Badge>
          </CardHeader>
          <div className="grid gap-3">
            {contracts.map((contract) => {
              const deal = deals.find((item) => item.id === contract.deal_id);
              return (
                <div key={contract.id} className="flex flex-col gap-3 rounded-md border bg-white p-3 md:flex-row md:items-center md:justify-between">
                  <div>
                    <p className="font-semibold">{deal?.title ?? "Deal contract"}</p>
                    <p className="mt-1 text-sm text-muted-foreground">{contract.summary}</p>
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
            {contracts.length === 0 ? (
              <p className="text-sm text-muted-foreground">No saved scans yet. Run a scan above to attach contract intelligence to a live deal.</p>
            ) : null}
          </div>
        </Card>
      </section>
    </AppShell>
  );
}
