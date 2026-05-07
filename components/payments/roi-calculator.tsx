"use client";

import { useState } from "react";
import { Calculator, TrendingUp } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { formatCurrency } from "@/lib/utils/format";

type RoiScenario = {
  cost_inr: number;
  expected_reach: number;
  expected_engagement: number;
  expected_clicks: number;
  expected_conversions: number;
  expected_revenue_inr: number;
  roi_multiplier: number;
  net_inr: number;
};

type RoiProjection = {
  conservative: RoiScenario;
  expected: RoiScenario;
  optimistic: RoiScenario;
  inputs_used: {
    platform: string;
    niche: string;
    tier: string;
    deliverable_type: string;
    deliverable_count: number;
    follower_count: number;
    rate_source: string;
    engagement_source: string;
    conversion_source: string;
  };
  caveats: string[];
  matched_cells: {
    rate?: { p25: number; median: number; p75: number; observation_count: number; internal_deal_count: number };
    engagement?: { p25_pct: number; median_pct: number; p75_pct: number; observation_count: number };
    conversion?: { ctr_pct: number; conversion_rate_pct: number; aov_inr: number; observation_count: number };
  };
};

const PLATFORMS = ["Instagram", "YouTube", "Twitter", "LinkedIn", "TikTok", "Regional"];
const DELIVERABLES = ["reel", "story", "static_post", "long_form", "short", "thread", "podcast"];
const NICHES = ["fashion", "beauty", "food", "tech", "fitness", "finance", "gaming", "travel", "parenting", "comedy", "education", "lifestyle"];

export function RoiCalculator() {
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [projection, setProjection] = useState<RoiProjection | null>(null);
  const [error, setError] = useState("");

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("loading");
    setError("");

    const formData = new FormData(event.currentTarget);
    const payload = {
      platform: formData.get("platform"),
      niche: formData.get("niche"),
      deliverable_type: formData.get("deliverable_type"),
      follower_count: Number(formData.get("follower_count") ?? 0),
      deliverable_count: Number(formData.get("deliverable_count") ?? 1),
      fixed_cost_inr: formData.get("fixed_cost_inr") ? Number(formData.get("fixed_cost_inr")) : undefined,
      brand_aov_inr: formData.get("brand_aov_inr") ? Number(formData.get("brand_aov_inr")) : undefined
    };

    const response = await fetch("/api/ai/roi-calc", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      setStatus("error");
      setError(body.error ?? "Could not project ROI.");
      return;
    }

    setProjection(await response.json());
    setStatus("idle");
  }

  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>Campaign ROI Projection</CardTitle>
          <p className="mt-1 text-sm text-muted-foreground">Three-scenario revenue forecast grounded in Agently rate, engagement, and conversion observations.</p>
        </div>
        <Badge tone="blue">brand-side</Badge>
      </CardHeader>

      <form className="grid gap-3 md:grid-cols-3" onSubmit={onSubmit}>
        <Select name="platform" label="Platform" options={PLATFORMS} />
        <Select name="niche" label="Niche" options={NICHES} />
        <Select name="deliverable_type" label="Deliverable" options={DELIVERABLES} defaultValue="reel" />
        <Input name="follower_count" placeholder="Creator follower count" type="number" required />
        <Input name="deliverable_count" placeholder="How many deliverables" type="number" defaultValue="1" min="1" />
        <Input name="brand_aov_inr" placeholder="Your AOV in INR (optional)" type="number" />
        <Input className="md:col-span-3" name="fixed_cost_inr" placeholder="Fixed offer in INR (optional - leave blank to estimate from market)" type="number" />
        <Button className="md:col-span-3" disabled={status === "loading"}>
          <Calculator className="h-4 w-4" />
          {status === "loading" ? "Projecting..." : "Project ROI"}
        </Button>
        {error ? <p className="md:col-span-3 text-sm text-red-600 dark:text-red-400">{error}</p> : null}
      </form>

      {projection ? (
        <div className="mt-5 space-y-4">
          <div className="grid gap-3 md:grid-cols-3">
            <ScenarioCard label="Conservative (p25)" tone="amber" scenario={projection.conservative} />
            <ScenarioCard label="Expected (median)" tone="blue" scenario={projection.expected} highlight />
            <ScenarioCard label="Optimistic (p75)" tone="green" scenario={projection.optimistic} />
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            {projection.matched_cells.rate ? (
              <MatchedCellCard
                title="Rate match"
                primary={`Median ₹${projection.matched_cells.rate.median.toLocaleString("en-IN")}`}
                secondary={`p25 ₹${projection.matched_cells.rate.p25.toLocaleString("en-IN")} – p75 ₹${projection.matched_cells.rate.p75.toLocaleString("en-IN")}`}
                detail={`${projection.matched_cells.rate.observation_count} observations${projection.matched_cells.rate.internal_deal_count > 0 ? ` · ${projection.matched_cells.rate.internal_deal_count} closed Agently deals` : ""}`}
                source={projection.inputs_used.rate_source}
              />
            ) : null}
            {projection.matched_cells.engagement ? (
              <MatchedCellCard
                title="Engagement match"
                primary={`${projection.matched_cells.engagement.median_pct}% ER`}
                secondary={`p25 ${projection.matched_cells.engagement.p25_pct}% – p75 ${projection.matched_cells.engagement.p75_pct}%`}
                detail={`${projection.matched_cells.engagement.observation_count} observations`}
                source={projection.inputs_used.engagement_source}
              />
            ) : null}
            {projection.matched_cells.conversion ? (
              <MatchedCellCard
                title="Conversion funnel"
                primary={`CTR ${projection.matched_cells.conversion.ctr_pct}% · CR ${projection.matched_cells.conversion.conversion_rate_pct}%`}
                secondary={`AOV ₹${projection.matched_cells.conversion.aov_inr.toLocaleString("en-IN")}`}
                detail={`${projection.matched_cells.conversion.observation_count} observations`}
                source={projection.inputs_used.conversion_source}
              />
            ) : null}
          </div>

          {projection.caveats.length ? (
            <div className="rounded-md border border-amber-200 bg-amber-50 p-3 dark:border-amber-900/50 dark:bg-amber-950/30">
              <p className="text-xs font-semibold uppercase text-amber-800 dark:text-amber-300">Caveats</p>
              <ul className="mt-2 space-y-1.5">
                {projection.caveats.map((c, i) => (
                  <li key={i} className="text-sm leading-5 text-amber-900 dark:text-amber-200">• {c}</li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      ) : (
        <div className="mt-5 rounded-md border bg-white p-4 text-sm leading-6 text-muted-foreground dark:border-white/8 dark:bg-card">
          Enter creator details and run the projection. Three scenarios will appear using p25/median/p75 of matching benchmarks.
        </div>
      )}
    </Card>
  );
}

function ScenarioCard({ label, scenario, tone, highlight = false }: { label: string; scenario: RoiScenario; tone: "amber" | "blue" | "green"; highlight?: boolean }) {
  const toneClasses = tone === "amber"
    ? "border-amber-200 bg-amber-50/60 dark:border-amber-900/50 dark:bg-amber-950/30"
    : tone === "green"
    ? "border-emerald-200 bg-emerald-50/60 dark:border-emerald-900/50 dark:bg-emerald-950/30"
    : "border-sky-200 bg-sky-50/60 dark:border-sky-900/50 dark:bg-sky-950/30";
  return (
    <div className={`rounded-md border p-3 ${toneClasses} ${highlight ? "ring-2 ring-primary/20" : ""}`}>
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="text-xs font-semibold uppercase">{label}</p>
        <Badge tone={tone}>{scenario.roi_multiplier}x ROI</Badge>
      </div>
      <p className="text-2xl font-bold">{formatCurrency(scenario.expected_revenue_inr * 100, "inr")}</p>
      <p className="mt-1 text-xs text-muted-foreground">expected revenue</p>
      <div className="mt-3 grid gap-1 text-xs leading-5">
        <Row label="Cost" value={formatCurrency(scenario.cost_inr * 100, "inr")} />
        <Row label="Net" value={formatCurrency(scenario.net_inr * 100, "inr")} accent={scenario.net_inr > 0 ? "positive" : "negative"} />
        <Row label="Reach" value={scenario.expected_reach.toLocaleString("en-IN")} />
        <Row label="Engagement" value={scenario.expected_engagement.toLocaleString("en-IN")} />
        <Row label="Clicks" value={scenario.expected_clicks.toLocaleString("en-IN")} />
        <Row label="Conversions" value={scenario.expected_conversions.toLocaleString("en-IN")} />
      </div>
    </div>
  );
}

function Row({ label, value, accent }: { label: string; value: string; accent?: "positive" | "negative" }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-muted-foreground">{label}</span>
      <span className={`font-semibold ${accent === "positive" ? "text-emerald-700 dark:text-emerald-400" : accent === "negative" ? "text-red-600 dark:text-red-400" : ""}`}>{value}</span>
    </div>
  );
}

function MatchedCellCard({ title, primary, secondary, detail, source }: { title: string; primary: string; secondary: string; detail: string; source: string }) {
  return (
    <div className="rounded-md border bg-white p-3 dark:border-white/8 dark:bg-card">
      <div className="mb-1 flex items-center justify-between gap-2">
        <p className="text-xs font-semibold uppercase text-muted-foreground">{title}</p>
        <Badge tone={source === "internal_deal" ? "green" : source === "observation_aggregate" ? "blue" : "neutral"}>
          {source.replaceAll("_", " ")}
        </Badge>
      </div>
      <p className="text-sm font-semibold"><TrendingUp className="mr-1 inline h-4 w-4 text-primary" />{primary}</p>
      <p className="mt-1 text-xs text-muted-foreground">{secondary}</p>
      <p className="mt-1 text-xs text-muted-foreground">{detail}</p>
    </div>
  );
}

function Select({ name, label, options, defaultValue }: { name: string; label: string; options: string[]; defaultValue?: string }) {
  return (
    <label className="block text-sm">
      <span className="mb-1 block text-xs font-semibold uppercase text-muted-foreground">{label}</span>
      <select
        name={name}
        defaultValue={defaultValue ?? options[0]}
        className="h-10 w-full rounded-md border bg-white px-3 text-sm dark:border-white/10 dark:bg-card dark:text-foreground"
      >
        {options.map((opt) => <option key={opt} value={opt}>{opt}</option>)}
      </select>
    </label>
  );
}
