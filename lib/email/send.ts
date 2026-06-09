import { Resend } from "resend";
import { appUrl, renderAgentlyEmail, renderAgentlyEmailText } from "@/lib/email/layout";

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

const FROM = process.env.RESEND_FROM_EMAIL || "Agently <notifications@agently.co.in>";
const REPLY_TO = process.env.RESEND_REPLY_TO || "support@agently.co.in";

// Single send entry-point used by every email-producing surface.
//
// Always passes both HTML and plain-text so:
//   - Screen readers and minimal clients get a readable version
//   - Spam filters get a properly-formed multipart message (improves
//     inbox placement, especially on new domains)
//
// Also sets reply_to so when a user hits "Reply" on a transactional
// email they actually reach support instead of a dead notifications@
// inbox.
export async function sendEmail({ to, subject, html, text }: {
  to: string;
  subject: string;
  html: string;
  text?: string;
}) {
  if (!resend) return { sent: false, error: "RESEND_API_KEY missing" };
  const payload: Parameters<typeof resend.emails.send>[0] = {
    from: FROM,
    to,
    subject,
    html,
    replyTo: REPLY_TO
  };
  if (text) payload.text = text;
  const { error } = await resend.emails.send(payload);
  if (error) return { sent: false, error: error.message };
  return { sent: true };
}

// ============================================================================
// Email templates — all use the shared Agently layout in lib/email/layout
// ============================================================================

export function signupConfirmationEmail({ fullName, confirmationUrl }: {
  fullName: string;
  confirmationUrl: string;
}) {
  const input = {
    heading: "Verify your email to start using Agently",
    intro: `Hi ${fullName}, confirm this email so we can save your profile and walk you through the Agently intake. The link expires in 24 hours.`,
    primaryButton: { href: confirmationUrl, label: "Confirm my email" },
    footnote: "If you didn't sign up for Agently, ignore this email — no account will be created."
  };
  return { html: renderAgentlyEmail(input), text: renderAgentlyEmailText(input) };
}

export function waitlistConfirmationEmail({ fullName }: { fullName: string }) {
  const input = {
    heading: "You're on the Agently early-access list",
    intro: `Hi ${fullName}, thanks for requesting early access. Agently is onboarding founding creators in small batches so every profile gets proper attention. We'll email you from this address when your invite is ready — keep an eye on your inbox (and spam, just in case).`,
    footnote: "If you didn't request early access to Agently, you can ignore this email — we won't add you to anything else."
  };
  return { html: renderAgentlyEmail(input), text: renderAgentlyEmailText(input) };
}

export function passwordResetEmail({ fullName, resetUrl }: { fullName: string | null; resetUrl: string; }) {
  const greeting = fullName ? `Hi ${fullName}` : "Hi";
  const input = {
    heading: "Reset your Agently password",
    intro: `${greeting}, we got a request to reset the password on your Agently account. Click below to set a new one. The link expires in 1 hour.`,
    primaryButton: { href: resetUrl, label: "Reset password" },
    footnote: "If you didn't request this reset, ignore this email — your password won't change."
  };
  return { html: renderAgentlyEmail(input), text: renderAgentlyEmailText(input) };
}

export function offerSentEmail({ creatorName, brandName, dealTitle, amountFormatted, dueDate, deliverables }: {
  creatorName: string;
  brandName: string;
  dealTitle: string;
  amountFormatted: string;
  dueDate?: string;
  deliverables: string;
}) {
  const input = {
    heading: `New offer from ${brandName}`,
    intro: `Hi ${creatorName}, you have a new creator offer waiting in your Agently inbox. Review the terms, negotiate if needed, and accept only once you're clear on scope and timing.`,
    rows: [
      ["Deal", dealTitle],
      ["Amount", amountFormatted],
      ["Due date", dueDate || "Not specified"],
      ["Deliverables", deliverables]
    ] as Array<[string, string]>,
    primaryButton: { href: appUrl("/offers"), label: "Review offer" },
    footnote: "Funded payment lands in protected escrow before you start work. Read every contract clause carefully — Agently scans for risky terms but you should verify."
  };
  return { html: renderAgentlyEmail(input), text: renderAgentlyEmailText(input) };
}

export function offerRespondedEmail({ dealTitle, status, creatorName, responseNote }: {
  brandEmail: string;
  brandName: string;
  dealTitle: string;
  status: "accepted" | "declined" | "changes_requested";
  creatorName: string;
  responseNote?: string;
}) {
  const action = status === "accepted" ? "accepted" : status === "declined" ? "declined" : "requested changes on";
  const rows: Array<[string, string]> = [
    ["Deal", dealTitle],
    ["Status", status.replace(/_/g, " ")]
  ];
  if (responseNote) rows.push(["Note from creator", responseNote]);

  const input = {
    heading: `${creatorName} ${action} your offer`,
    intro: status === "accepted"
      ? `${creatorName} accepted your offer for ${dealTitle}. The next step is funding the contract — once payment lands in protected escrow, the creator can start work.`
      : status === "declined"
        ? `${creatorName} declined the offer for ${dealTitle}. You can revise the brief or send a new offer to a different creator.`
        : `${creatorName} requested changes on your offer for ${dealTitle}. Review their counter and either accept, push back, or decline.`,
    rows,
    primaryButton: { href: appUrl("/deals"), label: "Open Agently" }
  };
  return { html: renderAgentlyEmail(input), text: renderAgentlyEmailText(input) };
}
