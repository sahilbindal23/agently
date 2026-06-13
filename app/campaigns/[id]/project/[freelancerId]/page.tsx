import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { FreelancerProjectComposerForm } from "@/components/campaigns/freelancer-project-composer-form";
import { AppShell } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { getCurrentUser } from "@/lib/auth/session";
import { canAccessCampaign } from "@/lib/auth/guards";
import { createAdminClient } from "@/lib/supabase/admin";
import { formatCurrency } from "@/lib/utils/format";

export default async function FreelancerProjectComposerPage({ params }: { params: Promise<{ id: string; freelancerId: string }> }) {
  const { id, freelancerId } = await params;
  // Only the campaign owner (or admin) may compose a project from it.
  const user = await getCurrentUser();
  if (!(await canAccessCampaign(user, id))) notFound();
  const data = await getProjectData(id, freelancerId);
  if (!data.campaign || !data.freelancer) notFound();

  return (
    <AppShell>
      <PageHeader
        eyebrow="Freelancer project composer"
        title={`Project for ${data.freelancer.display_name}`}
        description="Confirm scope, cost, deadline, usage context, and approval terms before sending this to the freelancer."
        action={<Link className="inline-flex h-10 items-center gap-2 rounded-md border bg-white px-4 text-sm font-medium" href={`/campaigns/${id}`}><ArrowLeft className="h-4 w-4" /> Back to campaign</Link>}
      />

      <section className="grid gap-5 xl:grid-cols-[0.8fr_1.2fr]">
        <Card>
          <CardHeader><CardTitle>Campaign Context</CardTitle><Badge tone="blue">freelancer project</Badge></CardHeader>
          <div className="space-y-3 text-sm leading-6">
            <Info label="Campaign" value={data.campaign.title} />
            <Info label="Budget" value={formatCurrency(data.campaign.budget_cents ?? 0, "inr")} />
            <Info label="Freelancer service" value={data.freelancer.service_category || "Creative services"} />
            <Info label="Hourly rate" value={formatCurrency(data.freelancer.hourly_rate_cents ?? data.freelancer.day_rate_cents ?? 0, "inr")} />
          </div>
        </Card>

        <Card>
          <CardHeader>
            <div>
              <CardTitle>Compose Project</CardTitle>
              <p className="mt-1 text-sm text-muted-foreground">This creates a freelancer-specific project offer, separate from creator posting deals.</p>
            </div>
            <Badge tone="green">pre-project</Badge>
          </CardHeader>
          <FreelancerProjectComposerForm
            campaignId={id}
            campaignTitle={data.campaign.title}
            defaultAmountInr={Math.round((data.freelancer.hourly_rate_cents ?? data.freelancer.day_rate_cents ?? 0) / 100)}
            freelancerId={freelancerId}
          />
        </Card>
      </section>
    </AppShell>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border bg-white p-3">
      <p className="text-xs font-semibold uppercase text-muted-foreground">{label}</p>
      <p className="mt-1">{value}</p>
    </div>
  );
}

async function getProjectData(campaignId: string, freelancerId: string) {
  const admin = createAdminClient();
  if (!admin) return { campaign: null, freelancer: null };

  const [campaignResult, freelancerResult] = await Promise.all([
    admin.from("campaigns").select("*").eq("id", campaignId).maybeSingle(),
    admin.from("freelancers").select("*").eq("id", freelancerId).maybeSingle()
  ]);

  return {
    campaign: campaignResult.data,
    freelancer: freelancerResult.data
  };
}
