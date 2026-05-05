"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertOctagon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";

export function OpenDisputeButton({
  dealId,
  projectId,
  disputeStatus
}: {
  dealId?: string;
  projectId?: string;
  disputeStatus?: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [evidenceUrl, setEvidenceUrl] = useState("");
  const [status, setStatus] = useState<"idle" | "saving" | "success" | "error">("idle");
  const [message, setMessage] = useState("");

  if (disputeStatus === "open") {
    return (
      <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-900 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-200">
        <p className="font-semibold">Dispute open</p>
        <p className="mt-1 text-xs leading-5">Payment release is paused while Agently reviews this dispute.</p>
      </div>
    );
  }
  if (disputeStatus === "resolved") {
    return (
      <p className="text-xs text-muted-foreground">Dispute resolved by Agently.</p>
    );
  }

  async function submit() {
    setStatus("saving");
    setMessage("");
    try {
      const result = await fetch("/api/disputes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          deal_id: dealId,
          freelancer_project_id: projectId,
          reason,
          evidence_url: evidenceUrl
        })
      });
      if (!result.ok) {
        const body = await result.json().catch(() => ({}));
        setStatus("error");
        setMessage(body.error ?? "Could not open dispute.");
        return;
      }
      setStatus("success");
      setMessage("Dispute opened. Agently will review and contact both parties.");
      router.refresh();
    } catch {
      setStatus("error");
      setMessage("Network error. Please try again.");
    }
  }

  if (status === "success") {
    return (
      <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm font-medium text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-200">
        {message}
      </div>
    );
  }

  if (!open) {
    return (
      <Button onClick={() => setOpen(true)} type="button" variant="secondary">
        <AlertOctagon className="h-4 w-4" />
        Report issue
      </Button>
    );
  }

  return (
    <div className="space-y-3 rounded-md border bg-white p-3 dark:border-white/8 dark:bg-card">
      <div>
        <p className="text-sm font-semibold">Open a dispute</p>
        <p className="mt-1 text-xs leading-5 text-muted-foreground">Use this if delivery, payment, or terms are not being honored. Agently will pause payout, review evidence from both sides, and decide release, refund, or split.</p>
      </div>
      <Textarea
        onChange={(event) => setReason(event.target.value)}
        placeholder="Describe what went wrong (deadline missed, deliverable not as agreed, payment not released, etc.)"
        value={reason}
      />
      <Input
        onChange={(event) => setEvidenceUrl(event.target.value)}
        placeholder="Optional evidence URL (Drive folder, screenshots, chat export)"
        value={evidenceUrl}
      />
      <div className="flex flex-wrap gap-2">
        <Button disabled={status === "saving"} onClick={submit} type="button" variant="danger">
          {status === "saving" ? "Submitting..." : "Submit dispute"}
        </Button>
        <Button disabled={status === "saving"} onClick={() => setOpen(false)} type="button" variant="secondary">
          Cancel
        </Button>
      </div>
      {message && status === "error" ? <p className="text-sm text-red-600 dark:text-red-400">{message}</p> : null}
    </div>
  );
}
