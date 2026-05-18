import type { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail } from "@/lib/email/send";
import { appUrl, renderAgentlyEmail, renderAgentlyEmailText, type EmailRow } from "@/lib/email/layout";
import { formatCurrency } from "@/lib/utils/format";

type AdminClient = NonNullable<ReturnType<typeof createAdminClient>>;
type EntityType = "deal" | "freelancer_project";

// Workflow notification emails — sent by various API routes when an
// offer state machine advances (project sent, project responded,
// deliverable submitted, deliverable reviewed, payment status changed).
//
// All emails use the shared Agently layout in lib/email/layout so the
// brand presentation matches signup-verify, password-reset, and the
// offer notifications.

export async function notifyFreelancerProjectSent(admin: AdminClient, projectId: string) {
  const context = await getProjectContext(admin, projectId);
  if (!context?.talentEmail) return;

  await sendWorkflowEmail({
    to: context.talentEmail,
    subject: `New project request from ${context.brandName}: ${context.title}`,
    heading: `New project request from ${context.brandName}`,
    intro: `Hi ${context.talentName}, you have a freelancer project request waiting in your Agently inbox. Review the scope and respond when you're ready.`,
    rows: [
      ["Project", context.title],
      ["Amount", context.amount],
      ["Due date", context.dueDate],
      ["Scope", context.scope]
    ],
    buttonLabel: "Review project",
    buttonPath: "/offers"
  });
}

export async function notifyFreelancerProjectResponded(admin: AdminClient, projectId: string, status: string, response?: string) {
  const context = await getProjectContext(admin, projectId);
  if (!context?.brandEmail) return;

  await sendWorkflowEmail({
    to: context.brandEmail,
    subject: `${context.talentName} ${responseVerb(status)} your project — ${context.title}`,
    heading: `${context.talentName} ${responseVerb(status)} your project`,
    intro: `The freelancer has responded to your project request. Open Agently to see their full response and decide on next steps.`,
    rows: [
      ["Project", context.title],
      ["Status", status.replace(/_/g, " ")],
      ["Amount", context.amount],
      ["Response", response || "No response note added."]
    ],
    buttonLabel: "Open Agently",
    buttonPath: "/deals"
  });
}

export async function notifyDeliverableSubmitted(admin: AdminClient, deliverableId: string) {
  const context = await getDeliverableContext(admin, deliverableId);
  if (!context?.brandEmail) return;

  await sendWorkflowEmail({
    to: context.brandEmail,
    subject: `${context.talentName} submitted a deliverable — ${context.title}`,
    heading: `${context.talentName} submitted a deliverable`,
    intro: `A deliverable is ready for your review inside Agently. Approve to move the payout toward release, or request revisions if anything needs to change.`,
    rows: [
      ["Work item", context.title],
      ["Content URL", context.contentUrl],
      ["Notes", context.notes || "No notes added."]
    ],
    buttonLabel: "Review deliverable",
    buttonPath: "/payments"
  });
}

export async function notifyDeliverableReviewed(admin: AdminClient, deliverableId: string, status: "approved" | "revision_requested", reviewNotes?: string) {
  const context = await getDeliverableContext(admin, deliverableId);
  if (!context?.talentEmail) return;

  await sendWorkflowEmail({
    to: context.talentEmail,
    subject: status === "approved" ? `Deliverable approved — ${context.title}` : `Revision requested — ${context.title}`,
    heading: status === "approved" ? "Your deliverable was approved" : "Revision requested",
    intro: status === "approved"
      ? "Your submitted work was approved. If the payment is funded, the workflow can now move toward payout release."
      : "The brand or admin asked for changes before approval. See the review notes below and re-submit when ready.",
    rows: [
      ["Work item", context.title],
      ["Status", status.replace(/_/g, " ")],
      ["Review notes", reviewNotes || "No review notes added."]
    ],
    buttonLabel: "Open payment workflow",
    buttonPath: "/payments"
  });
}

// Notify the counter-party when one side signs a deal_agreement. The brand
// learned about this the hard way: a creator signed an agreement, the
// brand had no idea, and the brand had to dig through /offers → /deals to
// notice. This email closes that gap so the brand can fund as soon as
// the talent signs.
export async function notifyContractSigned(admin: AdminClient, options: {
  entityType: EntityType;
  entityId: string;
  side: "brand" | "talent";
  fullySigned: boolean;
}) {
  const context = options.entityType === "deal"
    ? await getDealContext(admin, options.entityId)
    : await getProjectContext(admin, options.entityId);
  if (!context) return;

  // Send the "they signed, your turn" email to whoever still needs to sign.
  // When fully signed, both parties get a short confirmation.
  if (options.fullySigned) {
    const subject = `Agreement fully signed — ${context.title}`;
    const heading = "Agreement fully signed";
    const intro = "Both parties have signed the Agently agreement. The deal is ready to fund — protected payout will hold the amount until deliverables are approved.";
    const rows: EmailRow[] = [
      ["Work item", context.title],
      ["Amount", context.amount],
      ["Status", "Fully signed"]
    ];
    if (context.brandEmail) {
      await sendWorkflowEmail({
        to: context.brandEmail,
        subject,
        heading,
        intro: `${intro} Open Agently to fund the deal.`,
        rows,
        buttonLabel: "Fund the deal",
        buttonPath: "/payments"
      });
    }
    if (context.talentEmail) {
      await sendWorkflowEmail({
        to: context.talentEmail,
        subject,
        heading,
        intro: `${intro} You will receive another notification when the brand funds the deal.`,
        rows,
        buttonLabel: "Open Agently",
        buttonPath: "/offers"
      });
    }
    return;
  }

  // Single-side signature — notify the other side so they know it's their turn.
  const signerLabel = options.side === "brand" ? context.brandName : context.talentName;
  const recipientEmail = options.side === "brand" ? context.talentEmail : context.brandEmail;
  if (!recipientEmail) return;

  await sendWorkflowEmail({
    to: recipientEmail,
    subject: `${signerLabel} signed the agreement — ${context.title}`,
    heading: `${signerLabel} signed the agreement`,
    intro: options.side === "brand"
      ? "The brand has signed the Agently agreement. Open Agently to add your signature and unlock the funded workflow."
      : "The talent has signed the Agently agreement. Open Agently to add your signature so the deal can move to funding.",
    rows: [
      ["Work item", context.title],
      ["Amount", context.amount],
      ["Status", "Awaiting your signature"]
    ],
    buttonLabel: options.side === "brand" ? "Sign the agreement" : "Sign and fund",
    buttonPath: options.entityType === "deal" ? "/deals" : "/offers"
  });
}

export async function notifyPaymentStatusChanged(admin: AdminClient, entityType: EntityType, entityId: string, status: string) {
  if (!["funded", "release_ready", "released", "refunded", "disputed"].includes(status)) return;
  const context = entityType === "deal" ? await getDealContext(admin, entityId) : await getProjectContext(admin, entityId);
  if (!context?.talentEmail) return;

  await sendWorkflowEmail({
    to: context.talentEmail,
    subject: `${paymentStatusLabel(status)} — ${context.title}`,
    heading: paymentStatusLabel(status),
    intro: paymentIntro(status),
    rows: [
      ["Work item", context.title],
      ["Amount", context.amount],
      ["Status", status.replace(/_/g, " ")]
    ],
    buttonLabel: "Open payments",
    buttonPath: "/payments"
  });
}

// ============================================================================
// shared workflow-email helper — uses the Agently layout
// ============================================================================

async function sendWorkflowEmail(input: {
  to: string;
  subject: string;
  heading: string;
  intro: string;
  rows: EmailRow[];
  buttonLabel: string;
  buttonPath: string;
}) {
  const templateInput = {
    heading: input.heading,
    intro: input.intro,
    rows: input.rows,
    primaryButton: { href: appUrl(input.buttonPath), label: input.buttonLabel }
  };
  await sendEmail({
    to: input.to,
    subject: input.subject,
    html: renderAgentlyEmail(templateInput),
    text: renderAgentlyEmailText(templateInput)
  });
}

// ============================================================================
// data fetchers
// ============================================================================

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

// ============================================================================
// status label helpers
// ============================================================================

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
  if (status === "funded") return "The brand payment has been marked funded and is held in protected escrow. You can start work and submit deliverables when ready.";
  if (status === "release_ready") return "The work has been approved and the payout is queued for release. Funds will land in your account once the release completes.";
  if (status === "released") return "The payout has been released. Funds should arrive within your provider's standard settlement window.";
  if (status === "refunded") return "The payment has been refunded to the brand. If this looks wrong, contact support.";
  if (status === "disputed") return "The payment has been marked disputed. Keep all communication and evidence inside Agently — the admin team is the source of truth on resolution.";
  return "The payment workflow status changed.";
}

function text(value: unknown, fallback: string) {
  const textValue = String(value ?? "").trim();
  return textValue || fallback;
}
