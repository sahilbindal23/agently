"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Bot, RefreshCw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";

type AutomationAction = {
  entityId: string;
  entityType: string;
  from?: string | null;
  reason: string;
  title: string;
  to?: string | null;
};

type AutomationResult = {
  actions: AutomationAction[];
  checked: {
    deals: number;
    deliverables: number;
    payments: number;
    projects: number;
  };
};

export function AutomationRunner() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<AutomationResult | null>(null);
  const [error, setError] = useState("");

  async function runAutomations() {
    setBusy(true);
    setError("");
    setResult(null);
    const response = await fetch("/api/workflow/automations/run", { method: "POST" });
    const data = await response.json().catch(() => ({}));
    setBusy(false);
    if (!response.ok) {
      setError(data.error ?? "Could not run workflow automations.");
      return;
    }
    setResult(data);
    router.refresh();
  }

  return (
    <Card className="mb-5 border-primary/20 bg-primary/5 dark:border-primary/30 dark:bg-primary/10">
      <CardHeader>
        <div>
          <CardTitle>Automation Runner</CardTitle>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">
            Sweeps accepted offers, payment rows, deliverables, and payout readiness. It only applies safe state transitions; real payout release still waits for a payout rail.
          </p>
        </div>
        <Button disabled={busy} onClick={runAutomations} type="button" variant="secondary">
          {busy ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Bot className="h-4 w-4" />}
          Run sweep
        </Button>
      </CardHeader>
      {error ? <p className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-950/40 dark:text-red-300">{error}</p> : null}
      {result ? (
        <div className="space-y-3">
          <div className="flex flex-wrap gap-2">
            <Badge tone={result.actions.length ? "amber" : "green"}>{result.actions.length} changes</Badge>
            <Badge tone="neutral">{result.checked.deals} deals checked</Badge>
            <Badge tone="neutral">{result.checked.projects} projects checked</Badge>
            <Badge tone="neutral">{result.checked.payments} payments checked</Badge>
            <Badge tone="neutral">{result.checked.deliverables} deliverables checked</Badge>
          </div>
          {result.actions.length ? (
            <div className="grid gap-2 md:grid-cols-2">
              {result.actions.slice(0, 6).map((action) => (
                <div className="rounded-md border bg-card p-3 dark:border-white/10" key={`${action.entityType}-${action.entityId}-${action.to}`}>
                  <p className="text-sm font-semibold">{action.title}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{action.entityType}: {action.from || "new"} → {action.to || "tracked"}</p>
                  <p className="mt-2 text-sm leading-5">{action.reason}</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="rounded-md border bg-card p-3 text-sm text-muted-foreground dark:border-white/10">
              Everything is already aligned. No safe workflow transitions were needed.
            </p>
          )}
        </div>
      ) : null}
    </Card>
  );
}
