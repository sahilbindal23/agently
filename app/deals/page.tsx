import Link from "next/link";
import { Plus } from "lucide-react";
import { BrandOfferForm } from "@/components/deals/brand-offer-form";
import { AppShell } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/layout/page-header";
import { MessageRecipientButton } from "@/components/messages/message-recipient-button";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, Td, Th } from "@/components/ui/table";
import { getCurrentUser } from "@/lib/auth/session";
import { getAgentlyData } from "@/lib/db/live-data";
import { createAdminClient } from "@/lib/supabase/admin";
import { formatCurrency } from "@/lib/utils/format";

export const dynamic = "force-dynamic";

export default async function DealsPage() {
  const user = await getCurrentUser();
  const admin = createAdminClient();
  const { brands, creators, deals } = await getAgentlyData();
  const isBrand = user?.role === "brand";
  const brandIds = isBrand && admin && user ? await getBrandIdsForUser(admin, user.id, user.email) : [];
  const visibleDeals = isBrand ? deals.filter((deal) => brandIds.includes(deal.brand_id)) : deals;
  const freelancerProjects = admin ? await getVisibleFreelancerProjects(admin, isBrand ? brandIds : null) : [];

  return (
    <AppShell>
      <PageHeader
        eyebrow="Deal pipeline"
        title={isBrand ? "Sent offers and projects" : "Brand deals under management"}
        description={isBrand ? "Track every creator offer and freelancer project your brand has sent from campaign recommendations." : "Brands submit inbound offers. Agently reviews terms, negotiates, controls funding, tracks deliverables, and releases payouts."}
        action={isBrand
          ? <Link className="inline-flex h-10 items-center gap-2 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground" href="/campaigns"><Plus className="h-4 w-4" /> Create campaign</Link>
          : <div className="inline-flex h-10 items-center gap-2 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground"><Plus className="h-4 w-4" /> Inbound offer</div>}
      />
      <Card>
        <CardHeader><CardTitle>{isBrand ? "Creator Offers Sent" : "Pipeline"}</CardTitle><Badge tone="blue">{visibleDeals.length} deals</Badge></CardHeader>
        <div className="overflow-x-auto">
          <Table>
            <thead><tr><Th>Deal</Th><Th>Creator</Th><Th>Brand</Th><Th>Offer</Th><Th>Stage</Th><Th>Due</Th><Th>Risk</Th><Th className="text-right">Amount</Th>{isBrand ? <Th>Conversation</Th> : null}</tr></thead>
            <tbody>
              {visibleDeals.map((deal) => (
                <tr key={deal.id}>
                  <Td><Link className="font-semibold text-primary" href={`/deals/${deal.id}`}>{deal.title}</Link></Td>
                  <Td>{creators.find((creator) => creator.id === deal.creator_id)?.display_name}</Td>
                  <Td>{brands.find((brand) => brand.id === deal.brand_id)?.name}</Td>
                  <Td><Badge tone={deal.offer_status === "accepted" ? "green" : deal.offer_status === "declined" ? "red" : deal.offer_status === "changes_requested" ? "amber" : "blue"}>{deal.offer_status ?? "submitted"}</Badge></Td>
                  <Td><Badge>{deal.stage}</Badge></Td>
                  <Td>{deal.due_date}</Td>
                  <Td><Badge tone={deal.risk_score > 30 ? "amber" : "green"}>{deal.risk_score}</Badge></Td>
                  <Td className="text-right font-bold">{formatCurrency(deal.amount_cents, deal.currency)}</Td>
                  {isBrand ? (
                    <Td>
                      <MessageRecipientButton contextId={deal.id} contextType="deal" entityId={deal.creator_id} entityType="creator" label="Message" />
                    </Td>
                  ) : null}
                </tr>
              ))}
              {visibleDeals.length === 0 ? (
                <tr>
                  <Td colSpan={isBrand ? 9 : 8} className="text-muted-foreground">No creator offers sent yet.</Td>
                </tr>
              ) : null}
            </tbody>
          </Table>
        </div>
      </Card>

      <Card className="mt-5">
        <CardHeader><CardTitle>Freelancer Projects Sent</CardTitle><Badge tone="green">{freelancerProjects.length}</Badge></CardHeader>
        <div className="overflow-x-auto">
          <Table>
            <thead><tr><Th>Project</Th><Th>Status</Th><Th>Payment</Th><Th>Due</Th><Th>Scope</Th><Th className="text-right">Amount</Th>{isBrand ? <Th>Conversation</Th> : null}</tr></thead>
            <tbody>
              {freelancerProjects.map((project) => (
                <tr key={String(project.id)}>
                  <Td className="font-semibold">{String(project.title ?? "Freelancer project")}</Td>
                  <Td><Badge tone={String(project.status) === "accepted" ? "green" : String(project.status) === "changes_requested" ? "amber" : "blue"}>{String(project.status ?? "submitted")}</Badge></Td>
                  <Td>{String(project.payment_status ?? "unpaid")}</Td>
                  <Td>{String(project.due_date ?? "not set")}</Td>
                  <Td className="max-w-md truncate">{String(project.scope ?? "")}</Td>
                  <Td className="text-right font-bold">{formatCurrency(Number(project.amount_cents ?? 0), String(project.currency ?? "inr"))}</Td>
                  {isBrand && project.freelancer_id ? (
                    <Td>
                      <MessageRecipientButton contextId={String(project.id)} contextType="freelancer_project" entityId={String(project.freelancer_id)} entityType="freelancer" label="Message" />
                    </Td>
                  ) : isBrand ? <Td /> : null}
                </tr>
              ))}
              {freelancerProjects.length === 0 ? (
                <tr>
                  <Td colSpan={isBrand ? 7 : 6} className="text-muted-foreground">No freelancer projects sent yet.</Td>
                </tr>
              ) : null}
            </tbody>
          </Table>
        </div>
      </Card>

      {!isBrand ? <Card className="mt-5">
        <CardHeader>
          <div>
            <CardTitle>Brand Offer Intake</CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">This represents the brand portal flow: brand submits terms, then the agency controls review and negotiation.</p>
          </div>
          <Badge tone="green">writes to Supabase</Badge>
        </CardHeader>
        <BrandOfferForm creators={creators} />
      </Card> : null}
    </AppShell>
  );
}

async function getBrandIdsForUser(admin: NonNullable<ReturnType<typeof createAdminClient>>, profileId: string, email: string) {
  const [{ data: audits }, { data: directBrands }] = await Promise.all([
    admin.from("brand_audits").select("brand_id").eq("profile_id", profileId),
    admin.from("brands").select("id").eq("contact_email", email)
  ]);

  return Array.from(new Set([
    ...((audits ?? []).map((audit) => String(audit.brand_id)).filter(Boolean)),
    ...((directBrands ?? []).map((brand) => String(brand.id)).filter(Boolean))
  ]));
}

async function getVisibleFreelancerProjects(admin: NonNullable<ReturnType<typeof createAdminClient>>, brandIds: string[] | null) {
  if (brandIds && brandIds.length === 0) return [];
  const query = admin.from("freelancer_projects").select("*").order("created_at", { ascending: false });
  const { data } = brandIds ? await query.in("brand_id", brandIds) : await query;
  return data ?? [];
}
