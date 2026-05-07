"use client";

import { useState } from "react";
import { Handshake, MessageCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, Textarea } from "@/components/ui/input";
import { formatCurrency } from "@/lib/utils/format";

type BenchmarkContext = {
  extracted: { platform: string; deliverable: string; niche: string };
  tier: string;
  rate_matches: Array<{
    platform: string;
    niche: string;
    deliverable_type: string;
    tier: string | null;
    p25_inr: number;
    median_inr: number;
    p75_inr: number;
    observation_count: number;
    internal_deal_count: number;
  }>;
  offer_vs_market: {
    offer_inr: number;
    market_median_inr: number;
    pct_of_market: number;
    classification: "below_floor" | "below_median" | "at_market" | "above_market" | "no_data";
  } | null;
  summary: string;
};

type NegotiationResult = {
  recommended_counter_cents: number;
  minimum_floor_cents: number;
  terms_to_push_back_on: string[];
  acceptance_likelihood: number;
  counter_rationale?: string;
  tradeoff_notes?: string;
  message: string;
  benchmark_basis?: string;
  benchmark_context?: BenchmarkContext | null;
  source?: string;
};

type AskResult = {
  answer: string;
  suggested_alternatives: string[];
  market_context?: string;
  confidence: number;
  followup_questions?: string[];
  benchmark_context?: BenchmarkContext | null;
  source?: string;
};

type NegotiationPrefill = {
  offer_amount_inr?: string;
  brand?: string;
  deliverables?: string;
  contract_terms?: string;
  valuation_context?: string;
  follower_count?: string;
};

export function NegotiationCopilot({ role, initialValues }: { role: "admin" | "creator" | "freelancer"; initialValues?: NegotiationPrefill }) {
  const [mode, setMode] = useState<"counter" | "ask">("counter");
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [counterResult, setCounterResult] = useState<NegotiationResult | null>(null);
  const [askResult, setAskResult] = useState<AskResult | null>(null);
  const [error, setError] = useState("");

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("loading");
    setError("");

    const formData = new FormData(event.currentTarget);
    const offerAmountInr = Number(formData.get("offer_amount_inr") ?? 0);
    const followerCount = Number(formData.get("follower_count") ?? 0);

    const sharedPayload = {
      talent_type: role === "freelancer" ? "freelancer" : "creator",
      offer_amount_cents: Math.round(offerAmountInr * 100),
      deliverables: formData.get("deliverables") ?? "",
      contract_terms: formData.get("contract_terms") ?? "",
      brand: formData.get("brand") ?? "",
      follower_count: followerCount > 0 ? followerCount : undefined
    };

    const payload = mode === "counter"
      ? {
          mode: "counter" as const,
          ...sharedPayload,
          valuation_context: formData.get("valuation_context") ?? ""
        }
      : {
          mode: "ask" as const,
          ...sharedPayload,
          question: formData.get("question") ?? ""
        };

    const response = await fetch("/api/ai/negotiate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      setStatus("error");
      setError("Could not generate guidance.");
      return;
    }

    const data = await response.json();
    if (mode === "counter") setCounterResult(data);
    else setAskResult(data);
    setStatus("idle");
  }

  return (
    <section className="mt-5 grid gap-5 xl:grid-cols-[0.9fr_1.1fr]" id="negotiation">
      <Card>
        <CardHeader>
          <div>
            <CardTitle>Talent Negotiation Copilot</CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">India-market grounded counter offers and deal-structure Q&A. Anchored on Agently observations.</p>
          </div>
          <Badge tone="blue">talent-side</Badge>
        </CardHeader>

        <div className="mb-4 grid grid-cols-2 rounded-md border bg-white p-1 dark:border-white/8 dark:bg-card">
          <button
            type="button"
            onClick={() => setMode("counter")}
            className={`rounded px-3 py-2 text-sm font-medium transition ${mode === "counter" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
          >
            <Handshake className="mr-1 inline h-4 w-4" />
            Counter offer
          </button>
          <button
            type="button"
            onClick={() => setMode("ask")}
            className={`rounded px-3 py-2 text-sm font-medium transition ${mode === "ask" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
          >
            <MessageCircle className="mr-1 inline h-4 w-4" />
            Ask a question
          </button>
        </div>

        <form className="grid gap-3 md:grid-cols-2" onSubmit={onSubmit}>
          <Input defaultValue={initialValues?.offer_amount_inr ?? ""} name="offer_amount_inr" placeholder="Offer amount in INR" type="number" required={mode === "counter"} />
          <Input defaultValue={initialValues?.brand ?? ""} name="brand" placeholder="Brand name (optional)" />
          <Input defaultValue={initialValues?.follower_count ?? ""} name="follower_count" placeholder="Your follower count (helps tier match)" type="number" />
          <Textarea className="md:col-span-2" defaultValue={initialValues?.deliverables ?? ""} name="deliverables" placeholder="Deliverables, e.g. '2 Instagram reels and 3 stories for tech launch'" required={mode === "counter"} />
          <Textarea className="md:col-span-2" defaultValue={initialValues?.contract_terms ?? ""} name="contract_terms" placeholder="Contract terms or concerns (usage, payment timing, revisions, exclusivity)" />
          {mode === "counter" ? (
            <Textarea className="md:col-span-2" defaultValue={initialValues?.valuation_context ?? ""} name="valuation_context" placeholder="Your rate context, audience strength, past deal range, or minimum acceptable rate" />
          ) : (
            <Textarea className="md:col-span-2" name="question" placeholder="Ask anything: 'Should I do 2 reels or 3 at this price?', 'Is INR 50k fair for a tech micro?', 'How do I push back on perpetual usage?'" required />
          )}
          <Button className="md:col-span-2" disabled={status === "loading"}>
            {mode === "counter" ? <Handshake className="h-4 w-4" /> : <MessageCircle className="h-4 w-4" />}
            {status === "loading" ? "Generating..." : mode === "counter" ? "Generate counter" : "Ask copilot"}
          </Button>
          {error ? <p className="md:col-span-2 text-sm text-red-600 dark:text-red-400">{error}</p> : null}
        </form>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{mode === "counter" ? "Recommended Position" : "Copilot Answer"}</CardTitle>
          <Badge tone="green">{(mode === "counter" ? counterResult : askResult)?.source ?? "ready"}</Badge>
        </CardHeader>
        {mode === "counter" && counterResult ? (
          <CounterView result={counterResult} />
        ) : mode === "ask" && askResult ? (
          <AskView result={askResult} />
        ) : (
          <div className="rounded-md border bg-white p-4 dark:border-white/8 dark:bg-card text-sm leading-6 text-muted-foreground">
            {mode === "counter"
              ? "Add the offer and terms to generate a benchmark-anchored counter position."
              : "Ask anything about deal structure, deliverable mix, or pricing fairness. The copilot uses Agently market data."}
          </div>
        )}
      </Card>
    </section>
  );
}

function CounterView({ result }: { result: NegotiationResult }) {
  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-3">
        <Metric label="Counter" value={formatCurrency(result.recommended_counter_cents, "inr")} />
        <Metric label="Floor" value={formatCurrency(result.minimum_floor_cents, "inr")} />
        <Metric label="Likelihood" value={`${Math.round(result.acceptance_likelihood * 100)}%`} />
      </div>
      {result.benchmark_context ? <BenchmarkContextPanel context={result.benchmark_context} /> : null}
      <div className="rounded-md border bg-white p-3 dark:border-white/8 dark:bg-card">
        <p className="text-xs font-semibold uppercase text-muted-foreground">Push back on</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {(result.terms_to_push_back_on ?? []).map((term) => <Badge key={term} tone="amber">{term}</Badge>)}
        </div>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        <Explanation title="Why this counter is stronger" copy={result.counter_rationale ?? "The counter better accounts for scope, usage, revision time, and payment risk."} />
        <Explanation title="What could make it harder" copy={result.tradeoff_notes ?? "A higher counter can reduce acceptance if the brand budget is fixed."} />
      </div>
      {result.benchmark_basis ? (
        <div className="rounded-md border bg-muted p-3 text-xs leading-5 text-muted-foreground dark:border-white/8 dark:bg-white/4">
          <span className="font-semibold uppercase">Benchmark basis: </span>{result.benchmark_basis}
        </div>
      ) : null}
      <div className="rounded-md border bg-white p-3 dark:border-white/8 dark:bg-card">
        <p className="text-xs font-semibold uppercase text-muted-foreground">Suggested message</p>
        <p className="mt-2 whitespace-pre-wrap text-sm leading-6">{result.message}</p>
      </div>
    </div>
  );
}

function AskView({ result }: { result: AskResult }) {
  return (
    <div className="space-y-3">
      <div className="rounded-md border bg-white p-3 dark:border-white/8 dark:bg-card">
        <p className="text-xs font-semibold uppercase text-muted-foreground">Answer</p>
        <p className="mt-2 whitespace-pre-wrap text-sm leading-6">{result.answer}</p>
      </div>
      {result.suggested_alternatives?.length ? (
        <div className="rounded-md border bg-white p-3 dark:border-white/8 dark:bg-card">
          <p className="text-xs font-semibold uppercase text-muted-foreground">Alternatives to consider</p>
          <ul className="mt-2 space-y-1.5">
            {result.suggested_alternatives.map((alt, i) => (
              <li key={i} className="text-sm leading-5">• {alt}</li>
            ))}
          </ul>
        </div>
      ) : null}
      {result.benchmark_context ? <BenchmarkContextPanel context={result.benchmark_context} /> : null}
      {result.followup_questions?.length ? (
        <div className="rounded-md border bg-muted p-3 dark:border-white/8 dark:bg-white/4">
          <p className="text-xs font-semibold uppercase text-muted-foreground">Ask the brand</p>
          <ul className="mt-2 space-y-1.5">
            {result.followup_questions.map((q, i) => (
              <li key={i} className="text-sm leading-5">→ {q}</li>
            ))}
          </ul>
        </div>
      ) : null}
      <p className="text-xs text-muted-foreground">
        Confidence: <span className="font-semibold">{Math.round(result.confidence * 100)}%</span>
        {result.market_context ? ` · ${result.market_context}` : ""}
      </p>
    </div>
  );
}

function BenchmarkContextPanel({ context }: { context: BenchmarkContext }) {
  if (!context.rate_matches?.length) return null;
  const tone = context.offer_vs_market?.classification === "below_floor"
    ? "red"
    : context.offer_vs_market?.classification === "below_median"
    ? "amber"
    : context.offer_vs_market?.classification === "at_market"
    ? "blue"
    : context.offer_vs_market?.classification === "above_market"
    ? "green"
    : "neutral";
  return (
    <div className="rounded-md border bg-emerald-50/60 p-3 dark:border-emerald-900/50 dark:bg-emerald-950/30">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-semibold uppercase text-emerald-800 dark:text-emerald-300">Market benchmark</p>
        {context.offer_vs_market && context.offer_vs_market.classification !== "no_data" ? (
          <Badge tone={tone}>{context.offer_vs_market.classification.replaceAll("_", " ")}</Badge>
        ) : null}
      </div>
      <p className="text-xs leading-5 text-emerald-900 dark:text-emerald-200">{context.summary}</p>
      <div className="mt-2 grid gap-1.5">
        {context.rate_matches.slice(0, 3).map((m, i) => (
          <div key={i} className="rounded border bg-white px-2 py-1.5 text-xs dark:border-white/8 dark:bg-card">
            <span className="font-medium">{m.platform} · {m.niche} · {m.deliverable_type} · {m.tier ?? "any tier"}</span>
            <span className="ml-2 text-muted-foreground">
              p25 ₹{m.p25_inr.toLocaleString("en-IN")} · median ₹{m.median_inr.toLocaleString("en-IN")} · p75 ₹{m.p75_inr.toLocaleString("en-IN")}
              {m.internal_deal_count > 0 ? ` · ${m.internal_deal_count} closed deals` : ` · ${m.observation_count} obs`}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function Explanation({ title, copy }: { title: string; copy: string }) {
  return (
    <div className="rounded-md border bg-white p-3 dark:border-white/8 dark:bg-card">
      <p className="text-xs font-semibold uppercase text-muted-foreground">{title}</p>
      <p className="mt-2 text-sm leading-6">{copy}</p>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border bg-white p-3 dark:border-white/8 dark:bg-card">
      <p className="text-xs font-semibold uppercase text-muted-foreground">{label}</p>
      <p className="mt-1 text-lg font-bold">{value}</p>
    </div>
  );
}
