import Link from "next/link";
import { Plus } from "lucide-react";
import { BrandOfferForm } from "@/components/deals/brand-offer-form";
import { AppShell } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, Td, Th } from "@/components/ui/table";
import { getAgentlyData } from "@/lib/db/live-data";
import { formatCurrency } from "@/lib/utils/format";

export default async function DealsPage() {
  const { brands, creators, deals } = await getAgentlyData();

  return (
    <AppShell>
      <PageHeader
        eyebrow="Deal pipeline"
        title="Brand deals under management"
        description="Brands submit inbound offers. Agently reviews terms, negotiates, controls funding, tracks deliverables, and releases payouts."
        action={<div className="inline-flex h-10 items-center gap-2 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground"><Plus className="h-4 w-4" /> Inbound offer</div>}
      />
      <Card>
        <CardHeader><CardTitle>Pipeline</CardTitle><Badge tone="blue">{deals.length} deals</Badge></CardHeader>
        <div className="overflow-x-auto">
          <Table>
            <thead><tr><Th>Deal</Th><Th>Creator</Th><Th>Brand</Th><Th>Offer</Th><Th>Stage</Th><Th>Due</Th><Th>Risk</Th><Th className="text-right">Amount</Th></tr></thead>
            <tbody>
              {deals.map((deal) => (
                <tr key={deal.id}>
                  <Td><Link className="font-semibold text-primary" href={`/deals/${deal.id}`}>{deal.title}</Link></Td>
                  <Td>{creators.find((creator) => creator.id === deal.creator_id)?.display_name}</Td>
                  <Td>{brands.find((brand) => brand.id === deal.brand_id)?.name}</Td>
                  <Td><Badge tone={deal.offer_status === "accepted" ? "green" : deal.offer_status === "declined" ? "red" : deal.offer_status === "changes_requested" ? "amber" : "blue"}>{deal.offer_status ?? "submitted"}</Badge></Td>
                  <Td><Badge>{deal.stage}</Badge></Td>
                  <Td>{deal.due_date}</Td>
                  <Td><Badge tone={deal.risk_score > 30 ? "amber" : "green"}>{deal.risk_score}</Badge></Td>
                  <Td className="text-right font-bold">{formatCurrency(deal.amount_cents, deal.currency)}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
        </div>
      </Card>

      <Card className="mt-5">
        <CardHeader>
          <div>
            <CardTitle>Brand Offer Intake</CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">This represents the brand portal flow: brand submits terms, then the agency controls review and negotiation.</p>
          </div>
          <Badge tone="green">writes to Supabase</Badge>
        </CardHeader>
        <BrandOfferForm creators={creators} />
      </Card>
    </AppShell>
  );
}
