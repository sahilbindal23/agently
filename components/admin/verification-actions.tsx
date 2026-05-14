"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Clock3, ShieldCheck, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

// 2-tier verification model: verified or rejected (with "reviewing" as a
// transient state if admin wants to mark a profile as in-progress).
//
// What used to be Profile / Social / Performance got collapsed in commit
// 382714e — see lib/campaigns/recommendations.isVerifiedTier. Legacy DB
// values still count as verified, so no backfill needed.

type EntityType = "creator" | "freelancer" | "brand";
type Decision = "verified" | "reviewing" | "rejected";

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
  const [loading, setLoading] = useState<Decision | null>(null);
  const [error, setError] = useState("");
  const [checks, setChecks] = useState<Record<string, boolean>>(() => {
    return checksByType[entityType].reduce<Record<string, boolean>>((acc, item) => {
      acc[item.key] = Boolean(initialChecks?.[item.key]);
      return acc;
    }, {});
  });
  const [notes, setNotes] = useState("");

  async function update(decision: Decision) {
    setLoading(decision);
    setError("");
    // The API still accepts the legacy tier values for backwards
    // compatibility. We send "verified" / "reviewing" / "rejected" — the
    // backend treats anything non-unverified/non-rejected as verified.
    const response = await fetch("/api/admin/verification", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        entity_id: entityId,
        entity_type: entityType,
        status: decision,
        tier: decision,
        checks,
        notes: notes || noteForDecision(decision)
      })
    });

    const payload = await response.json().catch(() => ({}));
    setLoading(null);

    if (!response.ok) {
      setError(payload.error ?? "Could not update verification.");
      return;
    }

    router.refresh();
  }

  return (
    <div className="min-w-[320px] space-y-3">
      <div className="grid gap-2 sm:grid-cols-2">
        {checksByType[entityType].map((item) => (
          <label key={item.key} className="flex items-center gap-2 rounded-md border bg-white px-2.5 py-2 text-xs dark:border-white/10 dark:bg-card">
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
        className="h-9 w-full rounded-md border px-3 text-xs dark:border-white/10 dark:bg-card"
        placeholder="Optional verification note"
        value={notes}
        onChange={(event) => setNotes(event.target.value)}
      />
      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" disabled={Boolean(loading)} onClick={() => update("verified")}>
          <ShieldCheck className="h-4 w-4" />
          {loading === "verified" ? "Verifying…" : "Verify"}
        </Button>
        <Button size="sm" variant="secondary" disabled={Boolean(loading)} onClick={() => update("reviewing")}>
          <Clock3 className="h-4 w-4" />
          {loading === "reviewing" ? "Saving…" : "Hold for review"}
        </Button>
        <Button size="sm" variant="danger" disabled={Boolean(loading)} onClick={() => update("rejected")}>
          <XCircle className="h-4 w-4" />
          {loading === "rejected" ? "Rejecting…" : "Reject"}
        </Button>
      </div>
      {error ? <p className="text-xs font-medium text-red-600 dark:text-red-400">{error}</p> : null}
    </div>
  );
}

function noteForDecision(decision: Decision) {
  if (decision === "verified") return "Profile verified by Agently admin.";
  if (decision === "reviewing") return "Held for further admin review.";
  return "Verification rejected pending corrections.";
}
