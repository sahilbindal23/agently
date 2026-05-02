import { CreateOfferButton } from "@/components/campaigns/create-offer-button";
import { CreateFreelancerProjectButton } from "@/components/campaigns/create-freelancer-project-button";
import { ShortlistButton } from "@/components/campaigns/shortlist-button";
import { Badge } from "@/components/ui/badge";
import { formatCurrency, formatNumber } from "@/lib/utils/format";
import type { CampaignRecommendation } from "@/lib/campaigns/recommendations";

export function RecommendationCard({
  campaignId,
  item,
  isShortlisted,
  type
}: {
  campaignId: string;
  item: CampaignRecommendation;
  isShortlisted: boolean;
  type: "creator" | "freelancer";
}) {
  return (
    <div className="rounded-md border bg-white p-4">
      <div className="mb-2 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-semibold">{item.name}</p>
          <p className="mt-1 text-xs text-muted-foreground">{item.subtitle}</p>
        </div>
        <Badge tone={item.score >= 80 ? "green" : item.score >= 60 ? "amber" : "neutral"}>{item.score}</Badge>
      </div>
      <p className="text-sm leading-6 text-muted-foreground">{item.reason}</p>

      <div className="mt-3 grid gap-2 sm:grid-cols-3">
        <DecisionBlock label="Match type" value={item.match_type} />
        <DecisionBlock label="Risk" value={item.risk_level} tone={item.risk_level === "low" ? "green" : item.risk_level === "medium" ? "amber" : "red"} />
        <DecisionBlock label="Best use" value={item.best_use_case} />
      </div>

      <div className="mt-3 rounded-md border bg-sky-50/60 p-3">
        <p className="text-xs font-semibold uppercase text-sky-800">Expected outcome</p>
        <p className="mt-1 text-sm leading-6 text-sky-950">{item.expected_outcome}</p>
      </div>

      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        {Object.entries(item.score_breakdown).map(([key, value]) => (
          <div className="rounded-md bg-muted p-2" key={key}>
            <p className="text-[11px] font-semibold uppercase text-muted-foreground">{key.replaceAll("_", " ")}</p>
            <div className="mt-1 h-1.5 rounded-full bg-white">
              <div className="h-1.5 rounded-full bg-primary" style={{ width: `${Math.min(100, Math.max(0, value))}%` }} />
            </div>
            <p className="mt-1 text-xs font-semibold">{value}/100</p>
          </div>
        ))}
      </div>

      <div className="mt-3 rounded-md border bg-white p-3">
        <p className="text-xs font-semibold uppercase text-muted-foreground">{type === "creator" ? "Early ROI estimate" : "Production value estimate"}</p>
        <div className="mt-2 grid gap-2 sm:grid-cols-3">
          <MiniMetric label={type === "creator" ? "Reach" : "Reach"} value={type === "creator" ? formatNumber(item.roi_estimate.expected_reach) : "N/A"} />
          <MiniMetric label={type === "creator" ? "Engagements" : "Est. unit cost"} value={type === "creator" ? formatNumber(item.roi_estimate.expected_engagements) : formatCurrency(item.roi_estimate.estimated_cpe_cents, "inr")} />
          <MiniMetric label={type === "creator" ? "CPM" : "Confidence"} value={type === "creator" ? formatCurrency(item.roi_estimate.estimated_cpm_cents, "inr") : `${Math.round(item.roi_estimate.confidence_score * 100)}%`} />
        </div>
      </div>

      {item.watchouts.length ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {item.watchouts.map((watchout) => <Badge key={watchout} tone="amber">{watchout}</Badge>)}
        </div>
      ) : null}

      <div className="mt-3 rounded-md bg-muted p-3">
        <p className="text-xs font-semibold uppercase text-muted-foreground">Proof Agently used</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {item.proof_points.map((point) => <Badge key={point} tone="blue">{point}</Badge>)}
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        {isShortlisted ? <Badge tone="blue">shortlisted</Badge> : (
          <ShortlistButton campaignId={campaignId} entityId={item.id} entityType={type} fitScore={item.score} reason={item.reason} />
        )}
        {type === "creator" ? <CreateOfferButton campaignId={campaignId} creatorId={item.id} /> : <CreateFreelancerProjectButton campaignId={campaignId} freelancerId={item.id} />}
      </div>
    </div>
  );
}

function DecisionBlock({ label, value, tone = "blue" }: { label: string; value: string; tone?: "blue" | "green" | "amber" | "red" }) {
  const compact = value.length < 28;
  return (
    <div className="rounded-md border bg-white p-3">
      <p className="text-[11px] font-semibold uppercase text-muted-foreground">{label}</p>
      <div className="mt-2">
        {compact ? <Badge tone={tone}>{value}</Badge> : <p className="text-sm leading-5">{value}</p>}
      </div>
    </div>
  );
}

function MiniMetric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[11px] uppercase text-muted-foreground">{label}</p>
      <p className="text-sm font-semibold">{value}</p>
    </div>
  );
}
