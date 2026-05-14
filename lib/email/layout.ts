// Shared email layout for every transactional email Agently sends.
//
// Why this exists: before this file, the codebase had three different
// visual templates (one polished, one bare, one workflow-style). Some
// emails had a logo mark, others didn't. Footers were inconsistent.
// One template per surface meant every brand tweak needed N edits.
//
// One layout, one set of footer links, one place to update copy when
// the brand evolves.

const APP_URL = (process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || "https://agently.co.in").replace(/\/$/, "");
const SUPPORT_EMAIL = "support@agently.co.in";
const COMPANY_NAME = "Agently";
const COMPANY_TAGLINE = "India-first creator talent agency OS";

export type EmailRow = [label: string, value: string];

export type AgentlyEmailInput = {
  /** Big bold heading at the top of the email body. */
  heading: string;
  /** First paragraph under the heading. Plain text only — no HTML. */
  intro: string;
  /** Optional structured row table — e.g. Deal / Amount / Due date. */
  rows?: EmailRow[];
  /** Primary CTA button: where the user goes after reading the email. */
  primaryButton?: { href: string; label: string };
  /** Optional small print under the button (e.g. "Link expires in 1h"). */
  footnote?: string;
  /** Override the manage-preferences link target. Defaults to /notifications. */
  preferencesPath?: string;
};

// ============================================================================
// HTML render
// ============================================================================

export function renderAgentlyEmail(input: AgentlyEmailInput): string {
  const { heading, intro, rows, primaryButton, footnote, preferencesPath = "/notifications" } = input;

  const rowsHtml = rows && rows.length
    ? `
      <tr><td style="padding:20px 32px 0;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;border:1px solid #e2e8f0;border-radius:8px;overflow:hidden;">
          ${rows.map(([label, value]) => `
            <tr>
              <td style="padding:12px 16px;border-bottom:1px solid #e2e8f0;font-weight:700;color:#0f172a;vertical-align:top;width:35%;background:#f8fafc;">${esc(label)}</td>
              <td style="padding:12px 16px;border-bottom:1px solid #e2e8f0;color:#334155;vertical-align:top;">${esc(value)}</td>
            </tr>`).join("")}
        </table>
      </td></tr>`
    : "";

  const buttonHtml = primaryButton
    ? `
      <tr><td style="padding:28px 32px 0;">
        <a href="${esc(primaryButton.href)}" style="display:inline-block;padding:13px 28px;background:#147b6d;color:#ffffff;border-radius:8px;text-decoration:none;font-weight:700;font-size:15px;">${esc(primaryButton.label)}</a>
      </td></tr>
      <tr><td style="padding:12px 32px 0;">
        <p style="margin:0;font-size:12px;line-height:1.5;color:#64748b;">Or paste this link: <a href="${esc(primaryButton.href)}" style="color:#147b6d;word-break:break-all;">${esc(primaryButton.href)}</a></p>
      </td></tr>`
    : "";

  const footnoteHtml = footnote
    ? `<tr><td style="padding:20px 32px 0;"><p style="margin:0;font-size:13px;line-height:1.6;color:#64748b;">${esc(footnote)}</p></td></tr>`
    : "";

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <meta name="color-scheme" content="light" />
  <meta name="supported-color-schemes" content="light" />
  <title>${esc(heading)}</title>
</head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;color:#0f172a;">
  <!-- Preheader (hidden from view, shows in inbox preview) -->
  <div style="display:none;max-height:0;overflow:hidden;font-size:1px;line-height:1px;color:transparent;">
    ${esc(intro.slice(0, 110))}
  </div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border:1px solid #e2e8f0;border-radius:14px;overflow:hidden;box-shadow:0 1px 2px rgba(15,23,42,.04);">
          <!-- Header: logo mark + wordmark + tagline -->
          <tr>
            <td style="padding:28px 32px 4px;">
              <table role="presentation" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="vertical-align:middle;">
                    <div style="background:#147b6d;color:#ffffff;border-radius:10px;width:40px;height:40px;text-align:center;line-height:40px;font-weight:800;font-size:18px;font-family:Arial,sans-serif;">A</div>
                  </td>
                  <td style="vertical-align:middle;padding-left:12px;">
                    <div style="font-size:18px;font-weight:800;letter-spacing:-0.01em;color:#0f172a;">${esc(COMPANY_NAME)}</div>
                    <div style="font-size:12px;color:#64748b;margin-top:2px;">${esc(COMPANY_TAGLINE)}</div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Heading -->
          <tr><td style="padding:24px 32px 0;">
            <h1 style="margin:0;font-size:24px;line-height:1.3;color:#0f172a;font-weight:800;letter-spacing:-0.01em;">${esc(heading)}</h1>
          </td></tr>

          <!-- Intro paragraph -->
          <tr><td style="padding:14px 32px 0;">
            <p style="margin:0;font-size:15px;line-height:1.6;color:#334155;">${esc(intro)}</p>
          </td></tr>

          ${rowsHtml}
          ${buttonHtml}
          ${footnoteHtml}

          <!-- Divider before footer -->
          <tr><td style="padding:28px 32px 0;">
            <div style="height:1px;background:#e2e8f0;"></div>
          </td></tr>

          <!-- Footer -->
          <tr><td style="padding:20px 32px 28px;">
            <p style="margin:0 0 6px;font-size:12px;line-height:1.5;color:#64748b;">
              Sent by <a href="${APP_URL}" style="color:#147b6d;text-decoration:none;font-weight:600;">agently.co.in</a> — ${esc(COMPANY_TAGLINE)}.
            </p>
            <p style="margin:0 0 6px;font-size:12px;line-height:1.5;color:#64748b;">
              Questions? Reply to this email or write to <a href="mailto:${SUPPORT_EMAIL}" style="color:#147b6d;text-decoration:none;">${SUPPORT_EMAIL}</a>.
            </p>
            <p style="margin:0;font-size:11px;line-height:1.5;color:#94a3b8;">
              You're getting this because you have an Agently account.
              <a href="${APP_URL}${esc(preferencesPath)}" style="color:#94a3b8;text-decoration:underline;">Manage notifications</a>.
            </p>
          </td></tr>
        </table>

        <!-- Outer footer (legal address — optional but improves deliverability) -->
        <p style="margin:16px 0 0;font-size:11px;line-height:1.5;color:#94a3b8;text-align:center;max-width:560px;">
          Agently · Bengaluru, India
        </p>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

// ============================================================================
// Plain-text render (accessibility + spam-filter friendly)
// ============================================================================

export function renderAgentlyEmailText(input: AgentlyEmailInput): string {
  const { heading, intro, rows, primaryButton, footnote, preferencesPath = "/notifications" } = input;
  const lines: string[] = [];
  lines.push(heading.toUpperCase());
  lines.push("=".repeat(Math.min(heading.length, 60)));
  lines.push("");
  lines.push(intro);
  lines.push("");
  if (rows && rows.length) {
    for (const [label, value] of rows) {
      lines.push(`${label}: ${value}`);
    }
    lines.push("");
  }
  if (primaryButton) {
    lines.push(`${primaryButton.label}: ${primaryButton.href}`);
    lines.push("");
  }
  if (footnote) {
    lines.push(footnote);
    lines.push("");
  }
  lines.push("---");
  lines.push(`Sent by ${COMPANY_NAME} — ${COMPANY_TAGLINE}.`);
  lines.push(`Web: ${APP_URL}`);
  lines.push(`Support: ${SUPPORT_EMAIL}`);
  lines.push(`Manage notifications: ${APP_URL}${preferencesPath}`);
  lines.push(`Agently · Bengaluru, India`);
  return lines.join("\n");
}

// ============================================================================
// shared helpers
// ============================================================================

export function esc(value: string): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function appUrl(path = ""): string {
  return `${APP_URL}${path}`;
}
