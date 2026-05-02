"use client";

import { useState } from "react";
import { SearchCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, Textarea } from "@/components/ui/input";
import type { Creator } from "@/types";

type CreatorResult = {
  creator_id: string;
  creator_name: string;
  primary_platform: string;
  fit_score: number;
  match_type: string;
  match_reason: string;
  audience_reason: string;
  outreach_angle: string;
  suggested_intro: string;
  watchouts: string[];
};

type BrandResult = {
  brand_id: string;
  brand_name: string;
  industry: string;
  fit_score: number;
  match_type: string;
  match_reason: string;
  creator_value_prop: string;
  outreach_angle: string;
  suggested_intro: string;
  likely_objections: string[];
  deal_realism: string;
};

type MatchResponse = {
  market_focus: string;
  matches: Array<CreatorResult | BrandResult>;
  source: string;
};

type MatchMode = "brand_to_creators" | "creator_to_brands";
type UserRole = "admin" | "creator" | "brand" | "freelancer";

export function BrandMatchEngine({ creators, role }: { creators: Creator[]; role: UserRole }) {
  const canUseBrandBrief = role !== "creator" && role !== "freelancer";
  const canUseCreatorBrief = role !== "brand";
  const initialMode: MatchMode = canUseBrandBrief ? "brand_to_creators" : "creator_to_brands";
  const hasBothModes = canUseBrandBrief && canUseCreatorBrief;
  const [mode, setMode] = useState<MatchMode>(initialMode);
  const [result, setResult] = useState<MatchResponse | null>(null);
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [error, setError] = useState("");

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("loading");
    setError("");

    const formData = new FormData(event.currentTarget);
    const payload = {
      direction: mode,
      ...Object.fromEntries(formData.entries()),
      min_followers: Number(formData.get("min_followers") ?? 0),
      max_followers: Number(formData.get("max_followers") ?? 0),
      minimum_deal_value_inr: Number(formData.get("minimum_deal_value_inr") ?? 0)
    };

    const response = await fetch("/api/ai/match-brands", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      setStatus("error");
      setError("Could not run the match engine.");
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
            <CardTitle>Two-Sided Match Engine</CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">Match brands to creators or creators to realistic sponsor targets for Bangalore and India-first campaigns.</p>
          </div>
          <Badge tone="green">{mode === "brand_to_creators" ? "brand brief" : "creator brief"}</Badge>
        </CardHeader>

        {hasBothModes ? (
          <div className="mb-4 grid grid-cols-2 rounded-md border bg-white p-1">
            <button
              className={`rounded px-3 py-2 text-sm font-medium ${mode === "brand_to_creators" ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}
              onClick={() => { setMode("brand_to_creators"); setResult(null); }}
              type="button"
            >
              Brand finds creators
            </button>
            <button
              className={`rounded px-3 py-2 text-sm font-medium ${mode === "creator_to_brands" ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}
              onClick={() => { setMode("creator_to_brands"); setResult(null); }}
              type="button"
            >
              Creator finds brands
            </button>
          </div>
        ) : (
          <div className="mb-4 rounded-md border bg-white p-3 text-sm leading-6 text-muted-foreground">
            {role === "brand"
              ? "Brand workspace: use this side to find realistic creators for a campaign brief."
              : "Talent workspace: use this side to find realistic brands to approach."}
          </div>
        )}

        {mode === "brand_to_creators" ? <BrandBriefForm onSubmit={onSubmit} status={status} error={error} /> : <CreatorBriefForm creators={creators} isCreatorScoped={role === "creator"} onSubmit={onSubmit} status={status} error={error} />}
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{mode === "brand_to_creators" ? "Ranked Creators" : "Ranked Brands"}</CardTitle>
          <Badge tone="blue">{result?.source ?? "ready"}</Badge>
        </CardHeader>
        {result ? (
          <div className="space-y-3">
            <p className="text-sm leading-6 text-muted-foreground">{result.market_focus}</p>
            {result.matches.map((match) => (
              "creator_name" in match ? <CreatorMatchCard key={match.creator_id} match={match} /> : <BrandMatchCard key={match.brand_id} match={match} />
            ))}
          </div>
        ) : (
          <div className="rounded-md border bg-white p-4 text-sm leading-6 text-muted-foreground">
            Run a brief to see ranked matches, realistic reasons, outreach angles, and practical objections.
          </div>
        )}
      </Card>
    </section>
  );
}

function BrandBriefForm({ onSubmit, status, error }: { onSubmit: (event: React.FormEvent<HTMLFormElement>) => void; status: string; error: string }) {
  return (
    <form className="grid gap-3 md:grid-cols-2" onSubmit={onSubmit}>
      <Input name="brand_name" placeholder="Brand name" required />
      <Input name="brand_category" placeholder="Brand category, e.g. fashion, gaming, food" required />
      <Input name="target_platform" placeholder="Target platform, e.g. Instagram, YouTube" />
      <Input name="target_audience" placeholder="Target audience, e.g. Bangalore college students" />
      <Input name="min_followers" placeholder="Minimum followers" type="number" />
      <Input name="max_followers" placeholder="Maximum followers" type="number" />
      <Input name="launch_city" placeholder="Launch city" />
      <Input name="preferred_regions" placeholder="Preferred Indian cities" />
      <Input name="preferred_languages" placeholder="Preferred languages" />
      <Input name="bridge_audience" placeholder="Bridge audience, e.g. gamers, founders, fitness" />
      <Textarea className="md:col-span-2" name="campaign_goal" placeholder="Campaign goal" required />
      <SubmitButton status={status} label="Match creators" />
      {error ? <p className="md:col-span-2 text-sm text-red-600">{error}</p> : null}
    </form>
  );
}

function CreatorBriefForm({ creators, isCreatorScoped, onSubmit, status, error }: { creators: Creator[]; isCreatorScoped: boolean; onSubmit: (event: React.FormEvent<HTMLFormElement>) => void; status: string; error: string }) {
  return (
    <form className="grid gap-3 md:grid-cols-2" onSubmit={onSubmit}>
      <div className="md:col-span-2">
        <label className="text-xs font-semibold uppercase text-muted-foreground">
          {isCreatorScoped ? "Your creator profile" : "Represented creator"}
        </label>
        <select name="creator_id" className="mt-1 h-10 w-full rounded-md border bg-white px-3 text-sm" defaultValue={creators[0]?.id ?? ""}>
          {creators.map((creator) => <option key={creator.id} value={creator.id}>{creator.display_name}</option>)}
        </select>
        <p className="mt-1 text-xs leading-5 text-muted-foreground">
          {isCreatorScoped
            ? "This is locked to the signed-in creator so the recommendations stay personal."
            : "Agency/admin mode: choose which represented creator Agently should find brand targets for."}
        </p>
      </div>
      <Input name="desired_brand_categories" placeholder="Desired brand categories" />
      <Input name="excluded_categories" placeholder="Excluded categories" />
      <Input name="minimum_deal_value_inr" placeholder="Minimum deal value INR" type="number" />
      <Input name="preferred_regions" placeholder="Preferred markets" />
      <Input name="preferred_languages" placeholder="Languages" />
      <Textarea className="md:col-span-2" name="campaign_goal" placeholder="Creator goal" />
      <Textarea className="md:col-span-2" name="audience_description" placeholder="Audience description" />
      <SubmitButton status={status} label="Match brands" />
      {error ? <p className="md:col-span-2 text-sm text-red-600">{error}</p> : null}
    </form>
  );
}

function SubmitButton({ status, label }: { status: string; label: string }) {
  return (
    <Button className="md:col-span-2" disabled={status === "loading"}>
      <SearchCheck className="h-4 w-4" />
      {status === "loading" ? "Matching..." : label}
    </Button>
  );
}

function CreatorMatchCard({ match }: { match: CreatorResult }) {
  return (
    <div className="rounded-md border bg-white p-4">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="font-semibold">{match.creator_name}</p>
          <p className="text-xs text-muted-foreground">{match.primary_platform} - {match.match_type.replaceAll("_", " ")}</p>
        </div>
        <Score score={match.fit_score} />
      </div>
      <p className="text-sm leading-5">{match.match_reason}</p>
      <p className="mt-2 text-sm leading-5 text-muted-foreground">{match.audience_reason}</p>
      <Callout title="Outreach angle" copy={match.outreach_angle} />
      <p className="mt-3 text-sm leading-5 text-muted-foreground">{match.suggested_intro}</p>
    </div>
  );
}

function BrandMatchCard({ match }: { match: BrandResult }) {
  return (
    <div className="rounded-md border bg-white p-4">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="font-semibold">{match.brand_name}</p>
          <p className="text-xs text-muted-foreground">{match.industry} - {match.match_type.replaceAll("_", " ")}</p>
        </div>
        <Score score={match.fit_score} />
      </div>
      <p className="text-sm leading-5">{match.match_reason}</p>
      <p className="mt-2 text-sm leading-5 text-muted-foreground">{match.creator_value_prop}</p>
      <Callout title="Deal realism" copy={match.deal_realism} />
      <p className="mt-3 text-sm leading-5 text-muted-foreground">{match.suggested_intro}</p>
    </div>
  );
}

function Score({ score }: { score: number }) {
  return <Badge tone={score >= 80 ? "green" : score >= 60 ? "amber" : "neutral"}>{score}</Badge>;
}

function Callout({ title, copy }: { title: string; copy: string }) {
  return (
    <div className="mt-3 rounded-md bg-muted p-3">
      <p className="text-xs font-semibold uppercase text-muted-foreground">{title}</p>
      <p className="mt-1 text-sm leading-5">{copy}</p>
    </div>
  );
}
