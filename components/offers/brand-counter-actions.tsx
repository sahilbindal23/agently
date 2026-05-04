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
  const [status, setStatus] = useState<"idle" | "saving" | "error">("idle");
  const [message, setMessage] = useState("");

  async function respond(action: "accept" | "decline") {
    setStatus("saving");
    setMessage("");
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

    setStatus("idle");
    router.refresh();
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        <Button disabled={status === "saving"} onClick={() => respond("accept")} type="button">
          <Check className="h-4 w-4" />
          Accept counter
        </Button>
        <Button disabled={status === "saving"} onClick={() => respond("decline")} type="button" variant="secondary">
          <X className="h-4 w-4" />
          Decline counter
        </Button>
      </div>
      {message ? <p className={`text-sm ${status === "error" ? "text-red-600" : "text-emerald-700"}`}>{message}</p> : null}
    </div>
  );
}
