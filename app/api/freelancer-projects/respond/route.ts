import { NextResponse } from "next/server";
import { z } from "zod";
import { trackEvent, userEventBase } from "@/lib/analytics/track";
import { ensureAgreementForFreelancerProject } from "@/lib/contracts/agreements";
import { notifyFreelancerProjectResponded } from "@/lib/email/workflow";
import { applyLedgerEvent } from "@/lib/engines/outcome-ledger";
import { ensurePaymentRecordForEntity } from "@/lib/payments/workflow";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const counterSchema = z.object({
  amount_cents: z.coerce.number().int().min(0).optional(),
  scope: z.string().trim().max(2000).optional(),
  due_date: z.string().trim().max(50).optional(),
  usage_rights: z.string().trim().max(500).optional(),
  approval_terms: z.string().trim().max(500).optional()
}).nullish();

const schema = z.object({
  project_id: z.string().trim().min(1, "Project ID is required."),
  status: z.enum(["accepted", "changes_requested", "declined"]),
  response: z.string().trim().max(2000).optional().default(""),
  counter: counterSchema
});

export async function POST(request: Request) {
  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid request." }, { status: 400 });
  }
  const { project_id: projectId, status, response, counter } = parsed.data;
  const counterAmountCents = Number(counter?.amount_cents ?? 0) || null;
  const counterScope = counter?.scope ?? "";
  const counterDueDate = counter?.due_date || null;
  const counterUsageRights = counter?.usage_rights ?? "";
  const counterApprovalTerms = counter?.approval_terms ?? "";

  const auth = await createClient();
  const { data: authData } = await auth.auth.getUser();
  if (!authData.user) return NextResponse.json({ error: "Login required." }, { status: 401 });

  const admin = createAdminClient();
  if (!admin) return NextResponse.json({ error: "Supabase service role key is not configured." }, { status: 500 });

  const { data: project } = await admin.from("freelancer_projects").select("*").eq("id", projectId).single();
  if (!project) return NextResponse.json({ error: "Project not found." }, { status: 404 });

  const { data: freelancer } = await admin.from("freelancers").select("profile_id").eq("id", project.freelancer_id).single();
  const { data: profile } = await admin.from("profiles").select("role").eq("id", authData.user.id).single();
  if (freelancer?.profile_id !== authData.user.id && profile?.role !== "admin") {
    return NextResponse.json({ error: "Not allowed to respond to this project." }, { status: 403 });
  }

  const counterSummary = status === "changes_requested" ? formatCounterSummary({
    amountCents: counterAmountCents,
    scope: counterScope,
    dueDate: counterDueDate,
    usageRights: counterUsageRights,
    approvalTerms: counterApprovalTerms,
    reason: response
  }) : "";
  const nextPaymentStatus = status === "accepted" && !["funded", "release_ready", "released"].includes(String(project.payment_status ?? ""))
    ? "unpaid"
    : project.payment_status;

  const { data, error } = await admin
    .from("freelancer_projects")
    .update({
      status,
      talent_response: response,
      responded_at: new Date().toISOString(),
      payment_status: nextPaymentStatus,
      counter_status: status === "changes_requested" ? "pending_brand_review" : project.counter_status ?? "none",
      counter_amount_cents: status === "changes_requested" ? counterAmountCents : project.counter_amount_cents,
      counter_scope: status === "changes_requested" ? counterScope : project.counter_scope,
      counter_due_date: status === "changes_requested" ? counterDueDate : project.counter_due_date,
      counter_usage_rights: status === "changes_requested" ? counterUsageRights : project.counter_usage_rights,
      counter_approval_terms: status === "changes_requested" ? counterApprovalTerms : project.counter_approval_terms,
      counter_reason: status === "changes_requested" ? response : project.counter_reason,
      counter_created_at: status === "changes_requested" ? new Date().toISOString() : project.counter_created_at,
      notes: [project.notes, response ? `Talent response: ${response}` : "", counterSummary].filter(Boolean).join("\n")
    })
    .eq("id", projectId)
    .select("*")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (status === "accepted") {
    await ensurePaymentRecordForEntity(admin, "freelancer_project", data, nextPaymentStatus);
    try { await ensureAgreementForFreelancerProject(admin, projectId); } catch (err) { console.error("[contracts] generate failed", err); }
  }
  await trackEvent(admin, {
    ...userEventBase(authData.user, profile?.role),
    eventName: status === "accepted" ? "freelancer_project_accepted" : status === "changes_requested" ? "freelancer_project_countered" : "freelancer_project_declined",
    entityType: "freelancer_project",
    entityId: projectId,
    metadata: {
      freelancer_id: project.freelancer_id,
      brand_id: project.brand_id,
      original_amount_cents: project.amount_cents,
      counter_amount_cents: status === "changes_requested" ? counterAmountCents : null,
      has_response: Boolean(response)
    }
  });
  await applyLedgerEvent(admin, {
    amountCents: Number(project.amount_cents ?? 0),
    campaignId: project.campaign_id ? String(project.campaign_id) : null,
    counterAmountCents,
    entityId: String(project.freelancer_id),
    entityType: "freelancer",
    eventName: status === "accepted" ? "freelancer_project_accepted" : status === "changes_requested" ? "freelancer_project_countered" : "freelancer_project_declined",
    freelancerProjectId: projectId,
    outcomeLabel: status === "accepted" ? "accepted" : status === "changes_requested" ? "countered" : "declined",
    responseStatus: status
  });
  await notifyFreelancerProjectResponded(admin, projectId, status, response);
  return NextResponse.json({ data });
}

function formatCounterSummary({
  amountCents,
  scope,
  dueDate,
  usageRights,
  approvalTerms,
  reason
}: {
  amountCents: number | null;
  scope: string;
  dueDate: string | null;
  usageRights: string;
  approvalTerms: string;
  reason: string;
}) {
  return [
    "Structured counter submitted:",
    amountCents ? `Counter amount: INR ${Math.round(amountCents / 100)}` : "",
    scope ? `Revised scope: ${scope}` : "",
    dueDate ? `Requested due date: ${dueDate}` : "",
    usageRights ? `Usage rights: ${usageRights}` : "",
    approvalTerms ? `Approval terms: ${approvalTerms}` : "",
    reason ? `Reason: ${reason}` : ""
  ].filter(Boolean).join("\n");
}
