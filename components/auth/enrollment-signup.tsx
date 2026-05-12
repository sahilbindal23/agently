"use client";

import { useState } from "react";
import { ClipboardCheck, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, Textarea } from "@/components/ui/input";
import { MultiCheckbox, Select } from "@/components/ui/select";
import { HomeLogo } from "@/components/layout/home-logo";
import {
  AVAILABILITY_STATUSES,
  BRAND_INDUSTRIES,
  CAMPAIGN_LENGTHS,
  CREATOR_SIZE_BANDS,
  FREELANCER_SERVICES,
  FREELANCER_SKILLS,
  INDIAN_CITIES,
  LANGUAGES,
  NICHES,
  PRICE_POINTS
} from "@/lib/taxonomies";

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
            <Select
              name="city_focus"
              label={mode === "brand" ? "Launch city or region" : "Home city"}
              options={INDIAN_CITIES}
              placeholderOption={mode === "brand" ? "Where will the campaign launch?" : "Where are you based?"}
            />
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
      <Input className="md:col-span-2" name="creator_name" placeholder="Display name" required />
      <Select name="primary_niche" label="Primary niche" options={NICHES} placeholderOption="What do you make content about?" />
      <MultiCheckbox className="md:col-span-2" name="languages" label="Languages you create in" options={LANGUAGES} />
      <Input name="instagram_url" placeholder="Instagram URL (optional)" />
      <Input name="youtube_url" placeholder="YouTube URL (optional)" />
      <Textarea className="md:col-span-2" name="audience_notes" placeholder="Anything notable about your audience? (optional)" />
    </>
  );
}

function BrandEnrollmentFields() {
  return (
    <>
      <Input className="md:col-span-2" name="brand_name" placeholder="Brand name" required />
      <Select name="category" label="Industry" options={BRAND_INDUSTRIES} placeholderOption="What does your brand do?" />
      <Input name="website_url" placeholder="Website URL" />
      <Input name="instagram_url" placeholder="Instagram URL (optional)" />
      <Select name="product_price_point" label="Typical product price" options={PRICE_POINTS} placeholderOption="What does your product cost?" />
      <Input name="budget_inr" placeholder="Campaign budget INR" type="number" />
      <Select name="campaign_length" label="Campaign length" options={CAMPAIGN_LENGTHS} placeholderOption="How long will the campaign run?" />
      <Select name="creator_size_band" label="Preferred creator size" options={CREATOR_SIZE_BANDS} placeholderOption="What size creators do you want?" />
      <Input className="md:col-span-2" name="target_audience" placeholder="Who is your target customer? (e.g. 25-34 urban women in metros)" />
      <Textarea className="md:col-span-2" name="campaign_goal" placeholder="What is the campaign goal? (awareness, signups, sales, app installs…)" />
      <Textarea className="md:col-span-2" name="brand_notes" placeholder="Brand tone, competitors, constraints (optional)" />
    </>
  );
}

function FreelancerEnrollmentFields() {
  return (
    <>
      <Input className="md:col-span-2" name="freelancer_name" placeholder="Freelancer or studio name" required />
      <Select name="service_category" label="Primary service" options={FREELANCER_SERVICES} placeholderOption="What's your main craft?" />
      <Select name="availability_status" label="Availability" options={AVAILABILITY_STATUSES} placeholderOption="Are you taking work?" />
      <Input name="hourly_rate_inr" placeholder="Hourly rate INR" type="number" />
      <MultiCheckbox className="md:col-span-2" name="skills" label="Skills" options={FREELANCER_SKILLS} maxVisible={6} />
      <MultiCheckbox className="md:col-span-2" name="languages" label="Languages" options={LANGUAGES} />
      <Textarea className="md:col-span-2" name="portfolio_links" placeholder="Portfolio links (one per line)" />
      <Textarea className="md:col-span-2" name="freelancer_bio" placeholder="Short bio — equipment, past clients, style (optional)" />
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
