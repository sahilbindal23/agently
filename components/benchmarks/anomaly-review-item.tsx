"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";
import { formatCurrency } from "@/lib/utils/format";

type Anomaly = {
  id: string;
  observation_id: string | null;
  reason: string;
  severity: "low" | "medium" | "high";
  amount_cents: number | null;
  baseline_median_cents: number | null;
  deviation_factor: number | null;
  source_slug: string | null;
  resolved_at: string | null;
  resolution: string | null;
  resolution_note: string | null;
  created_at: string;
  platform: string | null;
  niche: string | null;
  deliverable_type: string | null;
  tier: string | null;
  observed_at: string | null;
};

type Resolution = "confirmed_normal" | "confirmed_outlier" | "rejected" | "manual_override";

const RESOLUTION_LABELS: Record<Resolution, { label: string; description: string }> = {
  confirmed_normal: { label: "Mark normal", description: "Restores observation to active aggregation. Use when the flag was a false positive." },
  confirmed_outlier: { label: "Confirm outlier", description: "Keeps the observation flagged but visible. Excluded from public-source aggregation; still kept for internal-deal audits." },
  rejected: { label: "Reject", description: "Hard-rejects the observation. Removed from aggregation entirely." },
  manual_override: { label: "Manual override", description: "Admin took action elsewhere. Anomaly closed without changing the observation." }
};

export function AnomalyReviewItem({ anomaly, resolvable = false }: { anomaly: Anomaly; resolvable?: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [resolution, setResolution] = useState<Resolution>("confirmed_outlier");
  const [note, setNote] = useState("");
  const [status, setStatus] = useState<"idle" | "saving" | "error">("idle");
  const [message, setMessage] = useState("");

  const tone = anomaly.severity === "high" ? "red" : anomaly.severity === "medium" ? "amber" : "blue";
  const segment = [anomaly.platform, anomaly.niche, anomaly.tier, anomaly.deliverable_type].filter(Boolean).join(" · ");

  async function submit() {
    setStatus("saving");
    setMessage("");
    try {
      const r = await fetch("/api/benchmarks/anomalies", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ anomaly_id: anomaly.id, resolution, resolution_note: note })
      });
      if (!r.ok) {
        const body = await r.json().catch(() => ({}));
        setStatus("error");
        setMessage(body.error ?? "Could not resolve.");
        return;
      }
      setStatus("idle");
      setOpen(false);
      router.refresh();
    } catch {
      setStatus("error");
      setMessage("Network error.");
    }
  }

  return (
    <div className="rounded-md border bg-white p-4 dark:border-white/8 dark:bg-card">
      <div className="mb-2 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-semibold">{segment || "Unknown segment"}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {anomaly.amount_cents != null ? `Amount: ${formatCurrency(anomaly.amount_cents, "inr")}` : "No amount"}
            {anomaly.baseline_median_cents != null ? ` · Baseline median: ${formatCurrency(anomaly.baseline_median_cents, "inr")}` : ""}
            {anomaly.deviation_factor != null ? ` · ${anomaly.deviation_factor.toFixed(1)}σ deviation` : ""}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Source: {anomaly.source_slug ?? "unknown"} · Logged {new Date(anomaly.created_at).toLocaleString()}
          </p>
        </div>
        <Badge tone={tone}>{anomaly.severity}</Badge>
      </div>
      <div className="rounded-md bg-muted p-3 text-sm leading-5 dark:bg-white/4">
        <p className="text-xs font-semibold uppercase text-muted-foreground">Reason</p>
        <p className="mt-1">{anomaly.reason}</p>
      </div>
      {anomaly.resolved_at ? (
        <div className="mt-3 rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm dark:border-emerald-900/50 dark:bg-emerald-950/30">
          <p className="text-xs font-semibold uppercase text-emerald-800 dark:text-emerald-300">
            Resolved · {anomaly.resolution?.replaceAll("_", " ")}
          </p>
          {anomaly.resolution_note ? <p className="mt-1 text-emerald-900 dark:text-emerald-200">{anomaly.resolution_note}</p> : null}
          <p className="mt-1 text-xs text-emerald-700 dark:text-emerald-400">{new Date(anomaly.resolved_at).toLocaleString()}</p>
        </div>
      ) : null}
      {resolvable && !anomaly.resolved_at ? (
        <div className="mt-3">
          {!open ? (
            <Button variant="secondary" type="button" onClick={() => setOpen(true)}>Review</Button>
          ) : (
            <div className="space-y-3 rounded-md border bg-muted p-3 dark:border-white/8 dark:bg-white/4">
              <div className="grid gap-2 sm:grid-cols-2">
                {(Object.keys(RESOLUTION_LABELS) as Resolution[]).map((r) => (
                  <label
                    key={r}
                    className={`flex cursor-pointer flex-col gap-1 rounded-md border p-3 text-sm transition ${resolution === r ? "border-primary bg-white dark:bg-card" : "border-transparent bg-white/60 dark:bg-card/60"}`}
                  >
                    <span className="flex items-center gap-2 font-semibold">
                      <input type="radio" name={`resolution-${anomaly.id}`} checked={resolution === r} onChange={() => setResolution(r)} />
                      {RESOLUTION_LABELS[r].label}
                    </span>
                    <span className="text-xs leading-5 text-muted-foreground">{RESOLUTION_LABELS[r].description}</span>
                  </label>
                ))}
              </div>
              <Textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Resolution note (required, min 3 chars)" />
              <div className="flex flex-wrap gap-2">
                <Button type="button" disabled={status === "saving"} onClick={submit}>
                  {status === "saving" ? "Saving..." : "Submit decision"}
                </Button>
                <Button type="button" variant="secondary" onClick={() => setOpen(false)}>Cancel</Button>
              </div>
              {message ? <p className="text-sm text-red-600 dark:text-red-400">{message}</p> : null}
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}
