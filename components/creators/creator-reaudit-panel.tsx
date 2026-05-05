"use client";

import { useState } from "react";
import { RefreshCw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, Textarea } from "@/components/ui/input";
import type { Creator, CreatorPlatform } from "@/types";

type AuditResult = {
  bangalore_relevance_score?: number;
  india_relevance_score?: number;
  sponsor_readiness_score?: number;
  detected_categories?: string[];
  detected_languages?: string[];
  local_signals?: string[];
  content_style_summary?: string;
  brand_fit_categories?: string[];
  risk_flags?: string[];
  recommended_profile_updates?: string[];
  source?: string;
};

export function CreatorReauditPanel({ creator, platforms }: { creator: Creator; platforms: CreatorPlatform[] }) {
  const [status, setStatus] = useState<"idle" | "auditing" | "done" | "error">("idle");
  const [result, setResult] = useState<AuditResult | null>(null);
  const [error, setError] = useState("");

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("auditing");
    setError("");

    const formData = new FormData(event.currentTarget);
    const response = await fetch("/api/ai/audit-creator", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(Object.fromEntries(formData.entries()))
    });

    if (!response.ok) {
      setStatus("error");
      setError("Could not re-audit this creator profile.");
      return;
    }

    setResult(await response.json());
    setStatus("done");
  }

  const socialDefaults = platforms.map((platform) => `${platform.platform}: ${platform.url || platform.handle}`).join("\n");

  return (
    <Card className="mt-5">
      <CardHeader>
        <div>
          <CardTitle>Re-Audit Creator Profile</CardTitle>
          <p className="mt-1 text-sm text-muted-foreground">Use this when a creator changes niche, content style, city focus, or audience. The audit updates the recommended positioning before pitching brands.</p>
        </div>
        <Badge tone={result ? "green" : "blue"}>{result?.source ?? "profile audit"}</Badge>
      </CardHeader>

      <form className="grid gap-3 md:grid-cols-2" onSubmit={onSubmit}>
        <Input name="creator_name" defaultValue={creator.display_name} placeholder="Creator name" />
        <Input name="city_focus" defaultValue={creator.home_city || "Bengaluru"} placeholder="City focus" />
        <Textarea name="instagram_url" defaultValue={socialDefaults} className="md:col-span-2" placeholder="Social links and handles" />
        <Textarea
          name="sample_posts"
          className="md:col-span-2"
          placeholder="Paste recent captions, new niche notes, post URLs, hashtags, or campaign examples"
          defaultValue={`${creator.primary_niche}. ${creator.bio}. Content style: ${creator.content_style || "not captured"}. Prior sponsors: ${creator.prior_sponsor_categories.join(", ") || "not captured"}.`}
        />
        <Textarea
          name="audience_notes"
          className="md:col-span-2"
          placeholder="Audience notes or analytics screenshot summary"
          defaultValue={`Top Indian cities: ${creator.top_indian_cities.join(", ") || "not captured"}. Languages: ${creator.languages.join(", ") || "not captured"}.`}
        />
        <Button className="md:col-span-2" disabled={status === "auditing"}>
          <RefreshCw className="h-4 w-4" />
          {status === "auditing" ? "Running re-audit..." : "Run re-audit"}
        </Button>
        {error ? <p className="md:col-span-2 text-sm text-red-600">{error}</p> : null}
      </form>

      {result ? (
        <div className="mt-5 grid gap-3 lg:grid-cols-3">
          <Score label="Bangalore relevance" value={result.bangalore_relevance_score} />
          <Score label="India relevance" value={result.india_relevance_score} />
          <Score label="Sponsor readiness" value={result.sponsor_readiness_score} />
          <Summary title="Content style" value={result.content_style_summary} />
          <Summary title="Brand fit categories" value={result.brand_fit_categories?.join(", ")} />
          <Summary title="Risk flags" value={result.risk_flags?.join(", ")} />
        </div>
      ) : null}
    </Card>
  );
}

function Score({ label, value }: { label: string; value?: number }) {
  return (
    <div className="rounded-md border bg-white p-4 dark:border-white/8 dark:bg-card">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-2 text-2xl font-bold">{value ?? "-"}</p>
    </div>
  );
}

function Summary({ title, value }: { title: string; value?: string }) {
  return (
    <div className="rounded-md border bg-white p-4 dark:border-white/8 dark:bg-card lg:col-span-1">
      <p className="text-sm font-semibold">{title}</p>
      <p className="mt-2 text-sm leading-5 text-muted-foreground">{value || "No result returned."}</p>
    </div>
  );
}
