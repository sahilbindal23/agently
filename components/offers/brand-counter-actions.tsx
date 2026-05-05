"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";

export function BrandCounterActions({
  id,
  kind
}: {
  id: string;
  kind: "deal" | "project";
}) {
  const router = useRouter();
  const [status, setStatus] = useState<"idle" | "saving" | "success" | "error">("idle");
  const [message, setMessage] = useState("");
  const [completed, setCompleted] = useState<"accept" | "decline" | null>(null);

  async function respond(action: "accept" | "decline") {
    setStatus("saving");
    setMessage("");
    try {
      const result = await fetch("/api/offers/counter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, kind, action })
      });

      if (!result.ok) {
        const body = await result.json().catch(() => ({}));
        setStatus("error");
        setMessage(body.error ?? "Could not update counter.");
        return;
      }

      setStatus("success");
      setCompleted(action);
      setMessage(action === "accept" ? "Counter accepted — terms updated." : "Counter declined.");
      router.refresh();
    } catch {
      setStatus("error");
      setMessage("Network error. Please try again.");
    }
  }

  if (status === "success" && completed) {
    const tone = completed === "accept" ? "emerald" : "red";
    return (
      <div className={`rounded-md border p-2 text-sm font-medium ${tone === "emerald" ? "border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-200" : "border-red-200 bg-red-50 text-red-900 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-200"}`}>
        {message}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        <Button disabled={status === "saving"} onClick={() => respond("accept")} type="button">
          <Check className="h-4 w-4" />
          {status === "saving" ? "Saving..." : "Accept counter"}
        </Button>
        <Button disabled={status === "saving"} onClick={() => respond("decline")} type="button" variant="secondary">
          <X className="h-4 w-4" />
          Decline counter
        </Button>
      </div>
      {message ? <p className={`text-sm ${status === "error" ? "text-red-600 dark:text-red-400" : "text-emerald-700 dark:text-emerald-400"}`}>{message}</p> : null}
    </div>
  );
}
