import { NextResponse } from "next/server";
import { trackEvent, userEventBase } from "@/lib/analytics/track";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const allowedStatuses = ["accepted", "changes_requested", "declined"] as const;

export async function POST(request: Request) {
  const body = await request.json();
  const projectId = String(body.project_id ?? "").trim();
  const status = String(body.status ?? "").trim() as typeof allowedStatuses[number];
  const response = String(body.response ?? "").trim();
  const counter = body.counter && typeof body.counter === "object" ? body.counter as Record<string, unknown> : {};
  const counterAmountCents = Number(counter.amount_cents ?? 0) || null;
  const counterScope = String(counter.scope ?? "").trim();
  const counterDueDate = String(counter.due_date ?? "").trim() || null;
  const counterUsageRights = String(counter.usage_rights ?? "").trim();
  const counterApprovalTerms = String(counter.approval_terms ?? "").trim();

  if (!projectId || !allowedStatuses.includes(status)) {
    return NextResponse.json({ error: "Project and valid response status are required." }, { status: 400 });
  }

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

  const { data, error } = await admin
    .from("freelancer_projects")
    .update({
      status,
      talent_response: response,
      responded_at: new Date().toISOString(),
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
