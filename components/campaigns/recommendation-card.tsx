import { CreateOfferButton } from "@/components/campaigns/create-offer-button";
import { CreateFreelancerProjectButton } from "@/components/campaigns/create-freelancer-project-button";
import { RemoveShortlistButton } from "@/components/campaigns/remove-shortlist-button";
import { ShortlistButton } from "@/components/campaigns/shortlist-button";
import { MessageRecipientButton } from "@/components/messages/message-recipient-button";
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
        <div className="flex min-w-0 gap-3">
          <RecommendationImage src={item.image_url ?? ""} label={item.name} />
          <div className="min-w-0">
            <p className="font-semibold">{item.name}</p>
            <p className="mt-1 text-xs text-muted-foreground">{item.subtitle}</p>
          </div>
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

      <div className="mt-3 rounded-md border bg-white p-3">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs font-semibold uppercase text-muted-foreground">Score composition</p>
          <Badge tone="blue">{scoreLabel(item.score)}</Badge>
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          {scoreHighlights(item.score_breakdown).map((metric) => (
            <div className="rounded-md bg-muted px-3 py-2" key={metric.key}>
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-medium">{metric.label}</p>
                <Badge tone={metric.value >= 75 ? "green" : metric.value >= 55 ? "amber" : "neutral"}>{metric.value}</Badge>
              </div>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">{metric.copy}</p>
            </div>
          ))}
        </div>
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
        {isShortlisted ? <RemoveShortlistButton campaignId={campaignId} entityId={item.id} entityType={type} label="Unshortlist" /> : (
          <ShortlistButton campaignId={campaignId} entityId={item.id} entityType={type} fitScore={item.score} reason={item.reason} />
        )}
        <MessageRecipientButton entityId={item.id} entityType={type} label="Message" />
        {type === "creator" ? <CreateOfferButton campaignId={campaignId} creatorId={item.id} /> : <CreateFreelancerProjectButton campaignId={campaignId} freelancerId={item.id} />}
      </div>
    </div>
  );
}

function RecommendationImage({ src, label }: { src: string; label: string }) {
  return src ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img alt={label} className="h-14 w-14 shrink-0 rounded-md object-cover" src={src} />
  ) : (
    <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-md bg-muted text-lg font-bold text-muted-foreground">
      {label.slice(0, 1)}
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

function scoreLabel(score: number) {
  if (score >= 82) return "strong match";
  if (score >= 65) return "usable match";
  return "needs review";
}

function scoreHighlights(score: CampaignRecommendation["score_breakdown"]) {
  const entries = [
    { key: "category_fit", label: "Category", value: score.category_fit, copy: "How closely the niche or service maps to the brief." },
    { key: "audience_fit", label: "Audience", value: score.audience_fit, copy: "How well the talent can reach the requested audience." },
    { key: "city_fit", label: "City", value: score.city_fit, copy: "Bangalore and India relevance for this campaign." },
    { key: "budget_fit", label: "Budget", value: score.budget_fit, copy: "Whether the budget is realistic for the expected work." },
    { key: "data_confidence", label: "Confidence", value: score.data_confidence, copy: "How much Agently trusts the available data." },
    { key: "platform_fit", label: "Platform", value: score.platform_fit, copy: "Fit against requested creator channels or production format." },
    { key: "language_fit", label: "Language", value: score.language_fit, copy: "Language overlap with the campaign market." }
  ];

  const strongest = [...entries].sort((a, b) => b.value - a.value).slice(0, 2);
  const weakest = [...entries].sort((a, b) => a.value - b.value).slice(0, 2);
  return [...strongest, ...weakest].filter((item, index, list) => list.findIndex((entry) => entry.key === item.key) === index).slice(0, 4);
}
