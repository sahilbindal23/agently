import { ClipboardCheck, FileText, ShieldCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";

// Boilerplate text version of the Agently contract packet. The scan form
// pre-fills this when a brand or admin clicks "Use Agently packet" — gives
// the contract scanner a complete, balanced agreement to run against so
// risk_level lands at "safe" and the creator can accept.
//
// Important: this is product copy, not legal advice. Brands should still
// have counsel review before relying on it for high-value live deals.
export const AGENTLY_CONTRACT_PACKET_TEXT = `AGENTLY STANDARD CAMPAIGN AGREEMENT

This Agreement is entered into between the Brand and the Talent (creator or freelancer) named on the linked Agently deal record, effective on the date the Talent accepts the offer inside Agently.

1. COMMERCIAL SCOPE
1.1 Deliverables, due dates, approval owner, and contract value in INR are governed by the linked Agently deal record.
1.2 Any change to deliverables, due dates, or value must be agreed in writing inside Agently (offer counter or message) before it takes effect.

2. USAGE RIGHTS
2.1 Brand receives only the usage rights listed in the deal scope, for the duration listed in the deal scope.
2.2 Paid amplification (boosted posts, dark posts, whitelisting, Spark Ads or equivalent) requires a separately priced add-on. Default is organic usage only.
2.3 Perpetual usage, exclusivity beyond the listed duration, and reuse outside the listed channels are not granted unless added in writing.

3. PAYMENT PROTECTION
3.1 Brand funds the contract value into Agently before the Talent is required to deliver final, brand-approved assets.
3.2 Payout to Talent is released by Agently after the deliverables match the accepted scope, or after a dispute review resolves in the Talent's favour.
3.3 If Brand fails to fund within seven (7) business days of acceptance, Talent may pause work without penalty.

4. REVISIONS
4.1 One reasonable revision round is included.
4.2 Revisions caused by brand-side brief changes, delayed feedback (more than five business days), or new scope require an updated fee agreed in writing inside Agently.

5. CANCELLATION
5.1 If Brand cancels after acceptance but before delivery start, a 25% kill fee applies on the contract value.
5.2 If Brand cancels after delivery start, a 50% kill fee applies plus any pre-approved out-of-pocket expenses.
5.3 Talent may cancel without penalty if Brand has failed to fund per Section 3.3.

6. DISPUTES
6.1 If Brand and Talent disagree about whether deliverables match the accepted scope, either party may open a dispute inside Agently.
6.2 Both sides submit evidence (briefs, drafts, approvals, messages) inside Agently.
6.3 Agently may pause release, request clarification, approve partial release, or refund based on the accepted scope and submitted proof.

7. CONFIDENTIALITY
7.1 Both parties keep brief details, draft assets, and unreleased product information confidential until publication or until the Brand publicly announces the campaign.

8. INTELLECTUAL PROPERTY
8.1 Talent retains authorship and the right to feature the work in their portfolio.
8.2 Brand receives the usage rights set out in Section 2 and no broader rights.

9. COMPLIANCE
9.1 Talent will disclose the partnership in line with ASCI / SEBI / platform guidelines applicable to the listed channels.
9.2 Talent will not use prohibited claims (medical, financial guarantees, false performance claims) without prior written approval from Brand and Agently.

10. GENERAL
10.1 This Agreement is governed by the laws of India. Disputes not resolved through the Agently dispute process will be subject to the exclusive jurisdiction of courts in Bengaluru, Karnataka.
10.2 Acceptance of the offer inside Agently by the Talent constitutes acceptance of these terms by both parties.
`;

const templateSections = [
  {
    title: "Commercial scope",
    copy: "Campaign name, brand, creator or freelancer, deliverables, usage channel, due date, approval owner, and agreed contract value in INR."
  },
  {
    title: "Usage rights",
    copy: "Brand receives only the listed usage rights for the listed duration. Paid ads, whitelisting, reshoots, perpetual usage, and category exclusivity must be explicitly priced and written."
  },
  {
    title: "Payment protection",
    copy: "Brand funds through Agently before final delivery. Payout is released after deliverables match the accepted scope or after dispute review resolves in talent's favour."
  },
  {
    title: "Revision boundary",
    copy: "One reasonable revision round is included unless otherwise agreed. Revisions caused by brand-side brief changes, delayed feedback, or new scope require an updated fee."
  },
  {
    title: "Dispute clause",
    copy: "If brand and talent disagree, both sides submit evidence inside Agently. Agently may pause release, request clarification, approve partial release, or refund based on the accepted scope and submitted proof."
  }
];

export function AgentlyContractTemplate() {
  return (
    <Card className="mb-5">
      <CardHeader>
        <div>
          <CardTitle>Agently Contract Template</CardTitle>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">
            Use this platform packet as the default agreement. Brand-supplied contracts should be treated as exception cases and reviewed before acceptance.
          </p>
        </div>
        <Badge tone="green">recommended default</Badge>
      </CardHeader>
      <div className="grid gap-3 lg:grid-cols-[0.9fr_1.1fr]">
        <div className="rounded-md border bg-muted/40 p-4 dark:border-white/10 dark:bg-white/5">
          <div className="mb-3 flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-primary" />
            <p className="text-sm font-semibold">Why this matters</p>
          </div>
          <p className="text-sm leading-6 text-muted-foreground">
            The safest flow is not &ldquo;upload any brand contract.&rdquo; It is &ldquo;start from Agently terms, scan for changes, then gate acceptance and funding.&rdquo; This reduces hidden usage, delayed payment, uncapped revisions, and dispute ambiguity.
          </p>
          <p className="mt-3 rounded-md border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-300">
            This is a product template, not legal advice. Have qualified counsel review before relying on it for live deals — see /privacy and /terms for our platform-wide commitments.
          </p>
        </div>
        <div className="grid gap-2">
          {templateSections.map((section) => (
            <div className="rounded-md border bg-white p-3 dark:border-white/10 dark:bg-card" key={section.title}>
              <div className="mb-1 flex items-center gap-2">
                {section.title === "Commercial scope" ? <FileText className="h-4 w-4 text-primary" /> : <ClipboardCheck className="h-4 w-4 text-primary" />}
                <p className="text-sm font-semibold">{section.title}</p>
              </div>
              <p className="text-xs leading-5 text-muted-foreground">{section.copy}</p>
            </div>
          ))}
        </div>
      </div>
    </Card>
  );
}
