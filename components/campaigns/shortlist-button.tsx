"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { BookmarkPlus } from "lucide-react";
import { Button } from "@/components/ui/button";

export function ShortlistButton({
  campaignId,
  entityType,
  entityId,
  fitScore,
  reason
}: {
  campaignId: string;
  entityType: "creator" | "freelancer";
  entityId: string;
  fitScore: number;
  reason: string;
}) {
  const router = useRouter();
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");

  async function shortlist() {
    setStatus("saving");
    const response = await fetch("/api/campaigns/shortlist", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ campaign_id: campaignId, entity_type: entityType, entity_id: entityId, fit_score: fitScore, reason })
    });

    if (!response.ok) {
      setStatus("error");
      return;
    }

    setStatus("saved");
    router.refresh();
  }

  return (
    <Button disabled={status === "saving" || status === "saved"} onClick={shortlist} size="sm" type="button" variant="secondary">
      <BookmarkPlus className="h-4 w-4" />
      {status === "saved" ? "Shortlisted" : status === "saving" ? "Saving..." : "Shortlist"}
    </Button>
  );
}
