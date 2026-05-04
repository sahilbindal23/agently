import { notFound } from "next/navigation";
import { ShieldAlert } from "lucide-react";
import { ContractSummaryCard } from "@/components/contracts/contract-summary-card";
import { DealContractScanForm } from "@/components/contracts/deal-contract-scan-form";
import { DeliverableCard } from "@/components/deliverables/deliverable-card";
import { AppShell } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/layout/page-header";
import { PaymentActions } from "@/components/payments/payment-actions";
import { DealProtectionTimeline } from "@/components/protection/deal-protection-timeline";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { getCurrentUser } from "@/lib/auth/session";
import { getDealBundle } from "@/lib/db/live-data";
import { createAdminClient } from "@/lib/supabase/admin";
import { formatCurrency } from "@/lib/utils/format";
import type { Deliverable } from "@/types";

export default async function DealDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [{ deal, creator, brand, payment, contract }, user] = await Promise.all([
    getDealBundle(id),
    getCurrentUser()
  ]);
  if (!deal) notFound();
  const isAdmin = user?.role === "admin";
  const deliverable = await getLatestDeliverable(id);

  return (
    <AppShell>
      <PageHeader eyebrow="Deal workspace" title={deal.title} description={`${creator?.display_name} x ${brand?.name}`} />
      <div className="mb-5">
        <DealProtectionTimeline
          accepted={deal.offer_status === "accepted"}
          contractRisk={contract?.risk_level}
          deliverableStatus={deliverable?.status ?? deal.deliverable_status}
          hasContract={Boolean(contract)}
          hasDeliverable={Boolean(deliverable)}
          paymentStatus={deal.payment_status}
        />
      </div>
      <section className="grid gap-5 xl:grid-cols-[1.2fr_0.8fr]">
        <Card>
          <CardHeader><CardTitle>Commercial Terms</CardTitle><Badge>{deal.stage}</Badge></CardHeader>
          <div className="grid gap-4 md:grid-cols-2">
            <Info label="Amount" value={formatCurrency(deal.amount_cents, deal.currency)} />
            <Info label="Due date" value={deal.due_date} />
            <Info label="Payment status" value={deal.payment_status} />
            <Info label="Deliverable status" value={deal.deliverable_status} />
          </div>
          <div className="mt-5 rounded-md border bg-white p-4">
            <p className="text-sm font-semibold">Deliverables</p>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">{deal.deliverables}</p>
          </div>
        </Card>

        <Card>
          <CardHeader><CardTitle>Actions</CardTitle></CardHeader>
          <div className="space-y-3">
            {contract?.risk_level === "high_risk" ? (
              <div className="rounded-md border bg-red-50 p-3 text-sm leading-6 text-red-800">
                <div className="mb-1 flex items-center gap-2 font-semibold"><ShieldAlert className="h-4 w-4" /> High-risk contract</div>
                Negotiate flagged terms before funding or accepting broad usage rights.
              </div>
            ) : null}
            <PaymentActions canFund={deal.offer_status === "accepted"} canRelease={isAdmin} entityId={deal.id} entityType="deal" isAdmin={isAdmin} paymentStatus={deal.payment_status} />
          </div>
        </Card>
      </section>

      <section className="mt-5 grid gap-5 xl:grid-cols-3">
        <Card>
          <CardHeader><CardTitle>Payment Control</CardTitle></CardHeader>
          <p className="text-2xl font-bold">{payment ? formatCurrency(payment.creator_payout_cents, deal.currency) : "Not funded"}</p>
          <p className="mt-2 text-sm text-muted-foreground">Creator payout after platform fee. Manual release now, Stripe Connect-ready later.</p>
        </Card>
        <Card>
          <CardHeader><CardTitle>Deliverable Review</CardTitle></CardHeader>
          <DeliverableCard deliverable={deliverable} canReview />
        </Card>
        <ContractSummaryCard contract={contract} />
        <Card>
          <CardHeader><CardTitle>Negotiation Advice</CardTitle></CardHeader>
          <p className="text-sm leading-6 text-muted-foreground">
            Counter at {formatCurrency(Math.round(deal.amount_cents * 1.18), deal.currency)}, cap usage at 30 days, and require funded payment before publication.
          </p>
        </Card>
      </section>

      <section className="mt-5">
        <Card>
          <CardHeader>
            <CardTitle>{contract ? "Re-scan Contract" : "Scan Contract"}</CardTitle>
            <Badge>{contract ? "updates latest risk" : "before signature"}</Badge>
          </CardHeader>
          <DealContractScanForm dealId={deal.id} />
        </Card>
      </section>
    </AppShell>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border bg-white p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-2 font-semibold">{value}</p>
    </div>
  );
}

async function getLatestDeliverable(dealId: string) {
  const admin = createAdminClient();
  if (!admin) return null;
  const { data } = await admin
    .from("deliverables")
    .select("*")
    .eq("deal_id", dealId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data as Deliverable | null;
}
