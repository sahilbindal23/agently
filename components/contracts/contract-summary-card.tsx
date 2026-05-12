import { ExternalLink, FileText, ShieldCheck } from "lucide-react";
import type React from "react";
import { RiskBadge } from "@/components/contracts/risk-badge";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { Contract } from "@/types";

export function ContractSummaryCard({ contract }: { contract?: Contract | null }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Contract Risk</CardTitle>
        {contract ? <RiskBadge risk={contract.risk_level} /> : <Badge>not scanned</Badge>}
      </CardHeader>
      <p className="text-sm leading-6 text-muted-foreground">
        {contract?.summary ?? "No contract scan has been saved for this deal yet."}
      </p>
      {contract ? (
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <PacketDetail icon={<FileText className="h-4 w-4" />} label="Attachment">
            {contract.file_name ? (
              <>
                {contract.file_path ? (
                  <a
                    className="inline-flex max-w-full items-center gap-1 font-semibold text-primary underline-offset-4 hover:underline"
                    href={`/api/storage/contracts/${contract.id}`}
                    rel="noreferrer"
                    target="_blank"
                  >
                    <span className="truncate">{contract.file_name}</span>
                    <ExternalLink className="h-3.5 w-3.5 shrink-0" />
                  </a>
                ) : (
                  <p className="truncate font-semibold">{contract.file_name}</p>
                )}
                <p className="mt-1 text-xs text-muted-foreground">{formatFileMeta(contract.file_type, contract.file_size)}</p>
              </>
            ) : (
              <p className="text-muted-foreground">No original file attached.</p>
            )}
          </PacketDetail>
          <PacketDetail icon={<ShieldCheck className="h-4 w-4" />} label="Acceptance gate">
            <p className="font-semibold">{reviewLabel(contract.review_status, contract.risk_level)}</p>
            <p className="mt-1 text-xs text-muted-foreground">{reviewCopy(contract.review_status, contract.risk_level)}</p>
          </PacketDetail>
        </div>
      ) : null}
      {contract?.flags?.length ? (
        <div className="mt-4 space-y-3">
          {contract.flags.map((flag) => (
            <div key={flag.id} className="rounded-md border bg-white p-3 dark:border-white/8 dark:bg-card">
              <div className="mb-1 flex items-center justify-between gap-3">
                <p className="text-sm font-semibold">{flag.flag_type.replaceAll("_", " ")}</p>
                <Badge tone={flag.severity === "high" ? "red" : flag.severity === "medium" ? "amber" : "green"}>
                  {flag.severity}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground">{flag.excerpt}</p>
              <p className="mt-2 text-sm leading-5">{flag.recommendation}</p>
            </div>
          ))}
        </div>
      ) : null}
    </Card>
  );
}

function PacketDetail({ children, icon, label }: { children: React.ReactNode; icon: React.ReactNode; label: string }) {
  return (
    <div className="rounded-md border bg-card p-3 text-sm dark:border-white/8">
      <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase text-muted-foreground">
        <span className="text-primary">{icon}</span>
        {label}
      </div>
      {children}
    </div>
  );
}

function reviewLabel(status: string | null | undefined, risk: string) {
  if (status === "blocked" || risk === "high_risk") return "Blocked until negotiated";
  if (status === "needs_negotiation" || risk === "caution") return "Needs terms review";
  if (status === "safe_to_accept" || risk === "safe") return "Safe to accept";
  return "Needs review";
}

function reviewCopy(status: string | null | undefined, risk: string) {
  if (status === "blocked" || risk === "high_risk") return "Talent should not accept until risky clauses are changed or explicitly acknowledged.";
  if (status === "needs_negotiation" || risk === "caution") return "Review payment timing, usage, revisions, and exclusivity before accepting.";
  if (status === "safe_to_accept" || risk === "safe") return "No major risk flags were found by the current scan.";
  return "Attach and scan terms before accepting or funding the deal.";
}

function formatFileMeta(type?: string | null, size?: number | null) {
  const parts = [];
  if (type) parts.push(type);
  if (size) parts.push(`${Math.max(1, Math.round(size / 1024))} KB`);
  return parts.length ? parts.join(" - ") : "Stored with contract packet";
}
