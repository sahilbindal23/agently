import type { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail } from "@/lib/email/send";
import { formatCurrency } from "@/lib/utils/format";

type AdminClient = NonNullable<ReturnType<typeof createAdminClient>>;
type EntityType = "deal" | "freelancer_project";

const APP_URL = process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

export async function notifyFreelancerProjectSent(admin: AdminClient, projectId: string) {
  const context = await getProjectContext(admin, projectId);
  if (!context?.talentEmail) return;

  await sendEmail({
    to: context.talentEmail,
    subject: `New project request from ${context.brandName}: ${context.title}`,
    html: renderWorkflowEmail({
      heading: `New project request from ${context.brandName}`,
      intro: `Hi ${context.talentName}, you have received a freelancer project request on Agently.`,
      rows: [
        ["Project", context.title],
        ["Amount", context.amount],
        ["Due date", context.dueDate],
        ["Scope", context.scope]
      ],
      buttonHref: `${APP_URL}/offers`,
      buttonLabel: "Review project"
    })
  });
}

export async function notifyFreelancerProjectResponded(admin: AdminClient, projectId: string, status: string, response?: string) {
  const context = await getProjectContext(admin, projectId);
  if (!context?.brandEmail) return;

  await sendEmail({
    to: context.brandEmail,
    subject: `${context.talentName} ${responseVerb(status)} your project - ${context.title}`,
    html: renderWorkflowEmail({
      heading: `${context.talentName} ${responseVerb(status)} your project`,
      intro: `Project: ${context.title}`,
      rows: [
        ["Status", status.replace("_", " ")],
        ["Amount", context.amount],
        ["Response", response || "No response note added."]
      ],
      buttonHref: `${APP_URL}/deals`,
      buttonLabel: "Open Agently"
    })
  });
}

export async function notifyDeliverableSubmitted(admin: AdminClient, deliverableId: string) {
  const context = await getDeliverableContext(admin, deliverableId);
  if (!context?.brandEmail) return;

  await sendEmail({
    to: context.brandEmail,
    subject: `${context.talentName} submitted a deliverable - ${context.title}`,
    html: renderWorkflowEmail({
      heading: `${context.talentName} submitted a deliverable`,
      intro: "A deliverable is ready for review inside Agently.",
      rows: [
        ["Work item", context.title],
        ["Content URL", context.contentUrl],
        ["Notes", context.notes || "No notes added."]
      ],
      buttonHref: `${APP_URL}/payments`,
      buttonLabel: "Review deliverable"
    })
  });
}

export async function notifyDeliverableReviewed(admin: AdminClient, deliverableId: string, status: "approved" | "revision_requested", reviewNotes?: string) {
  const context = await getDeliverableContext(admin, deliverableId);
  if (!context?.talentEmail) return;

  await sendEmail({
    to: context.talentEmail,
    subject: status === "approved" ? `Deliverable approved - ${context.title}` : `Revision requested - ${context.title}`,
    html: renderWorkflowEmail({
      heading: status === "approved" ? "Your deliverable was approved" : "Revision requested",
      intro: status === "approved"
        ? "Your submitted work has been approved. If the payment is funded, the workflow can move toward payout release."
        : "The brand or admin requested changes before approval.",
      rows: [
        ["Work item", context.title],
        ["Status", status.replace("_", " ")],
        ["Review notes", reviewNotes || "No review notes added."]
      ],
      buttonHref: `${APP_URL}/payments`,
      buttonLabel: "Open payment workflow"
    })
  });
}

export async function notifyPaymentStatusChanged(admin: AdminClient, entityType: EntityType, entityId: string, status: string) {
  if (!["funded", "release_ready", "released", "refunded", "disputed"].includes(status)) return;
  const context = entityType === "deal" ? await getDealContext(admin, entityId) : await getProjectContext(admin, entityId);
  if (!context?.talentEmail) return;

  await sendEmail({
    to: context.talentEmail,
    subject: `${paymentStatusLabel(status)} - ${context.title}`,
    html: renderWorkflowEmail({
      heading: paymentStatusLabel(status),
      intro: paymentIntro(status),
      rows: [
        ["Work item", context.title],
        ["Amount", context.amount],
        ["Status", status.replace("_", " ")]
      ],
      buttonHref: `${APP_URL}/payments`,
      buttonLabel: "Open payments"
    })
  });
}

async function getDealContext(admin: AdminClient, dealId: string) {
  const { data: deal } = await admin.from("deals").select("*").eq("id", dealId).maybeSingle();
  if (!deal) return null;
  const [{ data: brand }, { data: creator }] = await Promise.all([
    admin.from("brands").select("name, contact_email").eq("id", deal.brand_id).maybeSingle(),
    admin.from("creators").select("display_name, profile_id").eq("id", deal.creator_id).maybeSingle()
  ]);
  const { data: profile } = creator?.profile_id
    ? await admin.from("profiles").select("email, full_name").eq("id", creator.profile_id).maybeSingle()
    : { data: null };

  return {
    title: text(deal.title, "Creator offer"),
    amount: formatCurrency(Number(deal.amount_cents ?? 0), String(deal.currency ?? "inr")),
    dueDate: text(deal.due_date, "Not set"),
    scope: text(deal.deliverables, "No deliverables added."),
    brandName: text(brand?.name, "Brand"),
    brandEmail: text(brand?.contact_email, ""),
    talentName: text(creator?.display_name || profile?.full_name, "Creator"),
    talentEmail: text(profile?.email, "")
  };
}

async function getProjectContext(admin: AdminClient, projectId: string) {
  const { data: project } = await admin.from("freelancer_projects").select("*").eq("id", projectId).maybeSingle();
  if (!project) return null;
  const [{ data: brand }, { data: freelancer }] = await Promise.all([
    admin.from("brands").select("name, contact_email").eq("id", project.brand_id).maybeSingle(),
    admin.from("freelancers").select("display_name, profile_id").eq("id", project.freelancer_id).maybeSingle()
  ]);
  const { data: profile } = freelancer?.profile_id
    ? await admin.from("profiles").select("email, full_name").eq("id", freelancer.profile_id).maybeSingle()
    : { data: null };

  return {
    title: text(project.title, "Freelancer project"),
    amount: formatCurrency(Number(project.amount_cents ?? 0), String(project.currency ?? "inr")),
    dueDate: text(project.due_date, "Not set"),
    scope: text(project.scope, "No scope added."),
    brandName: text(brand?.name, "Brand"),
    brandEmail: text(brand?.contact_email, ""),
    talentName: text(freelancer?.display_name || profile?.full_name, "Freelancer"),
    talentEmail: text(profile?.email, "")
  };
}

async function getDeliverableContext(admin: AdminClient, deliverableId: string) {
  const { data: deliverable } = await admin.from("deliverables").select("*").eq("id", deliverableId).maybeSingle();
  if (!deliverable) return null;
  const base = deliverable.deal_id
    ? await getDealContext(admin, String(deliverable.deal_id))
    : await getProjectContext(admin, String(deliverable.freelancer_project_id));
  if (!base) return null;
  return {
    ...base,
    contentUrl: text(deliverable.content_url, ""),
    notes: text(deliverable.notes, "")
  };
}

function renderWorkflowEmail({ heading, intro, rows, buttonHref, buttonLabel }: {
  heading: string;
  intro: string;
  rows: Array<[string, string]>;
  buttonHref: string;
  buttonLabel: string;
}) {
  const rowHtml = rows.map(([label, value]) => `
  <tr>
    <td style="padding:10px;border-bottom:1px solid #e2e8f0;font-weight:700;color:#0f172a;vertical-align:top;">${esc(label)}</td>
    <td style="padding:10px;border-bottom:1px solid #e2e8f0;color:#334155;vertical-align:top;">${esc(value)}</td>
  </tr>`).join("");

  return `<!DOCTYPE html><html><body style="margin:0;padding:0;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;color:#0f172a;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;padding:32px 16px;">
  <tr><td align="center">
    <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border:1px solid #e2e8f0;border-radius:14px;overflow:hidden;">
      <tr><td style="padding:28px 32px 8px;">
        <div style="font-size:18px;font-weight:800;">Agently</div>
        <div style="font-size:12px;color:#64748b;margin-top:2px;">Creator talent agency OS</div>
      </td></tr>
      <tr><td style="padding:20px 32px 0;"><h1 style="margin:0;font-size:22px;line-height:1.3;">${esc(heading)}</h1></td></tr>
      <tr><td style="padding:14px 32px 0;"><p style="margin:0;font-size:15px;line-height:1.6;color:#334155;">${esc(intro)}</p></td></tr>
      <tr><td style="padding:22px 32px 0;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;border:1px solid #e2e8f0;border-radius:8px;overflow:hidden;">${rowHtml}</table></td></tr>
      <tr><td style="padding:24px 32px 8px;"><a href="${esc(buttonHref)}" style="display:inline-block;padding:12px 22px;background:#147b6d;color:#ffffff;border-radius:8px;text-decoration:none;font-weight:700;">${esc(buttonLabel)}</a></td></tr>
      <tr><td style="padding:20px 32px 28px;"><p style="margin:0;font-size:12px;line-height:1.5;color:#94a3b8;text-align:center;">Sent by Agently</p></td></tr>
    </table>
  </td></tr>
</table>
</body></html>`;
}

function responseVerb(status: string) {
  if (status === "accepted") return "accepted";
  if (status === "declined") return "declined";
  return "countered";
}

function paymentStatusLabel(status: string) {
  if (status === "funded") return "Payment received";
  if (status === "release_ready") return "Payout ready for release";
  if (status === "released") return "Payout released";
  if (status === "refunded") return "Payment refunded";
  if (status === "disputed") return "Payment disputed";
  return "Payment status updated";
}

function paymentIntro(status: string) {
  if (status === "funded") return "The brand payment has been marked funded. You can continue the workflow and submit deliverables when ready.";
  if (status === "release_ready") return "The work is approved and the payout is ready for release.";
  if (status === "released") return "The payout has been marked released in Agently.";
  if (status === "refunded") return "The payment has been marked refunded.";
  if (status === "disputed") return "The payment has been marked disputed. Keep all communication and evidence inside Agently.";
  return "The payment workflow status changed.";
}

function text(value: unknown, fallback: string) {
  const textValue = String(value ?? "").trim();
  return textValue || fallback;
}

function esc(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
