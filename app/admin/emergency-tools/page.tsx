import { redirect } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/layout/page-header";
import { EmergencyToolsPanels } from "@/components/admin/emergency-tools-panels";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { getCurrentUser } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export default async function EmergencyToolsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role !== "admin") redirect("/dashboard");

  const admin = createAdminClient();
  const [frozenAccounts, openDisputes, fundedDeals] = admin
    ? await Promise.all([
        admin
          .from("profiles")
          .select("id, email, full_name, role, frozen_at, frozen_reason")
          .eq("account_status", "frozen")
          .order("frozen_at", { ascending: false })
          .limit(20),
        admin
          .from("disputes")
          .select("id, deal_id, freelancer_project_id, opener_role, reason, created_at")
          .eq("status", "open")
          .order("created_at", { ascending: false })
          .limit(20),
        admin
          .from("deals")
          .select("id, title, amount_cents, payment_status, dispute_status, brand_id, creator_id, created_at")
          .in("payment_status", ["funded", "release_ready", "released"])
          .order("created_at", { ascending: false })
          .limit(20)
      ])
    : [{ data: [] }, { data: [] }, { data: [] }];

  return (
    <AppShell>
      <PageHeader
        eyebrow="Trust and safety"
        title="Emergency tools"
        description="Fast actions for trust-and-safety incidents. Every action writes an audit log entry. Use sparingly — most disputes should resolve through the normal /disputes flow with full context, not from here."
      />

      <Card className="mb-5 border-amber-200 bg-amber-50/40 dark:border-amber-900/50 dark:bg-amber-950/15">
        <CardHeader>
          <CardTitle className="text-amber-900 dark:text-amber-200">When to use these</CardTitle>
          <Badge tone="amber">read first</Badge>
        </CardHeader>
        <ul className="grid gap-2 text-sm leading-6 text-amber-900/80 dark:text-amber-100/80">
          <li><strong>Freeze user</strong> — confirmed fraud, abuse, or impersonation. Blocks login immediately; existing sessions expire on next JWT refresh (~1h).</li>
          <li><strong>Force refund</strong> — Stripe/Razorpay refund already happened externally and you need to mark the deal accordingly. This does NOT trigger an actual refund through the payment provider.</li>
          <li><strong>Force-resolve dispute</strong> — both parties unresponsive, evidence overwhelming, or operationally stuck. Use the regular /disputes page when possible — it has full context.</li>
        </ul>
      </Card>

      <EmergencyToolsPanels
        currentFrozen={(frozenAccounts.data ?? []).map(toFrozen)}
        openDisputes={(openDisputes.data ?? []).map(toDispute)}
        recentFundedDeals={(fundedDeals.data ?? []).map(toDeal)}
      />
    </AppShell>
  );
}

function toFrozen(row: Record<string, unknown>) {
  return {
    id: String(row.id),
    email: String(row.email ?? ""),
    full_name: row.full_name ? String(row.full_name) : null,
    role: row.role ? String(row.role) : null,
    frozen_at: row.frozen_at ? String(row.frozen_at) : null,
    frozen_reason: row.frozen_reason ? String(row.frozen_reason) : null
  };
}

function toDispute(row: Record<string, unknown>) {
  return {
    id: String(row.id),
    deal_id: row.deal_id ? String(row.deal_id) : null,
    freelancer_project_id: row.freelancer_project_id ? String(row.freelancer_project_id) : null,
    opener_role: String(row.opener_role ?? ""),
    reason: String(row.reason ?? ""),
    created_at: String(row.created_at ?? "")
  };
}

function toDeal(row: Record<string, unknown>) {
  return {
    id: String(row.id),
    title: String(row.title ?? "Untitled deal"),
    amount_cents: Number(row.amount_cents ?? 0),
    payment_status: String(row.payment_status ?? ""),
    dispute_status: String(row.dispute_status ?? "none"),
    created_at: String(row.created_at ?? "")
  };
}
