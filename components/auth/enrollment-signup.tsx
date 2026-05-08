"use client";

import { useState } from "react";
import { ClipboardCheck, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, Textarea } from "@/components/ui/input";
import { HomeLogo } from "@/components/layout/home-logo";

type Mode = "creator" | "brand" | "freelancer";
type AuditResult = Record<string, unknown> & { source?: string };
type EnrollmentResult = {
  role: Mode;
  profile_id: string;
  creator_id?: string;
  brand_id?: string;
  freelancer_id?: string;
  audit: AuditResult;
  next_url: string;
};

export function EnrollmentSignup({ initialMode = "creator" }: { initialMode?: Mode }) {
  const [mode, setMode] = useState<Mode>(initialMode);
  const [status, setStatus] = useState<"idle" | "auditing" | "complete" | "error">("idle");
  const [result, setResult] = useState<EnrollmentResult | null>(null);
  const [error, setError] = useState("");

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("auditing");
    setError("");

    const formData = new FormData(event.currentTarget);
    const payload = {
      role: mode,
      ...Object.fromEntries(formData.entries()),
      budget_inr: Number(formData.get("budget_inr") ?? 0)
    };

    const response = await fetch("/api/enrollment", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      setStatus("error");
      const body = await response.json().catch(() => ({}));
      setError(body.error ?? "Could not create enrollment profile.");
      return;
    }

    setResult(await response.json());
    setStatus("complete");
  }

  return (
    <main className="min-h-screen px-4 py-8">
      <div className="mx-auto mb-6 flex max-w-6xl justify-start">
        <HomeLogo />
      </div>
      <div className="mx-auto grid max-w-6xl gap-6 lg:grid-cols-[0.9fr_1.1fr]">
        <section className="flex flex-col justify-center">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-primary">Agently enrollment</p>
          <h1 className="mt-3 text-4xl font-bold tracking-normal">Join with an AI intake profile</h1>
          <p className="mt-4 max-w-xl text-sm leading-6 text-muted-foreground">
            Creators bring distribution: they post on their socials and their audience reacts. Freelancers bring production: they create the content, edit, shoot, design, or produce it without needing to publish it themselves.
          </p>
          <div className="mt-6 grid gap-3 sm:grid-cols-3">
            <Card className="p-4">
              <Sparkles className="mb-3 h-5 w-5 text-primary" />
              <p className="font-semibold">Creator intake</p>
              <p className="mt-1 text-sm leading-5 text-muted-foreground">For talent who will publish content and bring audience attention through their own channels.</p>
            </Card>
            <Card className="p-4">
              <ClipboardCheck className="mb-3 h-5 w-5 text-primary" />
              <p className="font-semibold">Brand intake</p>
              <p className="mt-1 text-sm leading-5 text-muted-foreground">Campaign goal, budget, target audience, creator archetypes, timeline, and launch plan.</p>
            </Card>
            <Card className="p-4">
              <Sparkles className="mb-3 h-5 w-5 text-primary" />
              <p className="font-semibold">Freelancer intake</p>
              <p className="mt-1 text-sm leading-5 text-muted-foreground">For editors, videographers, designers, and producers who create assets but do not need to post.</p>
            </Card>
          </div>
        </section>

        <Card>
          <CardHeader>
            <div>
              <CardTitle>Create your Agently profile</CardTitle>
              <p className="mt-1 text-sm text-muted-foreground">Complete the role-specific profile Agently will use for matching, valuation, contracts, and payments.</p>
            </div>
            <Badge tone={mode === "creator" ? "green" : "blue"}>{mode}</Badge>
          </CardHeader>

          <div className="mb-5 grid gap-1 rounded-md border bg-white p-1 sm:grid-cols-3">
            <button className={`rounded px-3 py-2 text-sm font-medium ${mode === "creator" ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`} onClick={() => { setMode("creator"); setResult(null); }} type="button">I am a creator</button>
            <button className={`rounded px-3 py-2 text-sm font-medium ${mode === "brand" ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`} onClick={() => { setMode("brand"); setResult(null); }} type="button">I am a brand</button>
            <button className={`rounded px-3 py-2 text-sm font-medium ${mode === "freelancer" ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`} onClick={() => { setMode("freelancer"); setResult(null); }} type="button">I freelance</button>
          </div>

          <form className="grid gap-3 md:grid-cols-2" onSubmit={onSubmit}>
            <Input name="city_focus" placeholder={mode === "brand" ? "Launch city or region, optional" : "Home city"} />
            {mode === "creator" ? <CreatorEnrollmentFields /> : mode === "brand" ? <BrandEnrollmentFields /> : <FreelancerEnrollmentFields />}
            <Button className="md:col-span-2" disabled={status === "auditing"}>
              <ClipboardCheck className="h-4 w-4" />
              {status === "auditing" ? "Running intake audit..." : "Save intake profile"}
            </Button>
            {error ? <p className="md:col-span-2 text-sm text-red-600">{error}</p> : null}
          </form>

          {result ? <EnrollmentAuditResult result={result} /> : null}

          <p className="mt-5 text-sm text-muted-foreground">
            Need a different profile later? Use the left sidebar after intake to add the other talent side.
          </p>
        </Card>
      </div>
    </main>
  );
}

function CreatorEnrollmentFields() {
  return (
    <>
      <Input name="creator_name" placeholder="Creator/display name" />
      <Input name="instagram_url" placeholder="Instagram URL" />
      <Input name="youtube_url" placeholder="YouTube URL" />
      <Input name="tiktok_url" placeholder="TikTok URL" />
      <Textarea className="md:col-span-2" name="sample_posts" placeholder="Paste recent captions, hashtags, post links, or content notes" />
      <Textarea className="md:col-span-2" name="audience_notes" placeholder="Audience notes or screenshot summary" />
    </>
  );
}

function BrandEnrollmentFields() {
  return (
    <>
      <Input name="brand_name" placeholder="Brand name" />
      <Input name="category" placeholder="Category" />
      <Input name="website_url" placeholder="Website URL" />
      <Input name="instagram_url" placeholder="Instagram URL" />
      <Input name="product_price_point" placeholder="Product price point" />
      <Input name="budget_inr" placeholder="Campaign budget INR" type="number" />
      <Input name="campaign_length" placeholder="Campaign length, e.g. 2 weeks, 3 months, always-on" />
      <Input className="md:col-span-2" name="target_audience" placeholder="Target audience" />
      <Textarea className="md:col-span-2" name="campaign_goal" placeholder="Campaign goal" />
      <Textarea className="md:col-span-2" name="brand_notes" placeholder="Brand tone, competitors, constraints" />
    </>
  );
}

function FreelancerEnrollmentFields() {
  return (
    <>
      <Input name="freelancer_name" placeholder="Freelancer/studio name" />
      <Input name="service_category" placeholder="Service category, e.g. videographer, editor, designer" />
      <Input name="skills" placeholder="Skills, e.g. reels, motion graphics, event shoots" />
      <Input name="languages" placeholder="Languages" />
      <Input name="service_regions" placeholder="Service regions" />
      <Input name="availability_status" placeholder="Availability status" />
      <Input name="hourly_rate_inr" placeholder="Hourly rate INR" type="number" />
      <Textarea className="md:col-span-2" name="service_rates" placeholder="Service pricing, one per line. Example: Podcast edit - 8000 INR, Reel shoot - 12000 INR" />
      <Textarea className="md:col-span-2" name="portfolio_links" placeholder="Portfolio links, one per line" />
      <Textarea className="md:col-span-2" name="portfolio_notes" placeholder="Portfolio notes, equipment, past clients, production style" />
      <Textarea className="md:col-span-2" name="freelancer_bio" placeholder="Short freelancer bio" />
    </>
  );
}

function EnrollmentAuditResult({ result }: { result: EnrollmentResult }) {
  const audit = result.audit;
  const scoreKeys = Object.entries(audit).filter(([key]) => key.includes("score"));
  const detailKeys = Object.entries(audit).filter(([key]) => !key.includes("score") && key !== "source").slice(0, 6);

  return (
    <div className="mt-5 rounded-lg border bg-muted p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <p className="font-semibold">Enrollment saved</p>
          <p className="text-sm text-muted-foreground">Profile ID: {result.profile_id}</p>
        </div>
        <Badge tone="blue">{audit.source ? String(audit.source) : "ready"}</Badge>
      </div>
      <div className="grid gap-3 md:grid-cols-3">
        {scoreKeys.map(([key, value]) => (
          <div key={key} className="rounded-md border bg-white p-3">
            <p className="text-xs uppercase text-muted-foreground">{key.replaceAll("_", " ")}</p>
            <p className="mt-1 text-xl font-bold">{String(value)}</p>
          </div>
        ))}
      </div>
      <div className="mt-3 space-y-2">
        {detailKeys.map(([key, value]) => (
          <div key={key} className="rounded-md border bg-white p-3">
            <p className="mb-1 text-xs font-semibold uppercase text-muted-foreground">{key.replaceAll("_", " ")}</p>
            <p className="text-sm leading-5">{Array.isArray(value) ? value.join(", ") : String(value)}</p>
          </div>
        ))}
      </div>
      <a className="mt-4 inline-flex h-10 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground" href={`${result.next_url}?walkthrough=1`}>
        Continue to guided walkthrough
      </a>
    </div>
  );
}
