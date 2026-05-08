import { ClipboardCheck, FileText, ShieldCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";

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
            The safest prototype flow is not “upload any brand contract.” It is “start from Agently terms, scan for changes, then gate acceptance and funding.” This reduces hidden usage, delayed payment, uncapped revisions, and dispute ambiguity.
          </p>
          <p className="mt-3 rounded-md border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-300">
            Prototype note: this is a product template, not legal advice. Before launch, have counsel convert this into enforceable platform terms and campaign order terms.
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
