"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, MessageSquare, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";

type ResponseStatus = "accepted" | "changes_requested" | "declined";

type OfferResponseActionsProps = {
  dealId?: string;
  projectId?: string;
  kind?: "deal" | "project";
  hasContract?: boolean;
  hasHighRiskContract?: boolean;
  contractReviewStatus?: string | null;
  initialAmountCents?: number | null;
  initialScope?: string | null;
  initialDueDate?: string | null;
  initialUsageRights?: string | null;
  initialApprovalTerms?: string | null;
};

export function OfferResponseActions({
  dealId,
  projectId,
  kind = "deal",
  hasContract = true,
  hasHighRiskContract = false,
  contractReviewStatus,
  initialAmountCents,
  initialScope,
  initialDueDate,
  initialUsageRights,
  initialApprovalTerms
}: OfferResponseActionsProps) {
  const router = useRouter();
  const [response, setResponse] = useState("");
  const [counterAmountInr, setCounterAmountInr] = useState(initialAmountCents ? String(Math.round(initialAmountCents / 100)) : "");
  const [counterScope, setCounterScope] = useState(initialScope ?? "");
  const [counterDueDate, setCounterDueDate] = useState(initialDueDate ?? "");
  const [counterUsageRights, setCounterUsageRights] = useState(initialUsageRights ?? "");
  const [counterApprovalTerms, setCounterApprovalTerms] = useState(initialApprovalTerms ?? "");
  const [acknowledgeHighRisk, setAcknowledgeHighRisk] = useState(false);
  const [status, setStatus] = useState<"idle" | "saving" | "success" | "error">("idle");
  const [message, setMessage] = useState("");
  const [completedStatus, setCompletedStatus] = useState<ResponseStatus | null>(null);

  async function respond(nextStatus: ResponseStatus) {
    if (nextStatus === "accepted" && kind === "deal" && !hasContract) {
      setStatus("error");
      setMessage("A contract scan is required before accepting. Ask the brand or Agently to attach and scan the terms first.");
      return;
    }

    if (nextStatus === "accepted" && kind === "deal" && hasHighRiskContract && !acknowledgeHighRisk) {
      setStatus("error");
      setMessage("This offer has a high-risk contract attached. Tick the contract review checkbox above before accepting.");
      return;
    }

    setStatus("saving");
    setMessage("");

    try {
      const result = await fetch(kind === "project" ? "/api/freelancer-projects/respond" : "/api/offers/respond", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...(kind === "project" ? { project_id: projectId } : { deal_id: dealId }),
          status: nextStatus,
          response,
          acknowledge_high_risk: acknowledgeHighRisk,
          counter: nextStatus === "changes_requested" ? {
            amount_cents: counterAmountInr ? Math.round(Number(counterAmountInr) * 100) : null,
            scope: counterScope,
            due_date: counterDueDate || null,
            usage_rights: counterUsageRights,
            approval_terms: counterApprovalTerms
          } : null
        })
      });

      if (!result.ok) {
        const body = await result.json().catch(() => ({}));
        setStatus("error");
        setMessage(body.error ?? "Could not update offer.");
        return;
      }

      setStatus("success");
      setCompletedStatus(nextStatus);
      setMessage(nextStatus === "accepted" ? "Offer accepted." : nextStatus === "declined" ? "Offer declined." : "Counter sent.");
      router.refresh();
    } catch {
      setStatus("error");
      setMessage("Network error. Please check your connection and try again.");
    }
  }

  if (status === "success" && completedStatus) {
    const tone = completedStatus === "accepted" ? "emerald" : completedStatus === "declined" ? "red" : "amber";
    return (
      <div className={`rounded-md border p-3 text-sm font-medium ${tone === "emerald" ? "border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-200" : tone === "red" ? "border-red-200 bg-red-50 text-red-900 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-200" : "border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-200"}`}>
        {message}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <Textarea value={response} onChange={(event) => setResponse(event.target.value)} placeholder="Short note to the brand, e.g. what you can accept or why you need changes" />
      {kind === "deal" && !hasContract ? (
        <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm leading-5 text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-200">
          Contract scan required before acceptance. You can message the brand, decline, or request changes while waiting for terms to be attached.
        </div>
      ) : null}
      {kind === "deal" && hasContract && contractReviewStatus ? (
        <div className="rounded-md border bg-muted p-3 text-sm leading-5 text-muted-foreground dark:border-white/8">
          Contract gate: <span className="font-semibold text-foreground">{contractReviewStatus.replaceAll("_", " ")}</span>
        </div>
      ) : null}
      {kind === "deal" && hasHighRiskContract ? (
        <label className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm leading-5 text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-200">
          <input
            checked={acknowledgeHighRisk}
            className="mt-1"
            onChange={(event) => setAcknowledgeHighRisk(event.target.checked)}
            type="checkbox"
          />
          <span>I have reviewed the high-risk contract warning. High-risk contracts should be negotiated before accepting.</span>
        </label>
      ) : null}
      <div className="scroll-mt-24 rounded-md border bg-white p-3 dark:border-white/8 dark:bg-card" id={`counter-${dealId ?? projectId ?? "new"}`}>
        <div className="mb-3">
          <p className="text-sm font-semibold">Structured counter</p>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">Use this when requesting changes so the brand receives clear commercial terms, not just a loose chat message.</p>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          <Input inputMode="numeric" min="1" onChange={(event) => setCounterAmountInr(event.target.value)} placeholder="Counter amount INR" type="number" value={counterAmountInr} />
          <Input onChange={(event) => setCounterDueDate(event.target.value)} type="date" value={counterDueDate} />
          <Input onChange={(event) => setCounterUsageRights(event.target.value)} placeholder="Usage rights change, e.g. organic only for 30 days" value={counterUsageRights} />
          <Input onChange={(event) => setCounterApprovalTerms(event.target.value)} placeholder="Approval/revision terms, e.g. 1 revision round" value={counterApprovalTerms} />
          <Textarea className="md:col-span-2" onChange={(event) => setCounterScope(event.target.value)} placeholder={kind === "project" ? "Revised project scope" : "Revised deliverables"} value={counterScope} />
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button disabled={status === "saving" || (kind === "deal" && !hasContract)} onClick={() => respond("accepted")} type="button">
          <Check className="h-4 w-4" />
          {status === "saving" ? "Saving..." : "Accept"}
        </Button>
        <Button disabled={status === "saving"} onClick={() => respond("changes_requested")} type="button" variant="secondary">
          <MessageSquare className="h-4 w-4" />
          Request changes
        </Button>
        <Button disabled={status === "saving"} onClick={() => respond("declined")} type="button" variant="danger">
          <X className="h-4 w-4" />
          Decline
        </Button>
      </div>
      {message ? <p className={`text-sm ${status === "error" ? "text-red-600 dark:text-red-400" : "text-emerald-700 dark:text-emerald-400"}`}>{message}</p> : null}
    </div>
  );
}
