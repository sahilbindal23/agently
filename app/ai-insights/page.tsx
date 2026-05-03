import { Handshake, SearchCheck, ShieldAlert, Sparkles, WalletCards } from "lucide-react";
import { redirect } from "next/navigation";
import { BrandMatchEngine } from "@/components/ai/brand-match-engine";
import { NegotiationCopilot } from "@/components/ai/negotiation-copilot";
import { ValuationEngine } from "@/components/ai/valuation-engine";
import { AppShell } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardTitle } from "@/components/ui/card";
import { getCurrentUser } from "@/lib/auth/session";
import { getAgentlyData } from "@/lib/db/live-data";
import { createAdminClient } from "@/lib/supabase/admin";

const modules = [
  { title: "Sponsor Growth Calculator", icon: Sparkles, copy: "India-first pricing and target planning for creators who want to understand what metrics unlock higher sponsorship income." },
  { title: "Brand match engine", icon: SearchCheck, copy: "Scores brands by niche, audience, category fit, content style, and outreach angle." },
  { title: "Negotiation copilot", icon: Handshake, copy: "Recommends counters, floors, pushback terms, and talent-friendly response copy for creators and freelancers." },
  { title: "Contract intelligence", icon: ShieldAlert, copy: "Finds risky terms across usage, exclusivity, revisions, cancellation, whitelisting, and payment timing." },
  { title: "Payment risk scoring", icon: WalletCards, copy: "Tracks payment delays, dispute states, release readiness, and future brand reliability signals." }
];

export default async function AiInsightsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const user = await getCurrentUser();
  if (user?.role === "brand") redirect("/campaigns");
  const { creators } = await getAgentlyData();
  const visibleCreators = await getVisibleCreators(creators, user);
  const showNegotiationCopilot = user?.role === "admin" || user?.role === "creator" || user?.role === "freelancer";
  const negotiationRole = user?.role === "creator" || user?.role === "freelancer" ? user.role : "admin";
  const visibleModules = modules.filter((module) => showNegotiationCopilot || module.title !== "Negotiation copilot");

  return (
    <AppShell>
      <PageHeader
        eyebrow="AI plus transaction data"
        title="Agency intelligence layer"
        description="India-first AI for pricing, creator-brand matching, negotiation, contract review, and payment risk. The long-term moat compounds from closed deal outcomes and campaign performance."
      />
      <section className="grid gap-5 lg:grid-cols-5">
        {visibleModules.map((module) => {
          const Icon = module.icon;
          return (
            <Card key={module.title} className="lg:col-span-1">
              <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-md bg-primary/10 text-primary">
                <Icon className="h-5 w-5" />
              </div>
              <CardTitle>{module.title}</CardTitle>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">{module.copy}</p>
            </Card>
          );
        })}
      </section>

      <ValuationEngine />

      <BrandMatchEngine creators={visibleCreators} role={user?.role ?? "admin"} />

      {showNegotiationCopilot ? <NegotiationCopilot initialValues={negotiationPrefill(params)} role={negotiationRole} /> : null}
    </AppShell>
  );
}

function negotiationPrefill(params: Record<string, string | string[] | undefined>) {
  return {
    offer_amount_inr: first(params.amount),
    brand: first(params.brand),
    deliverables: first(params.deliverables),
    contract_terms: first(params.terms),
    valuation_context: first(params.context)
  };
}

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

async function getVisibleCreators(creators: Awaited<ReturnType<typeof getAgentlyData>>["creators"], user: Awaited<ReturnType<typeof getCurrentUser>>) {
  if (user?.role !== "creator") return creators;

  const admin = createAdminClient();
  if (!admin) return creators;

  const { data } = await admin
    .from("creators")
    .select("id")
    .eq("profile_id", user.id)
    .maybeSingle();

  return data?.id ? creators.filter((creator) => creator.id === data.id) : creators;
}
