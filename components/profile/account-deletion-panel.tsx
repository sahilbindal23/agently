"use client";

import { useState } from "react";
import { AlertTriangle, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/input";

type DeleteResult = {
  status?: "deleted" | "pending_review";
  message?: string;
  blockers?: Array<{ title: string; reason: string }>;
  next_url?: string;
  error?: string;
};

export function AccountDeletionPanel() {
  const [confirmation, setConfirmation] = useState("");
  const [reason, setReason] = useState("");
  const [status, setStatus] = useState<"idle" | "submitting" | "done" | "error">("idle");
  const [result, setResult] = useState<DeleteResult | null>(null);

  async function requestDeletion() {
    setStatus("submitting");
    setResult(null);

    const response = await fetch("/api/account/delete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ confirmation, reason })
    });
    const body = await response.json().catch(() => ({}));

    if (!response.ok) {
      setStatus("error");
      setResult({ error: body.error ?? "Could not request account deletion." });
      return;
    }

    setStatus("done");
    setResult(body);
    if (body.status === "deleted") {
      window.location.href = body.next_url || "/";
    }
  }

  return (
    <Card className="mt-6 border-red-200 bg-red-50/60 dark:border-red-900/60 dark:bg-red-950/20">
      <CardHeader>
        <div>
          <CardTitle className="flex items-center gap-2 text-red-700 dark:text-red-200">
            <AlertTriangle className="h-4 w-4" />
            Delete account
          </CardTitle>
          <p className="mt-1 text-sm leading-6 text-red-900/75 dark:text-red-100/75">
            This removes your login and deletes or anonymizes profile data where legally and operationally possible. Active offers, funded payments, submitted deliverables, or disputes create a review request instead of instant deletion.
          </p>
        </div>
      </CardHeader>
      <div className="grid gap-3 md:grid-cols-[1fr_auto]">
        <div className="space-y-3">
          <input
            className="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring dark:border-white/10"
            onChange={(event) => setConfirmation(event.target.value)}
            placeholder="Type DELETE to confirm"
            value={confirmation}
          />
          <Textarea
            onChange={(event) => setReason(event.target.value)}
            placeholder="Optional reason for deletion"
            value={reason}
          />
        </div>
        <Button disabled={status === "submitting" || confirmation !== "DELETE"} onClick={requestDeletion} type="button" variant="danger">
          <Trash2 className="h-4 w-4" />
          {status === "submitting" ? "Submitting..." : "Delete account"}
        </Button>
      </div>
      {result?.error ? <p className="mt-3 text-sm font-semibold text-red-700 dark:text-red-200">{result.error}</p> : null}
      {result?.status === "pending_review" ? (
        <div className="mt-4 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-100">
          <p className="font-semibold">Deletion request created for review.</p>
          <p className="mt-1">{result.message}</p>
          {result.blockers?.length ? (
            <ul className="mt-2 list-disc space-y-1 pl-5">
              {result.blockers.map((blocker) => (
                <li key={`${blocker.title}-${blocker.reason}`}>{blocker.title}: {blocker.reason}</li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
    </Card>
  );
}
