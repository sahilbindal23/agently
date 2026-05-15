"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ClipboardList } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import type { Creator } from "@/types";

// Curated India-first option sets. Keeps the form low-friction (clicks
// instead of typing) and forces clean values for the recommendation
// engine (no "fashion" vs "Fashion" vs "fashion " variance).
const BRAND_CATEGORIES = [
  "Fashion & Apparel",
  "Beauty & Personal Care",
  "Food & Beverage",
  "Tech & Electronics",
  "Fitness & Wellness",
  "Gaming",
  "Finance & Fintech",
  "Travel & Hospitality",
  "Education & EdTech",
  "Home & Lifestyle",
  "Automotive",
  "Healthcare & Pharma",
  "D2C",
  "Other"
];

const CAMPAIGN_LENGTHS = [
  "1 week",
  "2 weeks",
  "1 month",
  "2 months",
  "3 months",
  "6 months",
  "Ongoing"
];

const PLATFORM_OPTIONS = [
  "Instagram",
  "YouTube",
  "TikTok"
];

const CREATOR_CATEGORY_OPTIONS = [
  "fashion",
  "beauty",
  "food",
  "tech",
  "gaming",
  "fitness",
  "lifestyle",
  "travel",
  "education",
  "finance",
  "parenting",
  "comedy",
  "music",
  "dance",
  "automotive"
];

const FREELANCER_NEED_OPTIONS = [
  "editor",
  "videographer",
  "photographer",
  "designer",
  "copywriter",
  "animator",
  "voice-over",
  "sound engineer",
  "motion graphics",
  "thumbnail designer"
];

const LANGUAGE_OPTIONS = [
  "English",
  "Hindi",
  "Kannada",
  "Tamil",
  "Telugu",
  "Malayalam",
  "Marathi",
  "Bengali",
  "Gujarati",
  "Punjabi"
];

const CITY_OPTIONS = [
  "Bangalore",
  "Mumbai",
  "Delhi NCR",
  "Hyderabad",
  "Chennai",
  "Pune",
  "Kolkata",
  "Ahmedabad",
  "Jaipur",
  "Kochi",
  "Pan-India"
];

const REGION_OPTIONS = [
  "Bangalore",
  "South India",
  "North India",
  "West India",
  "East India",
  "India",
  "Global"
];

export function CreateCampaignForm({ creators = [] }: { creators?: Creator[] }) {
  const router = useRouter();
  const [status, setStatus] = useState<"idle" | "saving" | "error">("idle");
  const [message, setMessage] = useState("");
  const [visibility, setVisibility] = useState<"open" | "invite_only">("open");
  const [selectedCreatorIds, setSelectedCreatorIds] = useState<string[]>([]);
  const [platforms, setPlatforms] = useState<string[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [freelancerNeeds, setFreelancerNeeds] = useState<string[]>([]);
  const [languages, setLanguages] = useState<string[]>([]);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    setStatus("saving");
    setMessage("");

    const formData = new FormData(form);
    if (visibility === "invite_only" && selectedCreatorIds.length === 0) {
      setStatus("error");
      setMessage("Choose at least one creator for an invite-only campaign.");
      return;
    }

    // The multi-select chip fields aren't in the form natively, so inject
    // them as comma-separated strings — the API already splits on commas.
    const payload = {
      ...Object.fromEntries(formData.entries()),
      platforms: platforms.join(", "),
      creator_categories: categories.join(", "),
      freelancer_needs: freelancerNeeds.join(", "),
      languages: languages.join(", ")
    };

    const response = await fetch("/api/campaigns", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      setStatus("error");
      setMessage(body.error ?? "Could not create campaign.");
      return;
    }

    form.reset();
    setSelectedCreatorIds([]);
    setPlatforms([]);
    setCategories([]);
    setFreelancerNeeds([]);
    setLanguages([]);
    setVisibility("open");
    setStatus("idle");
    router.refresh();
  }

  function toggleCreator(id: string) {
    setSelectedCreatorIds((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  }

  return (
    <form className="grid gap-3 md:grid-cols-2" onSubmit={onSubmit}>
      <Input name="title" placeholder="Campaign title" required />
      <Input name="brand_name" placeholder="Brand name, optional" />

      <Select name="brand_category" defaultValue="">
        <option value="">Brand category…</option>
        {BRAND_CATEGORIES.map((option) => <option key={option} value={option}>{option}</option>)}
      </Select>
      <Input name="budget_inr" placeholder="Budget INR" type="number" />

      <Select name="city_focus" defaultValue="">
        <option value="">City focus…</option>
        {CITY_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
      </Select>
      <Select name="region_focus" defaultValue="">
        <option value="">Region focus…</option>
        {REGION_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
      </Select>

      <Select name="campaign_length" defaultValue="">
        <option value="">Campaign length…</option>
        {CAMPAIGN_LENGTHS.map((option) => <option key={option} value={option}>{option}</option>)}
      </Select>
      <Select name="visibility" value={visibility} onChange={(event) => setVisibility(event.target.value as "open" | "invite_only")}>
        <option value="open">Open discovery</option>
        <option value="invite_only">Invite-only creator campaign</option>
      </Select>

      <ChipMultiSelect
        className="md:col-span-2"
        label="Platforms"
        options={PLATFORM_OPTIONS}
        value={platforms}
        onChange={setPlatforms}
      />
      <ChipMultiSelect
        className="md:col-span-2"
        label="Creator categories"
        options={CREATOR_CATEGORY_OPTIONS}
        value={categories}
        onChange={setCategories}
      />
      <ChipMultiSelect
        className="md:col-span-2"
        label="Freelancer needs"
        options={FREELANCER_NEED_OPTIONS}
        value={freelancerNeeds}
        onChange={setFreelancerNeeds}
      />
      <ChipMultiSelect
        className="md:col-span-2"
        label="Languages"
        options={LANGUAGE_OPTIONS}
        value={languages}
        onChange={setLanguages}
      />

      {visibility === "invite_only" ? (
        <div className="md:col-span-2 rounded-md border bg-white p-3 dark:border-white/8 dark:bg-card">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-xs font-semibold uppercase text-muted-foreground">Invite specific creators</p>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">Only selected creators will appear in recommendations for this campaign.</p>
            </div>
            <span className="rounded-full border bg-muted px-2.5 py-1 text-xs font-medium">{selectedCreatorIds.length} selected</span>
          </div>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {creators.map((creator) => (
              <label className={`flex items-center gap-2 rounded-md border px-3 py-2 text-sm ${selectedCreatorIds.includes(creator.id) ? "border-primary bg-primary/5" : ""}`} key={creator.id}>
                <input checked={selectedCreatorIds.includes(creator.id)} name="invited_creator_ids" onChange={() => toggleCreator(creator.id)} type="checkbox" value={creator.id} />
                <span>{creator.display_name}</span>
              </label>
            ))}
          </div>
        </div>
      ) : null}
      <Textarea className="md:col-span-2" name="target_audience" placeholder="Target audience" />
      <Textarea className="md:col-span-2" name="campaign_goal" placeholder="Campaign goal and context" required />
      <Button className="md:col-span-2" disabled={status === "saving"}>
        <ClipboardList className="h-4 w-4" />
        {status === "saving" ? "Creating..." : "Create campaign brief"}
      </Button>
      {message ? <p className={`md:col-span-2 text-sm ${status === "error" ? "text-red-600" : "text-emerald-700"}`}>{message}</p> : null}
    </form>
  );
}

function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  const { className, ...rest } = props;
  return (
    <select
      {...rest}
      className={`h-10 rounded-md border bg-white px-3 text-sm outline-none transition focus:ring-2 focus:ring-ring dark:bg-card dark:text-foreground dark:border-white/10 ${className ?? ""}`}
    />
  );
}

function ChipMultiSelect({
  className,
  label,
  options,
  value,
  onChange
}: {
  className?: string;
  label: string;
  options: string[];
  value: string[];
  onChange: (next: string[]) => void;
}) {
  function toggle(option: string) {
    onChange(value.includes(option) ? value.filter((item) => item !== option) : [...value, option]);
  }
  return (
    <div className={`rounded-md border bg-white p-3 dark:border-white/8 dark:bg-card ${className ?? ""}`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-semibold uppercase text-muted-foreground">{label}</p>
        <span className="rounded-full border bg-muted px-2.5 py-1 text-xs font-medium">{value.length} selected</span>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {options.map((option) => {
          const active = value.includes(option);
          return (
            <button
              key={option}
              type="button"
              onClick={() => toggle(option)}
              className={`rounded-full border px-3 py-1 text-xs font-medium transition ${active ? "border-primary bg-primary text-primary-foreground" : "bg-muted text-foreground hover:bg-muted/80"}`}
            >
              {option}
            </button>
          );
        })}
      </div>
    </div>
  );
}
