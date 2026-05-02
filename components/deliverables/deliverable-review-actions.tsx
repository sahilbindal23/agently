"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";

export function DeliverableReviewActions({ deliverableId }: { deliverableId: string }) {
  const router = useRouter();
  const [notes, setNotes] = useState("");
  const [status, setStatus] = useState<"idle" | "saving" | "error">("idle");
  const [message, setMessage] = useState("");

  async function review(nextStatus: "approved" | "revision_requested") {
    setStatus("saving");
    setMessage("");
    const response = await fetch("/api/deliverables/review", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ deliverable_id: deliverableId, status: nextStatus, review_notes: notes })
    });

    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      setStatus("error");
      setMessage(body.error ?? "Could not review deliverable.");
      return;
    }

    setStatus("idle");
    setMessage(nextStatus === "approved" ? "Approved. Payment is ready for release." : "Revision requested.");
    router.refresh();
  }

  return (
    <div className="space-y-3">
      <Textarea value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Optional approval notes or revision request" />
      <div className="flex flex-wrap gap-2">
        <Button disabled={status === "saving"} onClick={() => review("approved")} type="button">
          <CheckCircle2 className="h-4 w-4" />
          Approve
        </Button>
        <Button disabled={status === "saving"} onClick={() => review("revision_requested")} type="button" variant="secondary">
          <RotateCcw className="h-4 w-4" />
          Request revision
        </Button>
      </div>
      {message ? <p className={`text-sm ${status === "error" ? "text-red-600" : "text-emerald-700"}`}>{message}</p> : null}
    </div>
  );
}
