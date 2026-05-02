"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";

export function RemoveShortlistButton({
  campaignId,
  entityType,
  entityId
}: {
  campaignId: string;
  entityType: "creator" | "freelancer";
  entityId: string;
}) {
  const router = useRouter();
  const [status, setStatus] = useState<"idle" | "saving" | "error">("idle");

  async function remove() {
    setStatus("saving");
    const response = await fetch("/api/campaigns/shortlist/remove", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ campaign_id: campaignId, entity_type: entityType, entity_id: entityId })
    });

    if (!response.ok) {
      setStatus("error");
      return;
    }

    router.refresh();
  }

  return (
    <Button disabled={status === "saving"} onClick={remove} size="sm" type="button" variant="secondary">
      <X className="h-4 w-4" />
      Remove
    </Button>
  );
}
