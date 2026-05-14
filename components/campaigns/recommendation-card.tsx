import Link from "next/link";
import { CreateOfferButton } from "@/components/campaigns/create-offer-button";
import { CreateFreelancerProjectButton } from "@/components/campaigns/create-freelancer-project-button";
import { RemoveShortlistButton } from "@/components/campaigns/remove-shortlist-button";
import { ShortlistButton } from "@/components/campaigns/shortlist-button";
import { MessageRecipientButton } from "@/components/messages/message-recipient-button";
import { SocialTrustBadge } from "@/components/social/social-trust-badge";
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
  const strongestSignals = scoreHighlights(item.score_breakdown).slice(0, 2);
  const reviewSignals = scoreLows(item.score_breakdown).slice(0, 2);
  const profileHref = type === "creator" ? `/creators/${item.id}` : `/freelancers/${item.id}`;
  const primaryMetric = type === "creator"
    ? `${formatNumber(item.roi_estimate.expected_reach)} reach`
    : `${formatCurrency(item.roi_estimate.estimated_cpe_cents, "inr")} unit cost`;
  const secondaryMetric = type === "creator"
    ? `${formatCurrency(item.roi_estimate.estimated_cpm_cents, "inr")} CPM`
    : `${Math.round(item.roi_estimate.confidence_score * 100)}% confidence`;

  return (
    <div className="rounded-lg border bg-card p-4 shadow-sm dark:border-white/8">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex min-w-0 gap-3">
          <Link href={profileHref} className="shrink-0">
            <RecommendationImage src={item.image_url ?? ""} label={item.name} />
          </Link>
          <div className="min-w-0">
            <Link href={profileHref} className="font-semibold text-foreground transition hover:text-primary">
              {item.name}
            </Link>
            <p className="mt-1 line-clamp-1 text-xs text-muted-foreground">{item.subtitle}</p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <Badge tone={item.score >= 80 ? "green" : item.score >= 60 ? "amber" : "neutral"}>{item.score} fit</Badge>
              <Badge tone={item.risk_level === "low" ? "green" : item.risk_level === "medium" ? "amber" : "red"}>{item.risk_level} risk</Badge>
              {type === "creator" ? <SocialTrustBadge source={item.metric_source} compact /> : null}
            </div>
          </div>
        </div>
        <div className="grid shrink-0 grid-cols-2 gap-2 text-right sm:min-w-52">
          <CompactMetric label={type === "creator" ? "Reach" : "Cost"} value={primaryMetric} />
          <CompactMetric label={type === "creator" ? "CPM" : "Confidence"} value={secondaryMetric} />
        </div>
      </div>

      <div className="mt-4 rounded-md border bg-muted/50 p-3 dark:border-white/8">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase text-muted-foreground">Why this match</p>
            <p className="mt-1 line-clamp-2 text-sm leading-6">{item.reason}</p>
          </div>
          <Badge tone="blue">{item.match_type}</Badge>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <Badge tone="green">{strongestSignals[0]?.label ?? "Fit"} {strongestSignals[0]?.value ?? item.score}</Badge>
        <Badge tone={reviewSignals[0]?.value < 55 ? "amber" : "blue"}>{reviewSignals[0]?.label ?? "Review"} {reviewSignals[0]?.value ?? item.score}</Badge>
        {item.watchouts.slice(0, 2).map((watchout) => <Badge key={watchout} tone="amber">{watchout}</Badge>)}
      </div>

      <details className="mt-3 rounded-md border bg-background/50 p-3 dark:border-white/8 dark:bg-white/[0.03]">
        <summary className="cursor-pointer text-sm font-semibold text-primary">View ranking details</summary>
        <div className="mt-3 grid gap-3 lg:grid-cols-2">
          <div>
            <p className="text-xs font-semibold uppercase text-muted-foreground">Best use</p>
            <p className="mt-1 text-sm leading-6">{item.best_use_case}</p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase text-muted-foreground">Expected outcome</p>
            <p className="mt-1 text-sm leading-6">{item.expected_outcome}</p>
          </div>
        </div>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <SignalGroup title="Strongest signals" tone="green" metrics={strongestSignals} />
          <SignalGroup title="Needs review" tone="amber" metrics={reviewSignals} />
        </div>
        <div className="mt-3 rounded-md bg-muted p-3">
          <p className="text-xs font-semibold uppercase text-muted-foreground">Verified signals</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {item.proof_points.map((point) => <Badge key={point} tone="blue">{point}</Badge>)}
          </div>
        </div>
        {item.marketplace_signals?.length ? (
          <div className="mt-3 rounded-md border bg-emerald-50/70 p-3 dark:border-emerald-900/50 dark:bg-emerald-950/30">
            <p className="text-xs font-semibold uppercase text-emerald-800 dark:text-emerald-400">Marketplace behavior</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {item.marketplace_signals.map((signal) => <Badge key={signal} tone="green">{signal}</Badge>)}
            </div>
          </div>
        ) : null}
      </details>

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
    <span className="relative block h-14 w-14 shrink-0 isolate overflow-hidden rounded-xl bg-muted ring-1 ring-border dark:ring-white/10">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        alt={label}
        className="absolute inset-0 h-full w-full rounded-xl object-cover [backface-visibility:hidden] [image-rendering:auto] [transform:translateZ(0)]"
        decoding="async"
        draggable={false}
        src={src}
      />
      <span className="pointer-events-none absolute inset-0 rounded-xl ring-1 ring-inset ring-black/5 dark:ring-white/10" />
    </span>
  ) : (
    <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-muted text-lg font-bold text-muted-foreground ring-1 ring-border dark:ring-white/10">
      {label.slice(0, 1)}
    </div>
  );
}

function CompactMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border bg-background/60 px-3 py-2 dark:border-white/8 dark:bg-white/[0.03]">
      <p className="text-[10px] font-semibold uppercase text-muted-foreground">{label}</p>
      <p className="mt-1 text-sm font-semibold">{value}</p>
    </div>
  );
}

function SignalGroup({
  title,
  metrics,
  tone
}: {
  title: string;
  metrics: ReturnType<typeof scoreHighlights>;
  tone: "green" | "amber";
}) {
  return (
    <div className="rounded-md bg-muted p-3">
      <p className="text-xs font-semibold uppercase text-muted-foreground">{title}</p>
      <div className="mt-2 space-y-2">
        {metrics.map((metric) => (
          <div className="flex items-start justify-between gap-3" key={`${title}-${metric.key}`}>
            <div>
              <p className="text-sm font-medium">{metric.label}</p>
              <p className="text-xs leading-5 text-muted-foreground">{metric.copy}</p>
            </div>
            <Badge tone={tone}>{metric.value}</Badge>
          </div>
        ))}
      </div>
    </div>
  );
}

function scoreHighlights(score: CampaignRecommendation["score_breakdown"]) {
  return scoreEntries(score).sort((a, b) => b.value - a.value);
}

function scoreLows(score: CampaignRecommendation["score_breakdown"]) {
  return scoreEntries(score).sort((a, b) => a.value - b.value);
}

function scoreEntries(score: CampaignRecommendation["score_breakdown"]) {
  return [
    { key: "category_fit", label: "Category", value: score.category_fit, copy: "How closely the niche or service maps to the brief." },
    { key: "audience_fit", label: "Audience", value: score.audience_fit, copy: "How well the talent can reach the requested audience." },
    { key: "city_fit", label: "Location", value: score.city_fit, copy: "How well the creator's home city and audience cities match this campaign's city focus." },
    { key: "budget_fit", label: "Budget", value: score.budget_fit, copy: "Whether the budget is realistic for the expected work." },
    { key: "data_confidence", label: "Confidence", value: score.data_confidence, copy: "How much Agently trusts the available data." },
    { key: "platform_fit", label: "Platform", value: score.platform_fit, copy: "Fit against requested creator channels or production format." },
    { key: "language_fit", label: "Language", value: score.language_fit, copy: "Language overlap with the campaign market." }
  ];
}
