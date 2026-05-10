"use client";

import { Search, ShieldCheck } from "lucide-react";
import { useMemo, useState } from "react";
import { CreatorMarketCard, FreelancerMarketCard, BrandMarketCard } from "@/components/marketplace/marketplace-cards";
import { Input } from "@/components/ui/input";
import { BRAND_INDUSTRIES, FREELANCER_SERVICES, INDIAN_CITIES, NICHES, PLATFORMS } from "@/lib/taxonomies";

type TabItem =
  | { id: string; label: string; type: "creator"; items: Array<Record<string, unknown>>; platforms?: Array<Record<string, unknown>> }
  | { id: string; label: string; type: "freelancer"; items: Array<Record<string, unknown>> }
  | { id: string; label: string; type: "brand"; items: Array<Record<string, unknown>> };

const FOLLOWER_RANGES = [
  { value: "any",   label: "Any size",      min: 0,         max: Infinity },
  { value: "nano",  label: "Nano (<10K)",   min: 0,         max: 10_000 },
  { value: "micro", label: "Micro (10K–100K)", min: 10_000, max: 100_000 },
  { value: "mid",   label: "Mid (100K–500K)", min: 100_000, max: 500_000 },
  { value: "macro", label: "Macro (500K–1M)", min: 500_000, max: 1_000_000 },
  { value: "mega",  label: "Mega (1M+)",    min: 1_000_000, max: Infinity }
];

export function MarketplaceTabs({ tabs }: { tabs: TabItem[] }) {
  const [activeId, setActiveId] = useState(tabs[0]?.id ?? "");
  const [query, setQuery] = useState("");
  const [verifiedOnly, setVerifiedOnly] = useState(false);
  const [niche, setNiche] = useState("");
  const [city, setCity] = useState("");
  const [platform, setPlatform] = useState("");
  const [followerRange, setFollowerRange] = useState("any");
  const [service, setService] = useState("");
  const [industry, setIndustry] = useState("");

  const active = tabs.find((tab) => tab.id === activeId) ?? tabs[0];

  const visibleItems = useMemo(() => {
    if (!active) return [];
    const normalizedQuery = query.trim().toLowerCase();
    const range = FOLLOWER_RANGES.find((r) => r.value === followerRange) ?? FOLLOWER_RANGES[0];

    return active.items.filter((item) => {
      const platformRow = active.type === "creator" ? active.platforms?.find((entry) => entry.creator_id === item.id) : null;

      // Free-text match (kept as a final filter for name/handle/keyword search)
      if (normalizedQuery) {
        const haystack = JSON.stringify({ ...item, platform: platformRow }).toLowerCase();
        if (!haystack.includes(normalizedQuery)) return false;
      }

      if (verifiedOnly && !isVerified(item)) return false;

      // Creator-specific filters
      if (active.type === "creator") {
        if (niche && !matchesNiche(item, niche)) return false;
        if (city && !matchesCity(item, city)) return false;
        if (platform && !matchesPlatform(active.platforms ?? [], item, platform)) return false;
        if (followerRange !== "any") {
          const followers = followerCount(active.platforms ?? [], item);
          if (followers < range.min || followers > range.max) return false;
        }
      }

      // Freelancer filters
      if (active.type === "freelancer") {
        if (service && !matchesService(item, service)) return false;
        if (city && !matchesCity(item, city)) return false;
      }

      // Brand filters
      if (active.type === "brand") {
        if (industry && !matchesBrandIndustry(item, industry)) return false;
        if (city && !matchesBrandCity(item, city)) return false;
      }

      return true;
    });
  }, [active, query, verifiedOnly, niche, city, platform, followerRange, service, industry]);

  if (!active) return null;

  return (
    <div>
      <div className="mb-4 flex gap-1 overflow-x-auto border-b">
        {tabs.map((tab) => (
          <button
            className={`rounded-t-md border border-b-0 px-4 py-2 text-sm font-medium transition dark:border-white/8 ${active.id === tab.id ? "bg-white text-foreground dark:bg-card" : "bg-muted/60 text-muted-foreground hover:bg-white dark:bg-white/4 dark:hover:bg-card"}`}
            key={tab.id}
            onClick={() => setActiveId(tab.id)}
            type="button"
          >
            {tab.label} <span className="ml-1 text-xs text-muted-foreground">({tab.items.length})</span>
          </button>
        ))}
      </div>

      <div className="mb-4 grid gap-3">
        <label className="relative block">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-9"
            onChange={(event) => setQuery(event.target.value)}
            placeholder={`Search ${active.label.toLowerCase()} by name or handle`}
            value={query}
          />
        </label>

        {/* Per-tab filter dropdowns */}
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {active.type === "creator" ? (
            <>
              <FilterSelect label="Niche" value={niche} onChange={setNiche} options={NICHES} />
              <FilterSelect label="Platform" value={platform} onChange={setPlatform} options={PLATFORMS} />
              <FilterSelect label="Follower size" value={followerRange} onChange={setFollowerRange}
                options={FOLLOWER_RANGES.map((r) => ({ value: r.value, label: r.label }))}
                allowEmpty={false}
              />
              <FilterSelect label="City" value={city} onChange={setCity} options={INDIAN_CITIES} />
            </>
          ) : null}
          {active.type === "freelancer" ? (
            <>
              <FilterSelect label="Service" value={service} onChange={setService} options={FREELANCER_SERVICES} />
              <FilterSelect label="City" value={city} onChange={setCity} options={INDIAN_CITIES} />
            </>
          ) : null}
          {active.type === "brand" ? (
            <>
              <FilterSelect label="Industry" value={industry} onChange={setIndustry} options={BRAND_INDUSTRIES} />
              <FilterSelect label="City" value={city} onChange={setCity} options={INDIAN_CITIES} />
            </>
          ) : null}
          <button
            className={`inline-flex h-10 items-center justify-center gap-2 rounded-md border px-3 text-sm font-semibold transition ${verifiedOnly ? "border-emerald-500 bg-emerald-50 text-emerald-800 dark:border-emerald-500/60 dark:bg-emerald-950/40 dark:text-emerald-300" : "bg-card text-muted-foreground hover:bg-muted dark:border-white/8"}`}
            onClick={() => setVerifiedOnly((current) => !current)}
            type="button"
          >
            <ShieldCheck className="h-4 w-4" />
            {verifiedOnly ? "Verified only" : "All profiles"}
          </button>
        </div>
      </div>

      {visibleItems.length ? (
        <div className="grid gap-3 md:grid-cols-3">
          {visibleItems.map((item) => {
            if (active.type === "creator") {
              const platformRow = active.platforms?.find((entry) => entry.creator_id === item.id);
              return <CreatorMarketCard creator={item} key={String(item.id)} platform={platformRow} />;
            }
            if (active.type === "freelancer") {
              return <FreelancerMarketCard freelancer={item} key={String(item.id)} />;
            }
            return <BrandMarketCard brand={item} key={String(item.id)} />;
          })}
        </div>
      ) : (
        <div className="rounded-md border bg-white p-4 text-sm text-muted-foreground dark:border-white/8 dark:bg-card">
          No profiles match these filters. Clear some filters or turn off verified-only.
        </div>
      )}
    </div>
  );
}

function FilterSelect({
  label,
  value,
  onChange,
  options,
  allowEmpty = true
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
  allowEmpty?: boolean;
}) {
  return (
    <label className="block text-sm">
      <span className="sr-only">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-10 w-full rounded-md border bg-white px-3 text-sm dark:border-white/10 dark:bg-card dark:text-foreground"
      >
        {allowEmpty ? <option value="">{label}: Any</option> : null}
        {options.map((opt) => <option key={opt.value} value={opt.value}>{label}: {opt.label}</option>)}
      </select>
    </label>
  );
}

function isVerified(item: Record<string, unknown>) {
  return String(item.verification_status ?? "") === "verified" || ["verified", "performance"].includes(String(item.verification_tier ?? ""));
}

function matchesNiche(item: Record<string, unknown>, niche: string) {
  const haystack = `${item.primary_niche ?? ""} ${item.content_style ?? ""} ${item.bio ?? ""}`.toLowerCase();
  return haystack.includes(niche.toLowerCase());
}

function matchesCity(item: Record<string, unknown>, city: string) {
  const haystack = `${item.home_city ?? ""} ${(Array.isArray(item.top_indian_cities) ? item.top_indian_cities.join(" ") : "")} ${(Array.isArray(item.service_regions) ? item.service_regions.join(" ") : "")}`.toLowerCase();
  return haystack.includes(city.toLowerCase());
}

function matchesPlatform(platforms: Array<Record<string, unknown>>, creator: Record<string, unknown>, platform: string) {
  const creatorPlatforms = platforms.filter((p) => p.creator_id === creator.id);
  return creatorPlatforms.some((p) => String(p.platform ?? "").toLowerCase().includes(platform.toLowerCase()));
}

function followerCount(platforms: Array<Record<string, unknown>>, creator: Record<string, unknown>) {
  const creatorPlatforms = platforms.filter((p) => p.creator_id === creator.id);
  return creatorPlatforms.reduce((max, p) => Math.max(max, Number(p.followers ?? 0)), 0);
}

function matchesService(item: Record<string, unknown>, service: string) {
  const haystack = `${item.service_category ?? ""} ${(Array.isArray(item.skills) ? item.skills.join(" ") : "")} ${item.bio ?? ""}`.toLowerCase();
  return haystack.includes(service.toLowerCase());
}

function matchesBrandIndustry(item: Record<string, unknown>, industry: string) {
  const haystack = `${item.industry ?? ""} ${item.category ?? ""}`.toLowerCase();
  return haystack.includes(industry.toLowerCase());
}

function matchesBrandCity(item: Record<string, unknown>, city: string) {
  const haystack = `${item.city_focus ?? ""} ${item.headquarters ?? ""} ${item.region_focus ?? ""}`.toLowerCase();
  return haystack.includes(city.toLowerCase());
}
