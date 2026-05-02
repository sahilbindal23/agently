"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, CreditCard, Send, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";

type EntityType = "deal" | "freelancer_project";
type PaymentStatus = "pending" | "funded" | "release_ready" | "released";

export function PaymentActions({ entityId, entityType }: { entityId: string; entityType: EntityType }) {
  const router = useRouter();
  const [status, setStatus] = useState<"idle" | "saving" | "error">("idle");

  async function update(nextStatus: PaymentStatus) {
    setStatus("saving");
    const response = await fetch("/api/payments/update-status", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ entity_id: entityId, entity_type: entityType, status: nextStatus })
    });

    if (!response.ok) {
      setStatus("error");
      return;
    }

    setStatus("idle");
    router.refresh();
  }

  async function createLink() {
    if (entityType !== "deal") {
      await update("pending");
      return;
    }

    setStatus("saving");
    const response = await fetch("/api/payments/create-link", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ deal_id: entityId })
    });

    if (!response.ok) {
      setStatus("error");
      return;
    }

    setStatus("idle");
    router.refresh();
  }

  return (
    <div className="flex flex-wrap justify-end gap-2">
      <Button disabled={status === "saving"} onClick={createLink} size="sm" type="button" variant="secondary">
        <CreditCard className="h-4 w-4" />
        {entityType === "deal" ? "Payment link" : "Mark pending"}
      </Button>
      <Button disabled={status === "saving"} onClick={() => update("funded")} size="sm" type="button" variant="secondary">
        <ShieldCheck className="h-4 w-4" />
        Funded
      </Button>
      <Button disabled={status === "saving"} onClick={() => update("release_ready")} size="sm" type="button" variant="secondary">
        <CheckCircle2 className="h-4 w-4" />
        Ready
      </Button>
      <Button disabled={status === "saving"} onClick={() => update("released")} size="sm" type="button">
        <Send className="h-4 w-4" />
        Released
      </Button>
    </div>
  );
}
