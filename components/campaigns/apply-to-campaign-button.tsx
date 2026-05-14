"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Check, Send } from "lucide-react";
import { Button } from "@/components/ui/button";

type Existing = { status: string; source: string } | undefined;

export function ApplyToCampaignButton({ campaignId, existing }: { campaignId: string; existing: Existing }) {
  const router = useRouter();
  const [status, setStatus] = useState<"idle" | "applying" | "done" | "error">("idle");
  const [message, setMessage] = useState<string | null>(null);

  // If we already have a row for this (campaign, creator) — either the
  // brand invited us or we already applied — show a static badge instead
  // of an action button.
  if (existing) {
    const isInvite = existing.source === "brand_invite";
    return (
      <span className={`inline-flex h-9 items-center gap-1.5 rounded-md border px-3 text-xs font-medium ${isInvite ? "border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-300" : "border-blue-300 bg-blue-50 text-blue-800 dark:border-sky-900/50 dark:bg-sky-950/30 dark:text-sky-300"}`}>
        <Check className="h-3.5 w-3.5" />
        {isInvite ? "Brand invited you" : "Application sent"}
      </span>
    );
  }

  async function apply() {
    setStatus("applying");
    setMessage(null);
    const response = await fetch(`/api/campaigns/${campaignId}/apply`, {
      method: "POST",
      headers: { "Content-Type": "application/json" }
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      setStatus("error");
      setMessage(body.error ?? "Could not submit application.");
      return;
    }
    setStatus("done");
    setMessage(body.message ?? "Application submitted.");
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-1">
      <Button disabled={status === "applying" || status === "done"} onClick={apply} type="button">
        <Send className="h-4 w-4" />
        {status === "applying" ? "Applying..." : status === "done" ? "Submitted" : "Apply"}
      </Button>
      {message ? (
        <p className={`text-xs ${status === "error" ? "text-red-600 dark:text-red-400" : "text-emerald-700 dark:text-emerald-300"}`}>
          {message}
        </p>
      ) : null}
    </div>
  );
}
