"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, MessageSquare, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";

type ResponseStatus = "accepted" | "changes_requested" | "declined";

export function OfferResponseActions({ dealId, projectId, kind = "deal" }: { dealId?: string; projectId?: string; kind?: "deal" | "project" }) {
  const router = useRouter();
  const [response, setResponse] = useState("");
  const [counterAmountInr, setCounterAmountInr] = useState("");
  const [counterScope, setCounterScope] = useState("");
  const [counterDueDate, setCounterDueDate] = useState("");
  const [counterUsageRights, setCounterUsageRights] = useState("");
  const [counterApprovalTerms, setCounterApprovalTerms] = useState("");
  const [acknowledgeHighRisk, setAcknowledgeHighRisk] = useState(false);
  const [status, setStatus] = useState<"idle" | "saving" | "error">("idle");
  const [message, setMessage] = useState("");

  async function respond(nextStatus: ResponseStatus) {
    setStatus("saving");
    setMessage("");
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

    setStatus("idle");
    router.refresh();
  }

  return (
    <div className="space-y-3">
      <Textarea value={response} onChange={(event) => setResponse(event.target.value)} placeholder="Short note to the brand, e.g. what you can accept or why you need changes" />
      {kind === "deal" ? (
        <label className="flex items-start gap-2 rounded-md border bg-amber-50 p-3 text-sm leading-5 text-amber-900">
          <input
            checked={acknowledgeHighRisk}
            className="mt-1"
            onChange={(event) => setAcknowledgeHighRisk(event.target.checked)}
            type="checkbox"
          />
          <span>I have reviewed the contract risk warning if one exists. High-risk contracts should be negotiated before accepting.</span>
        </label>
      ) : null}
      <div className="scroll-mt-24 rounded-md border bg-white p-3" id={`counter-${dealId ?? projectId ?? "new"}`}>
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
        <Button disabled={status === "saving"} onClick={() => respond("accepted")} type="button">
          <Check className="h-4 w-4" />
          Accept
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
      {message ? <p className={`text-sm ${status === "error" ? "text-red-600" : "text-emerald-700"}`}>{message}</p> : null}
    </div>
  );
}
