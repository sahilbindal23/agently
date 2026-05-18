// Render the standard Agently agreement from a deal/project + party data.
// Snapshots the terms into structured JSON (for queryability) AND a
// pre-rendered HTML view (for display + future PDF export).

export type AgreementParties = {
  brand_name: string;
  brand_contact_email: string | null;
  brand_website: string | null;
  talent_name: string;
  talent_role: "creator" | "freelancer";
};

export type AgreementTerms = {
  // Commercial scope
  title: string;
  deliverables: string;
  amount_inr: number;
  currency: string;
  due_date: string | null;
  // Usage + revisions
  usage_rights: string | null;
  approval_terms: string | null;
  // Provenance
  source_kind: "deal" | "freelancer_project";
  source_id: string;
  campaign_id: string | null;
  generated_at: string;
};

export type RenderedAgreement = {
  terms: AgreementTerms & { parties: AgreementParties };
  html: string;
  version: "v1";
};

const TEMPLATE_VERSION = "v1" as const;

export function renderAgreement(parties: AgreementParties, terms: AgreementTerms): RenderedAgreement {
  const inrFormatted = formatINR(terms.amount_inr);
  const dueDateText = terms.due_date ? formatDate(terms.due_date) : "as agreed in writing";
  const usageRightsText = terms.usage_rights?.trim() || "Posting on the talent's own social channels for 30 days. Any reuse beyond the listed channels or duration requires a separately priced addendum.";
  const approvalTermsText = terms.approval_terms?.trim() || "One reasonable revision round included. Brand-side delays beyond 5 business days release the talent to publish as-submitted.";
  const todayText = formatDate(terms.generated_at);

  const html = `
<article class="deal-agreement">
  <header>
    <h1>Agently Standard Agreement</h1>
    <p class="meta">Version ${TEMPLATE_VERSION} · Generated ${todayText} · Agreement reference ${terms.source_kind}:${terms.source_id}</p>
  </header>

  <section>
    <h2>1. Parties</h2>
    <p><strong>Brand:</strong> ${esc(parties.brand_name)}${parties.brand_contact_email ? ` — ${esc(parties.brand_contact_email)}` : ""}${parties.brand_website ? ` — <a href="${esc(parties.brand_website)}" rel="noreferrer">${esc(parties.brand_website)}</a>` : ""}</p>
    <p><strong>${parties.talent_role === "freelancer" ? "Freelancer" : "Creator"}:</strong> ${esc(parties.talent_name)}</p>
    <p>This agreement is mediated by Agently and governed by Agently's platform terms.</p>
  </section>

  <section>
    <h2>2. Commercial scope</h2>
    <ul>
      <li><strong>Engagement:</strong> ${esc(terms.title)}</li>
      <li><strong>Deliverables:</strong> ${esc(terms.deliverables)}</li>
      <li><strong>Agreed value:</strong> ${esc(inrFormatted)}</li>
      <li><strong>Due date:</strong> ${esc(dueDateText)}</li>
    </ul>
  </section>

  <section>
    <h2>3. Usage rights</h2>
    <p>${esc(usageRightsText)}</p>
    <p>Reuse outside the listed channels or beyond the listed duration must be explicitly priced and added in writing. Absent that, default usage applies.</p>
  </section>

  <section>
    <h2>4. Revisions and approval</h2>
    <p>${esc(approvalTermsText)}</p>
    <p>Brief changes, scope creep, or new deliverables introduced after acceptance constitute a new engagement and require a separately priced addendum.</p>
  </section>

  <section>
    <h2>5. Payment protection</h2>
    <p>The brand funds the agreed value through Agently's protected payment workflow before final delivery. Funds are released to the ${parties.talent_role === "freelancer" ? "freelancer" : "creator"} after deliverables match the accepted scope, or after dispute review resolves in their favour.</p>
    <p>Agently charges a 3% platform fee on protected payouts. The fee is deducted from the contract value before the talent's payout is released. Brands who want the talent to receive a specific net amount should gross up the contract value accordingly when sending the offer.</p>
  </section>

  <section>
    <h2>6. Disputes</h2>
    <p>If brand and talent disagree on whether deliverables match the accepted scope, either party may open a dispute inside Agently. Both sides submit evidence; Agently may pause release, request clarification, approve partial release, or refund based on the accepted scope and submitted proof.</p>
  </section>

  <section>
    <h2>7. Cancellation</h2>
    <p>Either party may withdraw before deliverables are funded. After funding, withdrawal requires the other party's written consent or a dispute resolution.</p>
  </section>

  <section>
    <h2>8. Confidentiality</h2>
    <p>Both parties keep campaign briefs, internal feedback, unreleased materials, and commercial terms confidential to the engagement. Public posts and final deliverables are not confidential once published per the agreed usage.</p>
  </section>

  <section>
    <h2>9. Acceptance</h2>
    <p>This agreement becomes binding when both the brand representative and the ${parties.talent_role === "freelancer" ? "freelancer" : "creator"} record their typed signature inside Agently. The signed record (timestamp, IP, profile ID) is preserved as proof of execution.</p>
  </section>
</article>
`.trim();

  return {
    version: TEMPLATE_VERSION,
    terms: { ...terms, parties },
    html
  };
}

function esc(text: unknown): string {
  return String(text ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function formatINR(amount: number): string {
  if (!Number.isFinite(amount) || amount <= 0) return "INR 0";
  // India numbering format
  return `INR ${new Intl.NumberFormat("en-IN").format(Math.round(amount))}`;
}

function formatDate(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" });
  } catch {
    return iso;
  }
}
