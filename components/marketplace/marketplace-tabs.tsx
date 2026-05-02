"use client";

import { useState } from "react";
import { CreatorMarketCard, FreelancerMarketCard, BrandMarketCard } from "@/components/marketplace/marketplace-cards";

type TabItem =
  | { id: string; label: string; type: "creator"; items: Array<Record<string, unknown>>; platforms?: Array<Record<string, unknown>> }
  | { id: string; label: string; type: "freelancer"; items: Array<Record<string, unknown>> }
  | { id: string; label: string; type: "brand"; items: Array<Record<string, unknown>> };

export function MarketplaceTabs({ tabs }: { tabs: TabItem[] }) {
  const [activeId, setActiveId] = useState(tabs[0]?.id ?? "");
  const active = tabs.find((tab) => tab.id === activeId) ?? tabs[0];

  if (!active) return null;

  return (
    <div>
      <div className="mb-4 flex gap-1 overflow-x-auto border-b">
        {tabs.map((tab) => (
          <button
            className={`rounded-t-md border border-b-0 px-4 py-2 text-sm font-medium transition ${active.id === tab.id ? "bg-white text-foreground" : "bg-muted/60 text-muted-foreground hover:bg-white"}`}
            key={tab.id}
            onClick={() => setActiveId(tab.id)}
            type="button"
          >
            {tab.label}
          </button>
        ))}
      </div>

      {active.items.length ? (
        <div className="grid gap-3 md:grid-cols-3">
          {active.items.map((item) => {
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
        <div className="rounded-md border bg-white p-4 text-sm text-muted-foreground">
          No profiles available yet.
        </div>
      )}
    </div>
  );
}
