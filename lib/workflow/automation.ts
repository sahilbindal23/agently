import { trackEvent } from "@/lib/analytics/track";
import { ensurePaymentRecordForEntity } from "@/lib/payments/workflow";
import type { createAdminClient } from "@/lib/supabase/admin";

type AdminClient = NonNullable<ReturnType<typeof createAdminClient>>;
type Row = Record<string, unknown>;
type EntityType = "deal" | "freelancer_project";

export type AutomationAction = {
  entityId: string;
  entityType: EntityType | "payment" | "deliverable";
  from?: string | null;
  reason: string;
  title: string;
  to?: string | null;
};

export type AutomationRunResult = {
  actions: AutomationAction[];
  checked: {
    deals: number;
    deliverables: number;
    payments: number;
    projects: number;
  };
};

export async function runWorkflowAutomations(admin: AdminClient): Promise<AutomationRunResult> {
  const [dealsResult, projectsResult, paymentsResult, deliverablesResult] = await Promise.all([
    admin.from("deals").select("*").order("created_at", { ascending: false }),
    admin.from("freelancer_projects").select("*").order("created_at", { ascending: false }),
    admin.from("payments").select("*").order("created_at", { ascending: false }),
    admin.from("deliverables").select("*").order("created_at", { ascending: false })
  ]);

  const deals = rows(dealsResult.data);
  const projects = rows(projectsResult.data);
  const payments = rows(paymentsResult.data);
  const deliverables = rows(deliverablesResult.data);
  const actions: AutomationAction[] = [];

  for (const deal of deals) {
    await automateEntity({
      actions,
      admin,
      deliverables: deliverables.filter((deliverable) => sameId(deliverable.deal_id, deal.id)),
      entity: deal,
      entityType: "deal",
      payments: payments.filter((payment) => sameId(payment.deal_id, deal.id)),
      table: "deals",
      title: text(deal.title, "Creator deal")
    });
  }

  for (const project of projects) {
    await automateEntity({
      actions,
      admin,
      deliverables: deliverables.filter((deliverable) => sameId(deliverable.freelancer_project_id, project.id)),
      entity: project,
      entityType: "freelancer_project",
      payments: payments.filter((payment) => sameId(payment.freelancer_project_id, project.id)),
      table: "freelancer_projects",
      title: text(project.title, "Freelancer project")
    });
  }

  return {
    actions,
    checked: {
      deals: deals.length,
      deliverables: deliverables.length,
      payments: payments.length,
      projects: projects.length
    }
  };
}

async function automateEntity({
  actions,
  admin,
  deliverables,
  entity,
  entityType,
  payments,
  table,
  title
}: {
  actions: AutomationAction[];
  admin: AdminClient;
  deliverables: Row[];
  entity: Row;
  entityType: EntityType;
  payments: Row[];
  table: "deals" | "freelancer_projects";
  title: string;
}) {
  const id = String(entity.id ?? "");
  if (!id) return;

  const accepted = isAccepted(entity, entityType);
  const latestDeliverable = deliverables[0];
  const latestPayment = payments[0];
  const paymentStatus = String(entity.payment_status ?? "unpaid");
  const deliverableStatus = String(entity.deliverable_status ?? "not_started");
  const paymentRowStatus = latestPayment ? String(latestPayment.status ?? "") : "";

  if (accepted && (!entity.payment_status || paymentStatus === "not_started")) {
    await updateEntity(admin, table, id, { payment_status: "unpaid" });
    await ensurePaymentRecordForEntity(admin, entityType, { ...entity, id }, "unpaid");
    actions.push(action(entityType, id, title, paymentStatus, "unpaid", "Accepted work now waits for brand funding."));
  }

  if (accepted && !latestPayment) {
    await ensurePaymentRecordForEntity(admin, entityType, { ...entity, id }, paymentStatus || "unpaid");
    actions.push(action("payment", id, title, null, paymentStatus || "unpaid", "Created missing payment tracking row for accepted work."));
  }

  if (["funded", "release_ready", "released"].includes(paymentRowStatus) && paymentStatus !== paymentRowStatus) {
    await updateEntity(admin, table, id, { payment_status: paymentRowStatus });
    actions.push(action(entityType, id, title, paymentStatus, paymentRowStatus, "Synced work status from payment record."));
  }

  if (latestDeliverable?.status === "submitted" && deliverableStatus !== "submitted" && !["approved", "revision_requested"].includes(deliverableStatus)) {
    await updateEntity(admin, table, id, entityType === "deal" ? { deliverable_status: "submitted", stage: "delivered" } : { deliverable_status: "submitted" });
    actions.push(action("deliverable", String(latestDeliverable.id ?? id), title, deliverableStatus, "submitted", "Synced submitted deliverable to work item."));
  }

  if (latestDeliverable?.status === "revision_requested" && deliverableStatus !== "revision_requested") {
    await updateEntity(admin, table, id, entityType === "deal" ? { deliverable_status: "revision_requested", stage: "live" } : { deliverable_status: "revision_requested" });
    actions.push(action("deliverable", String(latestDeliverable.id ?? id), title, deliverableStatus, "revision_requested", "Synced requested revision to work item."));
  }

  const approvedDeliverable = deliverables.find((deliverable) => deliverable.status === "approved");
  const entityFunded = ["funded", "release_ready", "released"].includes(paymentStatus) || ["funded", "release_ready", "released"].includes(paymentRowStatus);
  const hasOpenDispute = String(entity.dispute_status ?? "") === "open";
  if (approvedDeliverable && entityFunded && !hasOpenDispute && paymentStatus === "funded") {
    await updateEntity(admin, table, id, entityType === "deal"
      ? { deliverable_status: "approved", payment_status: "release_ready", stage: "approved" }
      : { deliverable_status: "approved", payment_status: "release_ready" });
    await ensurePaymentRecordForEntity(admin, entityType, { ...entity, id }, "release_ready");
    actions.push(action(entityType, id, title, "funded", "release_ready", "Approved funded work is ready for payout release."));
  }
}

async function updateEntity(admin: AdminClient, table: "deals" | "freelancer_projects", id: string, update: Record<string, unknown>) {
  const { error } = await admin.from(table).update(update).eq("id", id);
  if (error) throw new Error(error.message);
  await trackEvent(admin, {
    eventName: "workflow_automation_applied",
    entityType: table === "deals" ? "deal" : "freelancer_project",
    entityId: id,
    metadata: update
  });
}

function action(entityType: AutomationAction["entityType"], entityId: string, title: string, from: string | null | undefined, to: string | null | undefined, reason: string): AutomationAction {
  return { entityId, entityType, from: from ?? null, reason, title, to: to ?? null };
}

function isAccepted(entity: Row, entityType: EntityType) {
  return entityType === "deal"
    ? String(entity.offer_status ?? "") === "accepted"
    : String(entity.status ?? "") === "accepted";
}

function rows(data: unknown): Row[] {
  return Array.isArray(data) ? data.filter((item): item is Row => Boolean(item) && typeof item === "object" && !Array.isArray(item)) : [];
}

function sameId(left: unknown, right: unknown) {
  return Boolean(left && right && String(left) === String(right));
}

function text(value: unknown, fallback: string) {
  return typeof value === "string" && value.trim() ? value : fallback;
}
