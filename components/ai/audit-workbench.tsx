"use client";

import { useState } from "react";
import { ClipboardCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, Textarea } from "@/components/ui/input";

type AuditResult = Record<string, unknown> & { source?: string };

export function AuditWorkbench() {
  const [mode, setMode] = useState<"creator" | "brand">("creator");
  const [result, setResult] = useState<AuditResult | null>(null);
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [error, setError] = useState("");

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("loading");
    setError("");

    const formData = new FormData(event.currentTarget);
    const payload = {
      ...Object.fromEntries(formData.entries()),
      budget_inr: Number(formData.get("budget_inr") ?? 0)
    };

    const response = await fetch(mode === "creator" ? "/api/ai/audit-creator" : "/api/ai/audit-brand", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      setStatus("error");
      setError("Could not run audit.");
      return;
    }

    setResult(await response.json());
    setStatus("idle");
  }

  return (
    <section className="grid gap-5 xl:grid-cols-[0.9fr_1.1fr]">
      <Card>
        <CardHeader>
          <div>
            <CardTitle>{mode === "creator" ? "Creator Social Audit" : "Brand Campaign Audit"}</CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">Start with pasted links and notes. Later this can use official social APIs, screenshots, and website crawling.</p>
          </div>
          <Badge tone="green">{mode === "creator" ? "creator intake" : "brand intake"}</Badge>
        </CardHeader>

        <div className="mb-4 grid grid-cols-2 rounded-md border bg-white p-1">
          <button className={`rounded px-3 py-2 text-sm font-medium ${mode === "creator" ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`} onClick={() => { setMode("creator"); setResult(null); }} type="button">Creator audit</button>
          <button className={`rounded px-3 py-2 text-sm font-medium ${mode === "brand" ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`} onClick={() => { setMode("brand"); setResult(null); }} type="button">Brand audit</button>
        </div>

        {mode === "creator" ? <CreatorAuditForm onSubmit={onSubmit} status={status} error={error} /> : <BrandAuditForm onSubmit={onSubmit} status={status} error={error} />}
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Audit Output</CardTitle>
          <Badge tone="blue">{result?.source ? String(result.source) : "ready"}</Badge>
        </CardHeader>
        {result ? <AuditResultView result={result} /> : (
          <div className="rounded-md border bg-white p-4 text-sm leading-6 text-muted-foreground">
            Run an audit to generate Bangalore fit, India relevance, content categories, creator archetypes, budget realism, risk flags, and next data to request.
          </div>
        )}
      </Card>
    </section>
  );
}

function CreatorAuditForm({ onSubmit, status, error }: { onSubmit: (event: React.FormEvent<HTMLFormElement>) => void; status: string; error: string }) {
  return (
    <form className="grid gap-3 md:grid-cols-2" onSubmit={onSubmit}>
      <Input name="creator_name" placeholder="Creator name" />
      <Input name="instagram_url" placeholder="Instagram URL" />
      <Input name="youtube_url" placeholder="YouTube URL" />
      <Input name="tiktok_url" placeholder="TikTok URL" />
      <Input name="city_focus" placeholder="City focus" />
      <Textarea className="md:col-span-2" name="sample_posts" placeholder="Paste captions, post URLs, hashtags, or notes from recent content" />
      <Textarea className="md:col-span-2" name="audience_notes" placeholder="Paste audience screenshot notes if available" />
      <Submit status={status} label="Run creator audit" />
      {error ? <p className="md:col-span-2 text-sm text-red-600">{error}</p> : null}
    </form>
  );
}

function BrandAuditForm({ onSubmit, status, error }: { onSubmit: (event: React.FormEvent<HTMLFormElement>) => void; status: string; error: string }) {
  return (
    <form className="grid gap-3 md:grid-cols-2" onSubmit={onSubmit}>
      <Input name="brand_name" placeholder="Brand name" />
      <Input name="category" placeholder="Category" />
      <Input name="website_url" placeholder="Website URL" />
      <Input name="instagram_url" placeholder="Instagram URL" />
      <Input name="product_price_point" placeholder="Product price point" />
      <Input name="budget_inr" placeholder="Budget INR" type="number" />
      <Input name="city_focus" placeholder="City focus" />
      <Input name="target_audience" placeholder="Target audience" />
      <Textarea className="md:col-span-2" name="campaign_goal" placeholder="Campaign goal" />
      <Textarea className="md:col-span-2" name="brand_notes" placeholder="Brand tone, competitors, past creator campaigns, constraints" />
      <Submit status={status} label="Run brand audit" />
      {error ? <p className="md:col-span-2 text-sm text-red-600">{error}</p> : null}
    </form>
  );
}

function Submit({ status, label }: { status: string; label: string }) {
  return (
    <Button className="md:col-span-2" disabled={status === "loading"}>
      <ClipboardCheck className="h-4 w-4" />
      {status === "loading" ? "Auditing..." : label}
    </Button>
  );
}

function AuditResultView({ result }: { result: AuditResult }) {
  const entries = Object.entries(result).filter(([key]) => key !== "source");
  return (
    <div className="space-y-3">
      {entries.map(([key, value]) => (
        <div key={key} className="rounded-md border bg-white p-3">
          <p className="mb-1 text-xs font-semibold uppercase text-muted-foreground">{key.replaceAll("_", " ")}</p>
          <ResultValue value={value} />
        </div>
      ))}
    </div>
  );
}

function ResultValue({ value }: { value: unknown }) {
  if (Array.isArray(value)) {
    return (
      <div className="flex flex-wrap gap-2">
        {value.map((item) => <Badge key={String(item)}>{String(item)}</Badge>)}
      </div>
    );
  }
  if (typeof value === "object" && value !== null) {
    return <pre className="overflow-x-auto whitespace-pre-wrap text-xs">{JSON.stringify(value, null, 2)}</pre>;
  }
  return <p className="text-sm leading-6">{String(value)}</p>;
}
