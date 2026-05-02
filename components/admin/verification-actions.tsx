"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { CheckCircle2, Clock3, ShieldCheck, Star, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

type EntityType = "creator" | "freelancer" | "brand";
type Status = "reviewing" | "verified" | "rejected";
type Tier = "reviewing" | "profile" | "social" | "performance" | "rejected";

const checksByType: Record<EntityType, { key: string; label: string }[]> = {
  creator: [
    { key: "profile_complete", label: "Profile complete" },
    { key: "social_links_checked", label: "Social links checked" },
    { key: "audience_evidence_checked", label: "Audience evidence checked" },
    { key: "completed_agently_deal", label: "Completed Agently deal" }
  ],
  freelancer: [
    { key: "profile_complete", label: "Profile complete" },
    { key: "portfolio_reviewed", label: "Portfolio reviewed" },
    { key: "rates_clear", label: "Rates clear" },
    { key: "completed_agently_project", label: "Completed Agently project" }
  ],
  brand: [
    { key: "profile_complete", label: "Profile complete" },
    { key: "website_checked", label: "Website checked" },
    { key: "contact_domain_checked", label: "Contact/domain checked" },
    { key: "completed_agently_campaign", label: "Completed Agently campaign" }
  ]
};

export function VerificationActions({
  entityId,
  entityType,
  initialChecks
}: {
  entityId: string;
  entityType: EntityType;
  initialChecks?: Record<string, unknown>;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState<Tier | null>(null);
  const [error, setError] = useState("");
  const [checks, setChecks] = useState<Record<string, boolean>>(() => {
    return checksByType[entityType].reduce<Record<string, boolean>>((acc, item) => {
      acc[item.key] = Boolean(initialChecks?.[item.key]);
      return acc;
    }, {});
  });
  const [notes, setNotes] = useState("");

  async function update(tier: Tier) {
    setLoading(tier);
    setError("");
    const status: Status = tier === "rejected" ? "rejected" : tier === "reviewing" ? "reviewing" : "verified";
    const response = await fetch("/api/admin/verification", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        entity_id: entityId,
        entity_type: entityType,
        status,
        tier,
        checks,
        notes: notes || noteForTier(tier)
      })
    });

    const payload = await response.json();
    setLoading(null);

    if (!response.ok) {
      setError(payload.error ?? "Could not update verification.");
      return;
    }

    router.refresh();
  }

  return (
    <div className="min-w-[360px] space-y-3">
      <div className="grid gap-2 sm:grid-cols-2">
        {checksByType[entityType].map((item) => (
          <label key={item.key} className="flex items-center gap-2 rounded-md border bg-white px-2.5 py-2 text-xs">
            <input
              checked={checks[item.key] ?? false}
              className="h-4 w-4"
              type="checkbox"
              onChange={(event) => setChecks((current) => ({ ...current, [item.key]: event.target.checked }))}
            />
            {item.label}
          </label>
        ))}
      </div>
      <input
        className="h-9 w-full rounded-md border px-3 text-xs"
        placeholder="Optional verification note"
        value={notes}
        onChange={(event) => setNotes(event.target.value)}
      />
      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" variant="secondary" disabled={Boolean(loading)} onClick={() => update("reviewing")}>
          <Clock3 className="h-4 w-4" />
          Review
        </Button>
        <Button size="sm" variant="secondary" disabled={Boolean(loading)} onClick={() => update("profile")}>
          <CheckCircle2 className="h-4 w-4" />
          Profile
        </Button>
        <Button size="sm" disabled={Boolean(loading)} onClick={() => update("social")}>
          <ShieldCheck className="h-4 w-4" />
          Social
        </Button>
        <Button size="sm" disabled={Boolean(loading)} onClick={() => update("performance")}>
          <Star className="h-4 w-4" />
          Performance
        </Button>
        <Button size="sm" variant="danger" disabled={Boolean(loading)} onClick={() => update("rejected")}>
          <XCircle className="h-4 w-4" />
          Reject
        </Button>
      </div>
      {error ? <p className="basis-full text-xs text-destructive">{error}</p> : null}
    </div>
  );
}

function noteForTier(tier: Tier) {
  if (tier === "profile") return "Profile reviewed by Agently admin.";
  if (tier === "social") return "Social, portfolio, or brand web presence checked by Agently admin.";
  if (tier === "performance") return "Performance verified through Agently workflow history.";
  if (tier === "reviewing") return "Moved into verification review.";
  return "Verification rejected pending corrections.";
}
