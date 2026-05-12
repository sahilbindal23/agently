import { Info } from "lucide-react";

// One-line disclaimer for every AI-generated surface.
//
// Why we need this:
//   1. Indian DPDP Act + general consumer protection law treat AI estimates
//      (valuations, contract risk, ROI projections, negotiation suggestions)
//      as information, not legal or financial advice. Saying so explicitly
//      lowers our exposure if a user makes a bad decision based on a model
//      output and then turns around to sue.
//   2. Sets accurate user expectations: model output is a starting point
//      for human judgement, not a verdict.
//
// Usage:
//   <AiDisclaimer kind="valuation" />        // pricing/valuation surfaces
//   <AiDisclaimer kind="contract" />         // contract risk / clause flags
//   <AiDisclaimer kind="match" />            // brand match / recommendation
//   <AiDisclaimer kind="negotiation" />      // negotiation copilot
//   <AiDisclaimer kind="generic" />          // anything else

type DisclaimerKind = "valuation" | "contract" | "match" | "negotiation" | "generic";

const COPY: Record<DisclaimerKind, string> = {
  valuation: "AI-generated estimate based on benchmarks and historical data. Not a guarantee of brand offers or contract value. Use as a starting point, not a quote.",
  contract: "AI-generated clause analysis. Not legal advice. Have a qualified lawyer review any contract before signing, especially anything with exclusivity, IP transfer, or indemnity terms.",
  match: "AI-generated brand fit recommendations based on niche, audience, and historical signals. Final outreach and negotiation decisions are yours.",
  negotiation: "AI-suggested copy and counter strategies. Review every message before sending — model output can sound confident while being commercially or legally wrong.",
  generic: "AI-generated content. Estimates and suggestions are not professional advice. Verify before acting."
};

export function AiDisclaimer({ kind = "generic", className = "" }: { kind?: DisclaimerKind; className?: string }) {
  return (
    <p className={`mt-3 flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50/70 px-3 py-2 text-xs leading-5 text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/20 dark:text-amber-200 ${className}`}>
      <Info aria-hidden className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" />
      <span>{COPY[kind]}</span>
    </p>
  );
}
