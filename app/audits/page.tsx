import { AuditWorkbench } from "@/components/ai/audit-workbench";
import { AppShell } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/layout/page-header";
import { requireRole } from "@/lib/auth/guards";

export default async function AuditsPage() {
  await requireRole("admin");
  return (
    <AppShell>
      <PageHeader
        eyebrow="AI intake"
        title="Creator and brand audits"
        description="Turn creator socials, audience notes, brand websites, and campaign briefs into Bangalore-ready profiles, creator archetypes, risk flags, and next-step recommendations."
      />
      <AuditWorkbench />
    </AppShell>
  );
}
