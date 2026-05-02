"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";

type ProfileEditProps = {
  role: "creator" | "brand" | "freelancer";
  profile: Record<string, unknown>;
  platforms?: Array<Record<string, unknown>>;
  serviceRates?: Array<Record<string, unknown>>;
  portfolio?: Array<Record<string, unknown>>;
  audit?: Record<string, unknown> | null;
};

export function ProfileEditForm({ role, profile, platforms = [], serviceRates = [], portfolio = [], audit }: ProfileEditProps) {
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
        <CreatorFields profile={profile} platforms={platforms} />
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

function CreatorFields({ profile, platforms }: { profile: Record<string, unknown>; platforms: Array<Record<string, unknown>> }) {
  return (
    <>
      <Input name="display_name" placeholder="Display name" defaultValue={value(profile.display_name)} required />
      <Input name="primary_niche" placeholder="Primary niche" defaultValue={value(profile.primary_niche)} />
      <Input name="country" placeholder="Country" defaultValue={value(profile.country) || "IN"} />
      <Input name="home_city" placeholder="Home city" defaultValue={value(profile.home_city)} />
      <Input name="audience_age_range" placeholder="Audience age range" defaultValue={value(profile.audience_age_range)} />
      <Input name="languages" placeholder="Languages, comma separated" defaultValue={arrayValue(profile.languages)} />
      <Input name="top_indian_cities" placeholder="Top Indian cities, comma separated" defaultValue={arrayValue(profile.top_indian_cities)} />
      <Input name="content_style" placeholder="Content style" defaultValue={value(profile.content_style)} />
      <Input name="prior_sponsor_categories" placeholder="Sponsor categories, comma separated" defaultValue={arrayValue(profile.prior_sponsor_categories)} />
      <ReadOnlySignal label="India audience" value={`${value(profile.india_audience_percent) || 0}%`} />
      <ReadOnlySignal label="Monetization score" value={`${value(profile.monetization_score) || 0}/100`} />
      <ReadOnlySignal label="Valuation score" value={`${value(profile.valuation_score) || 0}/100`} />
      <Textarea className="md:col-span-2" name="bio" placeholder="Creator bio and positioning" defaultValue={value(profile.bio)} />
      <Textarea
        className="md:col-span-2 min-h-36"
        name="platforms"
        placeholder="One platform per line: Platform | Handle | URL | Followers | Avg views | Engagement rate | Posting frequency"
        defaultValue={platforms.map((platform) => [
          platform.platform,
          platform.handle,
          platform.url,
          platform.followers,
          platform.avg_views,
          platform.engagement_rate,
          platform.posting_frequency
        ].map(value).join(" | ")).join("\n")}
      />
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
      <Input name="display_name" placeholder="Freelancer/studio name" defaultValue={value(profile.display_name)} required />
      <Input name="service_category" placeholder="Service category" defaultValue={value(profile.service_category)} />
      <Input name="home_city" placeholder="Home city" defaultValue={value(profile.home_city)} />
      <Input name="hourly_rate_inr" placeholder="Hourly rate INR" type="number" defaultValue={String(Math.round(Number(profile.hourly_rate_cents ?? profile.day_rate_cents ?? 0) / 100))} />
      <Input name="availability_status" placeholder="Availability status" defaultValue={value(profile.availability_status)} />
      <Input name="languages" placeholder="Languages, comma separated" defaultValue={arrayValue(profile.languages)} />
      <Input className="md:col-span-2" name="service_regions" placeholder="Service regions, comma separated" defaultValue={arrayValue(profile.service_regions)} />
      <Input className="md:col-span-2" name="skills" placeholder="Skills, comma separated" defaultValue={arrayValue(profile.skills)} />
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
  return (
    <>
      <Input name="name" placeholder="Brand name" defaultValue={value(profile.name)} required />
      <Input name="industry" placeholder="Industry/category" defaultValue={value(profile.industry)} />
      <Input name="website" placeholder="Website" defaultValue={value(profile.website)} />
      <Input name="contact_email" placeholder="Contact email" defaultValue={value(profile.contact_email)} />
      <Input name="status" placeholder="Status" defaultValue={value(profile.status) || "enrolled"} />
      <Input name="city_focus" placeholder="Launch city or region" defaultValue={value((audit?.input as Record<string, unknown> | undefined)?.city_focus)} />
      <Input name="creator_size_band" placeholder="Creator size band" defaultValue={value(result?.creator_size_band)} />
      <Input name="bangalore_launch_fit_score" placeholder="Bangalore launch fit score" type="number" min="0" max="100" defaultValue={value(result?.bangalore_launch_fit_score)} />
      <Textarea className="md:col-span-2" name="target_audience" placeholder="Target audience" defaultValue={value((audit?.input as Record<string, unknown> | undefined)?.target_audience)} />
      <Textarea className="md:col-span-2" name="campaign_goal" placeholder="Campaign goal" defaultValue={value((audit?.input as Record<string, unknown> | undefined)?.campaign_goal)} />
      <Textarea className="md:col-span-2" name="ideal_creator_archetypes" placeholder="Ideal creator archetypes, comma separated" defaultValue={arrayValue(result?.ideal_creator_archetypes)} />
      <Textarea className="md:col-span-2" name="brand_notes" placeholder="Brand tone, constraints, competitors, product notes" defaultValue={value((audit?.input as Record<string, unknown> | undefined)?.brand_notes)} />
    </>
  );
}

function value(input: unknown) {
  return input === null || input === undefined ? "" : String(input);
}

function arrayValue(input: unknown) {
  return Array.isArray(input) ? input.map(String).join(", ") : value(input);
}
