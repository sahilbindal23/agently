"use client";

import { useState } from "react";
import { Bot } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { formatCurrency } from "@/lib/utils/format";

type ValuationResult = {
  low_estimate_cents: number;
  base_estimate_cents: number;
  high_estimate_cents: number;
  currency: string;
  confidence_score: number;
  package_recommendation: string;
  negotiation_floor_cents: number;
  charge_extra_for: string[];
  adjustments: string[];
  rationale: string;
  source: string;
  blended_low_estimate_cents?: number;
  blended_base_estimate_cents?: number;
  blended_high_estimate_cents?: number;
  benchmark_confidence_score?: number;
  benchmark_match_count?: number;
  benchmark_summary?: string;
  matched_benchmarks?: Array<{
    id: string;
    platform: string;
    niche: string;
    deliverable_type: string;
    city: string;
    low_cents: number;
    base_cents: number;
    high_cents: number;
    confidence_score: number;
    source_label: string | null;
  }>;
};

export function ValuationEngine() {
  const [result, setResult] = useState<ValuationResult | null>(null);
  const [targetInr, setTargetInr] = useState(0);
  const [currentInr, setCurrentInr] = useState(0);
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [error, setError] = useState("");

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("loading");
    setError("");

    const formData = new FormData(event.currentTarget);
    const payload = {
      ...Object.fromEntries(formData.entries()),
      avg_views: Number(formData.get("avg_views") ?? 0),
      followers: Number(formData.get("followers") ?? 0),
      engagement_rate: Number(formData.get("engagement_rate") ?? 0),
      india_audience_percent: Number(formData.get("india_audience_percent") ?? 0),
      bangalore_fit: Number(formData.get("bangalore_fit") ?? 0),
      deliverable_count: Number(formData.get("deliverable_count") ?? 1),
      usage_rights_days: Number(formData.get("usage_rights_days") ?? 30),
      exclusivity_days: Number(formData.get("exclusivity_days") ?? 0),
      revisions: Number(formData.get("revisions") ?? 1),
      turnaround_days: Number(formData.get("turnaround_days") ?? 14),
      whitelisting: formData.get("whitelisting") === "on",
      paid_usage: formData.get("paid_usage") === "on"
    };
    setTargetInr(Number(formData.get("target_sponsorship_inr") ?? 0));
    setCurrentInr(Number(formData.get("current_sponsorship_inr") ?? 0));

    const response = await fetch("/api/ai/value-creator", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      setStatus("error");
      setError("Could not estimate sponsorship value.");
      return;
    }

    setResult(await response.json());
    setStatus("idle");
  }

  return (
    <section className="mt-5 grid gap-5 xl:grid-cols-[0.9fr_1.1fr]">
      <Card>
        <CardHeader>
          <div>
            <CardTitle>Sponsor Growth Calculator</CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">
              Estimate India-first sponsorship bands and use the target fields to understand what metrics need to improve if you want to earn more than your current deal range.
            </p>
          </div>
          <Badge tone="green">INR rules model</Badge>
        </CardHeader>
        <form className="grid gap-3 md:grid-cols-2" onSubmit={onSubmit}>
          <Input name="current_sponsorship_inr" placeholder="Current typical sponsorship INR" type="number" />
          <Input name="target_sponsorship_inr" placeholder="Target sponsorship INR" type="number" />
          <Input name="platform" placeholder="Platform" />
          <Input name="deliverable_type" placeholder="Deliverable type" />
          <Input name="avg_views" placeholder="Average views" type="number" />
          <Input name="followers" placeholder="Followers" type="number" />
          <Input name="engagement_rate" placeholder="Engagement rate %" type="number" step="0.1" />
          <Input name="india_audience_percent" placeholder="India audience %" type="number" />
          <Input name="bangalore_fit" placeholder="Bangalore fit /100" type="number" />
          <Input name="niche" placeholder="Niche/category" />
          <Input name="deliverable_count" placeholder="Deliverable count" type="number" />
          <Input name="usage_rights_days" placeholder="Usage rights days" type="number" />
          <Input name="exclusivity_days" placeholder="Exclusivity days" type="number" />
          <Input name="revisions" placeholder="Revision rounds" type="number" />
          <Input name="turnaround_days" placeholder="Turnaround days" type="number" />
          <label className="flex h-10 items-center gap-2 rounded-md border bg-white px-3 text-sm dark:border-white/10 dark:bg-card">
            <input name="paid_usage" type="checkbox" />
            Paid usage
          </label>
          <label className="flex h-10 items-center gap-2 rounded-md border bg-white px-3 text-sm dark:border-white/10 dark:bg-card">
            <input name="whitelisting" type="checkbox" />
            Whitelisting
          </label>
          <Button className="md:col-span-2" disabled={status === "loading"}>
            <Bot className="h-4 w-4" />
            {status === "loading" ? "Estimating..." : "Estimate sponsorship value"}
          </Button>
          {error ? <p className="md:col-span-2 text-sm text-red-600">{error}</p> : null}
        </form>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Recommended Rate Band</CardTitle>
          <Badge tone="blue">{result?.source ?? "ready"}</Badge>
        </CardHeader>
        {result ? (
          <div className="space-y-4">
            <div className="grid gap-3 md:grid-cols-3">
              <Rate label="Low" value={result.low_estimate_cents} currency={result.currency} />
              <Rate label="Base" value={result.base_estimate_cents} currency={result.currency} />
              <Rate label="High" value={result.high_estimate_cents} currency={result.currency} />
            </div>
            {result.benchmark_match_count ? (
              <div className="rounded-md border bg-emerald-50 p-4">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-xs font-semibold uppercase text-emerald-800">Benchmark-calibrated range</p>
                    <p className="mt-1 text-sm leading-5 text-emerald-900">{result.benchmark_summary}</p>
                  </div>
                  <Badge tone="green">{Math.round(Number(result.benchmark_confidence_score ?? 0) * 100)}% confidence</Badge>
                </div>
                <div className="grid gap-3 md:grid-cols-3">
                  <Rate label="Blended low" value={result.blended_low_estimate_cents ?? result.low_estimate_cents} currency={result.currency} />
                  <Rate label="Blended base" value={result.blended_base_estimate_cents ?? result.base_estimate_cents} currency={result.currency} />
                  <Rate label="Blended high" value={result.blended_high_estimate_cents ?? result.high_estimate_cents} currency={result.currency} />
                </div>
                <div className="mt-3 grid gap-2">
                  {(result.matched_benchmarks ?? []).slice(0, 3).map((benchmark) => (
                    <p className="rounded-md bg-white p-2 text-xs leading-5 text-emerald-950 dark:bg-card dark:text-emerald-100" key={benchmark.id}>
                      {benchmark.platform} / {benchmark.niche} / {benchmark.deliverable_type} in {benchmark.city}: {formatCurrency(benchmark.low_cents, "inr")} - {formatCurrency(benchmark.high_cents, "inr")} ({Math.round(benchmark.confidence_score * 100)}% confidence)
                    </p>
                  ))}
                </div>
              </div>
            ) : null}
            <div className="rounded-md border bg-white p-4 dark:border-white/8 dark:bg-card">
              <p className="text-sm text-muted-foreground">Negotiation floor</p>
              <p className="mt-1 text-xl font-bold">{formatCurrency(result.negotiation_floor_cents, result.currency)}</p>
            </div>
            {targetInr > 0 ? <TargetGap targetInr={targetInr} currentInr={currentInr} baseCents={result.base_estimate_cents} /> : null}
            <p className="text-sm leading-6 text-muted-foreground">{result.rationale}</p>
            <div className="rounded-md bg-muted p-3">
              <p className="text-xs font-semibold uppercase text-muted-foreground">Package</p>
              <p className="mt-1 text-sm leading-5">{result.package_recommendation}</p>
            </div>
            <List title="Adjustments" items={result.adjustments} />
            <List title="Charge Extra For" items={result.charge_extra_for} />
          </div>
        ) : (
          <div className="rounded-md border bg-white p-4 dark:border-white/8 dark:bg-card text-sm leading-6 text-muted-foreground">
            Run an estimate to see INR pricing bands, package recommendation, negotiation floor, pricing caveats, and the metric gap to reach your target sponsorship amount.
          </div>
        )}
      </Card>
    </section>
  );
}

function TargetGap({ targetInr, currentInr, baseCents }: { targetInr: number; currentInr: number; baseCents: number }) {
  const baseInr = Math.round(baseCents / 100);
  const multiplier = baseInr > 0 ? targetInr / baseInr : 0;
  const currentGap = currentInr > 0 ? targetInr - currentInr : 0;
  return (
    <div className="rounded-md border bg-sky-50 p-4">
      <p className="text-xs font-semibold uppercase text-sky-800">Target sponsorship path</p>
      <p className="mt-2 text-sm leading-6 text-sky-950">
        Target: <span className="font-semibold">{formatCurrency(targetInr * 100, "inr")}</span>. Current estimate: <span className="font-semibold">{formatCurrency(baseCents, "inr")}</span>.
        {multiplier > 1.05 ? ` You likely need about ${multiplier.toFixed(1)}x stronger pricing power through higher average views, stronger India/Bangalore audience proof, better engagement, premium category fit, or more valuable deliverables/usage terms.` : " Your current estimate is already close to or above that target, so focus on protecting usage rights and payment terms."}
      </p>
      {currentGap > 0 ? <p className="mt-2 text-sm text-sky-900">Gap from your current typical deal: {formatCurrency(currentGap * 100, "inr")}.</p> : null}
    </div>
  );
}

function Rate({ label, value, currency }: { label: string; value: number; currency: string }) {
  return (
    <div className="rounded-md border bg-white p-4 dark:border-white/8 dark:bg-card">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-1 text-xl font-bold">{formatCurrency(value, currency)}</p>
    </div>
  );
}

function List({ title, items }: { title: string; items: string[] }) {
  if (!items.length) return null;
  return (
    <div>
      <p className="mb-2 text-sm font-semibold">{title}</p>
      <div className="space-y-2">
        {items.map((item) => (
          <p key={item} className="rounded-md border bg-white p-3 dark:border-white/8 dark:bg-card text-sm leading-5 text-muted-foreground">{item}</p>
        ))}
      </div>
    </div>
  );
}
