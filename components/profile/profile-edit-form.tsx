"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { MultiCheckbox, Select } from "@/components/ui/select";
import {
  AUDIENCE_AGE_RANGES,
  AVAILABILITY_STATUSES,
  BRAND_INDUSTRIES,
  CAMPAIGN_LENGTHS,
  CONTENT_STYLES,
  COUNTRIES,
  CREATOR_SIZE_BANDS,
  FREELANCER_SERVICES,
  FREELANCER_SKILLS,
  INDIAN_CITIES,
  LANGUAGES,
  NICHES,
  SPONSOR_CATEGORIES
} from "@/lib/taxonomies";

// Local to the creator preferences block. "paused" maps to open_to_offers=false
// in the update route; anything else (incl. empty) is treated as open.
const OFFER_AVAILABILITY = [
  { value: "open", label: "Yes — actively taking offers" },
  { value: "paused", label: "Not right now" }
];

type ProfileEditProps = {
  role: "creator" | "brand" | "freelancer";
  profile: Record<string, unknown>;
  platforms?: Array<Record<string, unknown>>;
  serviceRates?: Array<Record<string, unknown>>;
  portfolio?: Array<Record<string, unknown>>;
  audit?: Record<string, unknown> | null;
};

export function ProfileEditForm({ role, profile, serviceRates = [], portfolio = [], audit }: ProfileEditProps) {
  const router = useRouter();
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [message, setMessage] = useState("");

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("saving");
    setMessage("");

    const formData = new FormData(event.currentTarget);
    const response = await fetch("/api/profile/update", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(Object.fromEntries(formData.entries()))
    });

    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      setStatus("error");
      setMessage(body.error ?? "Could not update profile.");
      return;
    }

    setStatus("saved");
    setMessage("Profile updated.");
    router.refresh();
  }

  return (
    <form className="grid gap-3 md:grid-cols-2" onSubmit={onSubmit}>
      {role === "creator" ? (
        <CreatorFields profile={profile} />
      ) : role === "freelancer" ? (
        <FreelancerFields profile={profile} portfolio={portfolio} serviceRates={serviceRates} />
      ) : (
        <BrandFields profile={profile} audit={audit} />
      )}
      <Button className="md:col-span-2" disabled={status === "saving"}>
        <Save className="h-4 w-4" />
        {status === "saving" ? "Saving..." : "Save profile"}
      </Button>
      {message ? <p className={`md:col-span-2 text-sm ${status === "error" ? "text-red-600" : "text-emerald-700"}`}>{message}</p> : null}
    </form>
  );
}

function CreatorFields({ profile }: { profile: Record<string, unknown> }) {
  return (
    <>
      <LabeledInput label="Display name" name="display_name" placeholder="Display name" defaultValue={value(profile.display_name)} required />
      <Select name="primary_niche" label="Primary niche" options={NICHES} defaultValue={value(profile.primary_niche)} placeholderOption="What do you make content about?" />
      <Select name="home_city" label="Home city" options={INDIAN_CITIES} defaultValue={value(profile.home_city)} placeholderOption="Where are you based?" />
      <Select name="country" label="Country" options={COUNTRIES} defaultValue={value(profile.country) || "IN"} placeholderOption="Country" />
      <Select name="audience_age_range" label="Audience age range" options={AUDIENCE_AGE_RANGES} defaultValue={value(profile.audience_age_range)} placeholderOption="Who watches your content?" />
      <Select name="content_style" label="Content style" options={CONTENT_STYLES} defaultValue={value(profile.content_style)} placeholderOption="Format you mostly use" />
      <MultiCheckbox className="md:col-span-2" name="languages" label="Languages you create in" options={LANGUAGES} defaultSelected={normalizeArray(profile.languages)} />
      <MultiCheckbox className="md:col-span-2" name="top_indian_cities" label="Top Indian audience cities" options={INDIAN_CITIES} defaultSelected={normalizeArray(profile.top_indian_cities)} maxVisible={9} />
      <MultiCheckbox className="md:col-span-2" name="prior_sponsor_categories" label="Past sponsor categories" options={SPONSOR_CATEGORIES} defaultSelected={normalizeArray(profile.prior_sponsor_categories)} maxVisible={6} />

      {/* Two-sided matching: what the creator WANTS. These nudge how the
          recommendation engine ranks this creator for brand briefs, so we
          stop surfacing talent that would decline the offer anyway. */}
      <div className="md:col-span-2 mt-2 rounded-md border bg-muted/40 px-3 py-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Your offer preferences</p>
        <p className="mt-1 text-xs leading-4 text-muted-foreground">Optional. These tune which brand briefs Agently recommends you for — they don&apos;t hide you from search.</p>
      </div>
      <Select name="open_to_offers" label="Open to new brand offers?" options={OFFER_AVAILABILITY} defaultValue={value(profile.open_to_offers) === "false" ? "paused" : "open"} placeholderOption="Are you taking work?" />
      <LabeledInput label="Minimum deal value (INR)" name="min_deal_inr" type="number" min={0} placeholder="e.g. 15000" defaultValue={profile.min_deal_cents ? String(Math.round(Number(profile.min_deal_cents) / 100)) : ""} />
      <MultiCheckbox className="md:col-span-2" name="preferred_categories" label="Categories you want more of" options={SPONSOR_CATEGORIES} defaultSelected={normalizeArray(profile.preferred_categories)} maxVisible={6} />
      <MultiCheckbox className="md:col-span-2" name="excluded_categories" label="Categories you won't work with" options={SPONSOR_CATEGORIES} defaultSelected={normalizeArray(profile.excluded_categories)} maxVisible={6} />

      <ReadOnlySignal label="India audience" value={`${value(profile.india_audience_percent) || 0}%`} />
      <ReadOnlySignal label="Monetization score" value={`${value(profile.monetization_score) || 0}/100`} />
      <ReadOnlySignal label="Valuation score" value={`${value(profile.valuation_score) || 0}/100`} />
      <Textarea className="md:col-span-2" name="bio" placeholder="Creator bio and positioning" defaultValue={value(profile.bio)} />
    </>
  );
}

function ReadOnlySignal({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border bg-muted px-3 py-2">
      <p className="text-xs font-semibold uppercase text-muted-foreground">{label}</p>
      <p className="mt-1 text-sm font-semibold">{value}</p>
      <p className="mt-1 text-xs leading-4 text-muted-foreground">Calculated by Agently from platform/audit data.</p>
    </div>
  );
}

function FreelancerFields({
  profile,
  serviceRates,
  portfolio
}: {
  profile: Record<string, unknown>;
  serviceRates: Array<Record<string, unknown>>;
  portfolio: Array<Record<string, unknown>>;
}) {
  return (
    <>
      <LabeledInput label="Display name" name="display_name" placeholder="Freelancer/studio name" defaultValue={value(profile.display_name)} required />
      <Select name="service_category" label="Primary service" options={FREELANCER_SERVICES} defaultValue={value(profile.service_category)} placeholderOption="What's your main craft?" />
      <Select name="home_city" label="Home city" options={INDIAN_CITIES} defaultValue={value(profile.home_city)} placeholderOption="Where are you based?" />
      <Select name="availability_status" label="Availability" options={AVAILABILITY_STATUSES} defaultValue={value(profile.availability_status)} placeholderOption="Are you taking work?" />
      <Input name="hourly_rate_inr" placeholder="Hourly rate INR" type="number" defaultValue={String(Math.round(Number(profile.hourly_rate_cents ?? profile.day_rate_cents ?? 0) / 100))} />
      <MultiCheckbox className="md:col-span-2" name="languages" label="Languages" options={LANGUAGES} defaultSelected={normalizeArray(profile.languages)} />
      <MultiCheckbox className="md:col-span-2" name="service_regions" label="Service regions" options={INDIAN_CITIES} defaultSelected={normalizeArray(profile.service_regions)} maxVisible={9} />
      <MultiCheckbox className="md:col-span-2" name="skills" label="Skills" options={FREELANCER_SKILLS} defaultSelected={normalizeArray(profile.skills)} maxVisible={6} />
      <Textarea className="md:col-span-2" name="bio" placeholder="Freelancer bio" defaultValue={value(profile.bio)} />
      <Textarea
        className="md:col-span-2 min-h-32"
        name="service_rates"
        placeholder="One service per line: Service name | Description | Rate INR | Pricing unit"
        defaultValue={serviceRates.map((rate) => [rate.service_name, rate.description, Math.round(Number(rate.rate_cents ?? 0) / 100), rate.pricing_unit].map(value).join(" | ")).join("\n")}
      />
      <Textarea
        className="md:col-span-2 min-h-32"
        name="portfolio_items"
        placeholder="One portfolio item per line: Title | URL | Category | Client | Description"
        defaultValue={portfolio.map((item) => [item.title, item.url, item.category, item.brand_client, item.description].map(value).join(" | ")).join("\n")}
      />
    </>
  );
}

function BrandFields({ profile, audit }: { profile: Record<string, unknown>; audit?: Record<string, unknown> | null }) {
  const result = audit?.result as Record<string, unknown> | undefined;
  const auditInput = audit?.input as Record<string, unknown> | undefined;
  return (
    <>
      <LabeledInput label="Brand name" name="name" placeholder="Brand name" defaultValue={value(profile.name)} required />
      <Select name="industry" label="Industry" options={BRAND_INDUSTRIES} defaultValue={value(profile.industry)} placeholderOption="Pick your category" />
      <Input name="website" placeholder="Website" defaultValue={value(profile.website)} />
      <Input name="contact_email" placeholder="Contact email" defaultValue={value(profile.contact_email)} />
      {/* Customization: short tagline + banner image URL render on the
          public /brands/[id] profile so brands look more polished to creators. */}
      <Input name="tagline" placeholder="Short tagline (e.g. 'India-first wireless earbuds')" defaultValue={value(profile.tagline)} maxLength={80} />
      <Input name="banner_url" placeholder="Banner image URL (1200×400 hero on your public profile)" defaultValue={value(profile.banner_url)} />
      <Select name="city_focus" label="Launch city or region" options={INDIAN_CITIES} defaultValue={value(auditInput?.city_focus)} placeholderOption="Where are you launching?" />
      <Select name="creator_size_band" label="Preferred creator size" options={CREATOR_SIZE_BANDS} defaultValue={value(result?.creator_size_band)} placeholderOption="What size creators?" />
      <Select name="campaign_length" label="Campaign length" options={CAMPAIGN_LENGTHS} defaultValue={value(auditInput?.campaign_length)} placeholderOption="How long?" />
      {/* "Bangalore launch fit" signal removed — city fit is now internal,
          fed dynamically per campaign via the recommendation engine. */}
      <Textarea className="md:col-span-2" name="target_audience" placeholder="Who is your target customer? (e.g. 25-34 urban women in metros)" defaultValue={value(auditInput?.target_audience)} />
      <Textarea className="md:col-span-2" name="campaign_goal" placeholder="What's the campaign goal? (awareness, signups, sales, app installs…)" defaultValue={value(auditInput?.campaign_goal)} />
      <Textarea className="md:col-span-2" name="brand_notes" placeholder="Brand tone, constraints, competitors, product notes (optional)" defaultValue={value(auditInput?.brand_notes)} />
    </>
  );
}

function LabeledInput({ label, ...props }: React.InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</span>
      <Input {...props} />
    </label>
  );
}

function value(input: unknown) {
  return input === null || input === undefined ? "" : String(input);
}

/**
 * Coerce a profile field that may be either an array or a comma-separated
 * string into an array of canonical lowercased values. Used to seed
 * MultiCheckbox defaultSelected from existing profile data.
 */
function normalizeArray(input: unknown): string[] {
  if (Array.isArray(input)) return input.map((v) => String(v).trim().toLowerCase()).filter(Boolean);
  if (typeof input === "string") return input.split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
  return [];
}
