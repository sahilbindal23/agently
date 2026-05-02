"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, MessageSquare, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";

type ResponseStatus = "accepted" | "changes_requested" | "declined";

export function OfferResponseActions({ dealId, projectId, kind = "deal" }: { dealId?: string; projectId?: string; kind?: "deal" | "project" }) {
  const router = useRouter();
  const [response, setResponse] = useState("");
  const [status, setStatus] = useState<"idle" | "saving" | "error">("idle");
  const [message, setMessage] = useState("");

  async function respond(nextStatus: ResponseStatus) {
    setStatus("saving");
    setMessage("");
    const result = await fetch(kind === "project" ? "/api/freelancer-projects/respond" : "/api/offers/respond", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(kind === "project" ? { project_id: projectId, status: nextStatus, response } : { deal_id: dealId, status: nextStatus, response })
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
      <Textarea value={response} onChange={(event) => setResponse(event.target.value)} placeholder="Optional response, counter, or reason" />
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
