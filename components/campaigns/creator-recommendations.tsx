"use client";

import { useMemo, useState } from "react";
import { RecommendationCard } from "@/components/campaigns/recommendation-card";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import type { CampaignRecommendation } from "@/lib/campaigns/recommendations";
import type { Campaign, CampaignShortlist } from "@/types";

type TrustFilter = "all" | "verified";

// Client-side filter for the creator recommendations column. Replaces
// the previous URL-param round-trip — every toggle used to re-fetch
// getAgentlyData + re-run rankCreators + persist a fresh
// recommendation snapshot, which made the filter feel sluggish. The
// full ranked list now lives in state on this client component and
// the toggle filters in memory.
//
// A creator is treated as "verified" if EITHER:
//   - Their metrics come from a trusted platform source (api_synced)
//   - They have an Agently-verified profile (verified_profile)
// The previous gate accepted only api_synced, which hid admin-verified
// creators who hadn't completed Phyllo sync yet.
export function CreatorRecommendations({
  campaign,
  recommendations,
  shortlists
}: {
  campaign: Campaign;
  recommendations: CampaignRecommendation[];
  shortlists: CampaignShortlist[];
}) {
  const [filter, setFilter] = useState<TrustFilter>("all");

  const visible = useMemo(() => {
    if (filter === "all") return recommendations;
    return recommendations.filter((item) =>
      item.trust_source === "api_synced" || item.trust_source === "verified_profile"
    );
  }, [filter, recommendations]);

  const verifiedCount = useMemo(
    () => recommendations.filter((item) =>
      item.trust_source === "api_synced" || item.trust_source === "verified_profile"
    ).length,
    [recommendations]
  );

  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>Recommended Creators</CardTitle>
          <p className="mt-1 text-sm text-muted-foreground">
            Toggle to show only creators with verified profiles or synced platform metrics.
          </p>
        </div>
        <Badge tone="green">{visible.length}</Badge>
      </CardHeader>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <FilterButton active={filter === "all"} onClick={() => setFilter("all")}>
          All eligible ({recommendations.length})
        </FilterButton>
        <FilterButton active={filter === "verified"} onClick={() => setFilter("verified")}>
          Verified only ({verifiedCount})
        </FilterButton>
      </div>

      {filter === "verified" && visible.length === 0 ? (
        <p className="mb-3 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm leading-6 text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-200">
          No verified creators match this brief yet. Switch to all eligible or ask shortlisted talent to connect their Instagram, Facebook, or YouTube for verification.
        </p>
      ) : null}

      <div className="space-y-3">
        {visible.map((item) => {
          const isShortlisted = shortlists.some(
            (shortlist) =>
              shortlist.campaign_id === campaign.id &&
              shortlist.entity_type === "creator" &&
              shortlist.entity_id === item.id
          );
          return (
            <RecommendationCard
              campaignId={campaign.id}
              isShortlisted={isShortlisted}
              item={item}
              key={item.id}
              type="creator"
            />
          );
        })}
      </div>
    </Card>
  );
}

function FilterButton({
  active,
  children,
  onClick
}: {
  active: boolean;
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex h-9 items-center rounded-md border px-3 text-sm font-medium transition ${
        active
          ? "border-primary bg-primary text-primary-foreground"
          : "bg-white hover:bg-muted dark:bg-card dark:border-white/8 dark:hover:bg-muted"
      }`}
    >
      {children}
    </button>
  );
}
