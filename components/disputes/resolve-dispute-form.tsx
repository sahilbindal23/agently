"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";

type Resolution = "resolved_release" | "resolved_refund" | "resolved_split" | "dismissed";

const options: Array<{ value: Resolution; label: string; description: string }> = [
  { value: "resolved_release", label: "Release to talent", description: "Talent delivered as agreed. Release the protected funds." },
  { value: "resolved_refund", label: "Refund to brand", description: "Talent did not deliver. Refund the brand and close the workflow." },
  { value: "resolved_split", label: "Split / partial release", description: "Manual settlement outside the platform. Note the split arrangement." },
  { value: "dismissed", label: "Dismiss", description: "No clear breach. Resume the normal workflow." }
];

export function ResolveDisputeForm({ disputeId }: { disputeId: string }) {
  const router = useRouter();
  const [resolution, setResolution] = useState<Resolution>("resolved_release");
  const [decisionNote, setDecisionNote] = useState("");
  const [status, setStatus] = useState<"idle" | "saving" | "success" | "error">("idle");
  const [message, setMessage] = useState("");

  async function submit() {
    setStatus("saving");
    setMessage("");
    try {
      const result = await fetch(`/api/disputes/${disputeId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resolution, decision_note: decisionNote })
      });
      if (!result.ok) {
        const body = await result.json().catch(() => ({}));
        setStatus("error");
        setMessage(body.error ?? "Could not resolve dispute.");
        return;
      }
      setStatus("success");
      setMessage("Dispute resolved.");
      router.refresh();
    } catch {
      setStatus("error");
      setMessage("Network error. Please try again.");
    }
  }

  if (status === "success") {
    return <p className="text-sm font-medium text-emerald-700 dark:text-emerald-400">{message}</p>;
  }

  return (
    <div className="space-y-3 rounded-md border bg-muted p-3 dark:border-white/8 dark:bg-white/4">
      <p className="text-xs font-semibold uppercase text-muted-foreground">Resolve</p>
      <div className="grid gap-2 sm:grid-cols-2">
        {options.map((option) => (
          <label
            key={option.value}
            className={`flex cursor-pointer flex-col gap-1 rounded-md border p-3 text-sm transition ${resolution === option.value ? "border-primary bg-white dark:bg-card" : "border-transparent bg-white/60 dark:bg-card/60"}`}
          >
            <span className="flex items-center gap-2 font-semibold">
              <input checked={resolution === option.value} name={`resolution-${disputeId}`} onChange={() => setResolution(option.value)} type="radio" />
              {option.label}
            </span>
            <span className="text-xs leading-5 text-muted-foreground">{option.description}</span>
          </label>
        ))}
      </div>
      <Textarea
        onChange={(event) => setDecisionNote(event.target.value)}
        placeholder="Decision note shown to both parties (required, min 5 characters)"
        value={decisionNote}
      />
      <div className="flex flex-wrap gap-2">
        <Button disabled={status === "saving"} onClick={submit} type="button">
          {status === "saving" ? "Resolving..." : "Submit decision"}
        </Button>
      </div>
      {message && status === "error" ? <p className="text-sm text-red-600 dark:text-red-400">{message}</p> : null}
    </div>
  );
}
