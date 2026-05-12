import { Resend } from "resend";

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

const FROM = process.env.RESEND_FROM_EMAIL || "Agently <notifications@agently.co.in>";
const APP_URL = process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

export async function sendEmail({ to, subject, html }: { to: string; subject: string; html: string }) {
  if (!resend) return { sent: false, error: "RESEND_API_KEY missing" };
  const { error } = await resend.emails.send({ from: FROM, to, subject, html });
  if (error) return { sent: false, error: error.message };
  return { sent: true };
}

export function signupConfirmationEmail({ fullName, confirmationUrl }: {
  fullName: string;
  confirmationUrl: string;
}) {
  return `<!DOCTYPE html><html lang="en"><body style="margin:0;padding:0;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;color:#0f172a;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;padding:32px 16px;">
  <tr>
    <td align="center">
      <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border:1px solid #e2e8f0;border-radius:14px;overflow:hidden;">
        <tr>
          <td style="padding:32px 32px 8px;">
            <div style="display:inline-block;background:#147b6d;color:#ffffff;border-radius:10px;width:44px;height:44px;text-align:center;line-height:44px;font-weight:800;font-size:20px;">A</div>
            <div style="display:inline-block;vertical-align:top;margin-left:12px;">
              <div style="font-size:18px;font-weight:700;">Agently</div>
              <div style="font-size:12px;color:#64748b;margin-top:2px;">Creator talent agency OS</div>
            </div>
          </td>
        </tr>
        <tr>
          <td style="padding:24px 32px 0;">
            <h1 style="margin:0;font-size:24px;line-height:1.3;">Verify your email to start using Agently</h1>
          </td>
        </tr>
        <tr>
          <td style="padding:16px 32px 0;">
            <p style="margin:0;font-size:15px;line-height:1.6;color:#334155;">Hi ${esc(fullName)}, confirm this email so we can save your profile and guide you through the Agently intake.</p>
          </td>
        </tr>
        <tr>
          <td style="padding:28px 32px 8px;">
            <a href="${esc(confirmationUrl)}" style="display:inline-block;padding:13px 28px;background:#147b6d;color:#ffffff;border-radius:8px;text-decoration:none;font-weight:700;">Confirm my email</a>
          </td>
        </tr>
        <tr>
          <td style="padding:16px 32px 0;">
            <p style="margin:0;font-size:13px;line-height:1.5;color:#64748b;">Or paste this link into your browser:</p>
            <p style="margin:4px 0 0;font-size:12px;line-height:1.5;word-break:break-all;"><a href="${esc(confirmationUrl)}" style="color:#147b6d;">${esc(confirmationUrl)}</a></p>
          </td>
        </tr>
        <tr>
          <td style="padding:24px 32px 32px;">
            <p style="margin:0;font-size:12px;line-height:1.5;color:#94a3b8;text-align:center;">Sent by Agently</p>
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>
</body></html>`;
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
<a href="${APP_URL}/offers" style="display:inline-block;padding:12px 24px;background:#111;color:#fff;border-radius:8px;text-decoration:none;font-weight:600;">View offer</a>
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
<a href="${APP_URL}/deals" style="display:inline-block;padding:12px 24px;background:#111;color:#fff;border-radius:8px;text-decoration:none;font-weight:600;">View in Agently</a>
<hr style="margin:32px 0;border:none;border-top:1px solid #eee;"/>
<p style="color:#999;font-size:12px;">Agently — creator talent agency OS</p>
</body></html>`;
}

function esc(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
