import { AppShell } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, Td, Th } from "@/components/ui/table";
import { VerificationBadge } from "@/components/verification/verification-badge";
import { getCurrentUser } from "@/lib/auth/session";
import { canSeeDemoData, withoutDemoRows } from "@/lib/db/demo-visibility";
import { createAdminClient } from "@/lib/supabase/admin";
import { formatCurrency } from "@/lib/utils/format";

export default async function FreelancersPage() {
  const user = await getCurrentUser();
  const includeDemo = canSeeDemoData(user);
  const admin = createAdminClient();
  const [{ data: freelancers }, { data: serviceRates }] = admin
    ? await Promise.all([
      admin.from("freelancers").select("*").order("created_at", { ascending: false }),
      admin.from("freelancer_service_rates").select("*")
    ])
    : [{ data: [] }, { data: [] }];

  const visibleFreelancers = withoutDemoRows(freelancers ?? [], includeDemo);

  return (
    <AppShell>
      <PageHeader
        eyebrow="Production talent"
        title="Freelancer network"
        description="Videographers, editors, graphic designers, motion designers, photographers, and production partners that brands can hire around creator campaigns."
      />
      <Card>
        <CardHeader><CardTitle>Available Freelancers</CardTitle><Badge tone="blue">{visibleFreelancers.length}</Badge></CardHeader>
        <div className="overflow-x-auto">
          <Table>
            <thead><tr><Th>Name</Th><Th>Verification</Th><Th>Service</Th><Th>City</Th><Th>Skills</Th><Th>Project rates</Th><Th className="text-right">Hourly</Th><Th>Availability</Th></tr></thead>
            <tbody>
              {visibleFreelancers.map((freelancer) => (
                <tr key={freelancer.id}>
                  <Td className="font-medium">{freelancer.display_name}</Td>
                  <Td><VerificationBadge status={freelancer.verification_status} tier={freelancer.verification_tier} /></Td>
                  <Td>{freelancer.service_category}</Td>
                  <Td>{freelancer.home_city}</Td>
                  <Td>{(freelancer.skills ?? []).slice(0, 3).join(", ")}</Td>
                  <Td>{(serviceRates ?? []).filter((rate) => rate.freelancer_id === freelancer.id).slice(0, 2).map((rate) => rate.service_name).join(", ") || "Not listed"}</Td>
                  <Td className="text-right font-semibold">{formatCurrency(freelancer.hourly_rate_cents ?? freelancer.day_rate_cents ?? 0, "inr")}</Td>
                  <Td><Badge tone="green">{freelancer.availability_status ?? "available"}</Badge></Td>
                </tr>
              ))}
            </tbody>
          </Table>
        </div>
      </Card>
    </AppShell>
  );
}
