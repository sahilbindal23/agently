import { Resend } from "resend";

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

const FROM = "Agently <notifications@agently.in>";

export async function sendEmail({ to, subject, html }: { to: string; subject: string; html: string }) {
  if (!resend) return;
  await resend.emails.send({ from: FROM, to, subject, html }).catch(() => {});
}

export function offerSentEmail({ creatorName, brandName, dealTitle, amountFormatted, dueDate, deliverables }: {
  creatorName: string;
  brandName: string;
  dealTitle: string;
  amountFormatted: string;
  dueDate?: string;
  deliverables: string;
}) {
  return `<!DOCTYPE html><html><body style="font-family:system-ui,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#111;">
<h2 style="margin-bottom:4px;">New offer from ${esc(brandName)}</h2>
<p style="margin-top:0;color:#555;">You have received a creator offer on Agently.</p>
<table style="width:100%;border-collapse:collapse;margin:20px 0;">
  <tr><td style="padding:10px;background:#f5f5f5;font-weight:600;border-radius:6px 0 0 0;">Deal</td><td style="padding:10px;background:#f5f5f5;border-radius:0 6px 0 0;">${esc(dealTitle)}</td></tr>
  <tr><td style="padding:10px;border-bottom:1px solid #eee;font-weight:600;">Amount</td><td style="padding:10px;border-bottom:1px solid #eee;">${esc(amountFormatted)}</td></tr>
  <tr><td style="padding:10px;border-bottom:1px solid #eee;font-weight:600;">Due date</td><td style="padding:10px;border-bottom:1px solid #eee;">${esc(dueDate ?? "Not specified")}</td></tr>
  <tr><td style="padding:10px;font-weight:600;vertical-align:top;">Deliverables</td><td style="padding:10px;">${esc(deliverables)}</td></tr>
</table>
<p>Hi ${esc(creatorName)}, log into Agently to review and respond to this offer.</p>
<a href="https://agently.in/offers" style="display:inline-block;padding:12px 24px;background:#111;color:#fff;border-radius:8px;text-decoration:none;font-weight:600;">View offer</a>
<hr style="margin:32px 0;border:none;border-top:1px solid #eee;"/>
<p style="color:#999;font-size:12px;">Agently — creator talent agency OS</p>
</body></html>`;
}

export function offerRespondedEmail({ dealTitle, status, creatorName, responseNote }: {
  brandEmail: string;
  brandName: string;
  dealTitle: string;
  status: "accepted" | "declined" | "changes_requested";
  creatorName: string;
  responseNote?: string;
}) {
  const statusLabel = status === "accepted" ? "accepted" : status === "declined" ? "declined" : "sent a counter-proposal for";
  const statusColor = status === "accepted" ? "#166534" : status === "declined" ? "#991b1b" : "#92400e";
  return `<!DOCTYPE html><html><body style="font-family:system-ui,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#111;">
<h2 style="margin-bottom:4px;">${esc(creatorName)} ${statusLabel} your offer</h2>
<p style="margin-top:0;color:#555;">Deal: <strong>${esc(dealTitle)}</strong></p>
<p><span style="display:inline-block;padding:4px 12px;border-radius:999px;background:${statusColor}20;color:${statusColor};font-weight:600;font-size:14px;">${esc(status.replace("_", " "))}</span></p>
${responseNote ? `<p style="margin:16px 0;padding:12px;background:#f5f5f5;border-radius:8px;">${esc(responseNote)}</p>` : ""}
<a href="https://agently.in/deals" style="display:inline-block;padding:12px 24px;background:#111;color:#fff;border-radius:8px;text-decoration:none;font-weight:600;">View in Agently</a>
<hr style="margin:32px 0;border:none;border-top:1px solid #eee;"/>
<p style="color:#999;font-size:12px;">Agently — creator talent agency OS</p>
</body></html>`;
}

function esc(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
