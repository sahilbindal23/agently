"use client";

import { Search, ShieldCheck } from "lucide-react";
import { useMemo, useState } from "react";
import { CreatorMarketCard, FreelancerMarketCard, BrandMarketCard } from "@/components/marketplace/marketplace-cards";
import { Input } from "@/components/ui/input";

type TabItem =
  | { id: string; label: string; type: "creator"; items: Array<Record<string, unknown>>; platforms?: Array<Record<string, unknown>> }
  | { id: string; label: string; type: "freelancer"; items: Array<Record<string, unknown>> }
  | { id: string; label: string; type: "brand"; items: Array<Record<string, unknown>> };

export function MarketplaceTabs({ tabs }: { tabs: TabItem[] }) {
  const [activeId, setActiveId] = useState(tabs[0]?.id ?? "");
  const [query, setQuery] = useState("");
  const [verifiedOnly, setVerifiedOnly] = useState(false);
  const active = tabs.find((tab) => tab.id === activeId) ?? tabs[0];
  const visibleItems = useMemo(() => {
    if (!active) return [];
    const normalizedQuery = query.trim().toLowerCase();
    return active.items.filter((item) => {
      const platform = active.type === "creator" ? active.platforms?.find((entry) => entry.creator_id === item.id) : null;
      const haystack = JSON.stringify({ ...item, platform }).toLowerCase();
      const matchesQuery = normalizedQuery ? haystack.includes(normalizedQuery) : true;
      const matchesVerified = verifiedOnly ? isVerified(item) : true;
      return matchesQuery && matchesVerified;
    });
  }, [active, query, verifiedOnly]);

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

      <div className="mb-4 grid gap-3 md:grid-cols-[1fr_auto]">
        <label className="relative block">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-9"
            onChange={(event) => setQuery(event.target.value)}
            placeholder={`Search ${active.label.toLowerCase()} by niche, city, service, industry, or name`}
            value={query}
          />
        </label>
        <button
          className={`inline-flex h-10 items-center justify-center gap-2 rounded-md border px-3 text-sm font-semibold transition ${verifiedOnly ? "border-emerald-500 bg-emerald-50 text-emerald-800 dark:border-emerald-500/60 dark:bg-emerald-950/40 dark:text-emerald-300" : "bg-card text-muted-foreground hover:bg-muted dark:border-white/8"}`}
          onClick={() => setVerifiedOnly((current) => !current)}
          type="button"
        >
          <ShieldCheck className="h-4 w-4" />
          Verified only
        </button>
      </div>

      {visibleItems.length ? (
        <div className="grid gap-3 md:grid-cols-3">
          {visibleItems.map((item) => {
            if (active.type === "creator") {
              const platform = active.platforms?.find((entry) => entry.creator_id === item.id);
              return <CreatorMarketCard creator={item} key={String(item.id)} platform={platform} />;
            }
            if (active.type === "freelancer") {
              return <FreelancerMarketCard freelancer={item} key={String(item.id)} />;
            }
            return <BrandMarketCard brand={item} key={String(item.id)} />;
          })}
        </div>
      ) : (
        <div className="rounded-md border bg-white p-4 text-sm text-muted-foreground dark:border-white/8 dark:bg-card">
          No profiles match this view yet. Try a different search or turn off verified-only.
        </div>
      )}
    </div>
  );
}

function isVerified(item: Record<string, unknown>) {
  return String(item.verification_status ?? "") === "verified" || ["verified", "performance"].includes(String(item.verification_tier ?? ""));
}
