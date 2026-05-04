import { BarChart3, LockKeyhole, TrendingUp } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import type { ConnectedAccountRow, SocialSnapshotRow } from "@/components/social/connected-accounts-panel";

export function ScoreTransparencyCard({
  accounts,
  profile,
  snapshots
}: {
  accounts: ConnectedAccountRow[];
  profile: Record<string, unknown>;
  snapshots: SocialSnapshotRow[];
}) {
  const synced = snapshots.length > 0;
  const confidence = getConfidenceLabel(accounts.length, snapshots.length);
  const sourceTone = synced ? "green" : accounts.length ? "amber" : "neutral";
  const indiaAudience = Number(profile.india_audience_percent ?? 0);
  const monetization = Number(profile.monetization_score ?? 0);
  const valuation = Number(profile.valuation_score ?? 0);

  return (
    <Card className="mb-5">
      <CardHeader>
        <div>
          <CardTitle>Score Transparency</CardTitle>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">
            Agently calculates core marketplace scores from connected data and platform review. You can improve the inputs, but you cannot manually inflate the scores.
          </p>
        </div>
        <Badge tone={sourceTone}>{confidence}</Badge>
      </CardHeader>

      <div className="grid gap-3 md:grid-cols-3">
        <ScoreSignal label="India audience" value={`${indiaAudience || "Not enough data"}${indiaAudience ? "%" : ""}`} source={synced ? "API-derived" : "fallback"} />
        <ScoreSignal label="Monetization" value={`${monetization || 0}/100`} source={synced ? "synced metrics" : "profile fallback"} />
        <ScoreSignal label="Valuation" value={`${valuation || 0}/100`} source={synced ? "synced metrics" : "profile fallback"} />
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-[1fr_1fr]">
        <div className="rounded-md border bg-white p-4">
          <div className="mb-3 flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-primary" />
            <p className="text-sm font-semibold">What Agently Uses</p>
          </div>
          <div className="space-y-2">
            {scoreSources(accounts, snapshots).map((item) => (
              <div className="flex items-center justify-between gap-3 rounded-md bg-muted px-3 py-2 text-sm" key={item.label}>
                <span>{item.label}</span>
                <Badge tone={item.tone}>{item.status}</Badge>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-md border bg-white p-4">
          <div className="mb-3 flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-primary" />
            <p className="text-sm font-semibold">How To Improve Scores</p>
          </div>
          <div className="space-y-2">
            {improvementActions(accounts.length, snapshots.length).map((item) => (
              <div className="rounded-md bg-muted px-3 py-2 text-sm leading-5" key={item}>{item}</div>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-4 flex gap-2 rounded-md border bg-slate-50 p-3 text-sm leading-6 text-muted-foreground">
        <LockKeyhole className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
        <p>
          Creator-editable fields like niche, languages, content style, and profile links help Agently understand context. Core trust scores stay platform-controlled so brands are not relying on manually inflated claims.
        </p>
      </div>
    </Card>
  );
}

function ScoreSignal({ label, source, value }: { label: string; source: string; value: string }) {
  return (
    <div className="rounded-md border bg-white p-3">
      <p className="text-xs font-semibold uppercase text-muted-foreground">{label}</p>
      <p className="mt-1 text-xl font-bold">{value}</p>
      <p className="mt-1 text-xs text-muted-foreground">{source}</p>
    </div>
  );
}

function scoreSources(accounts: ConnectedAccountRow[], snapshots: SocialSnapshotRow[]) {
  return [
    { label: "Connected accounts", status: accounts.length ? `${accounts.length} connected` : "missing", tone: accounts.length ? "green" as const : "amber" as const },
    { label: "Latest metric snapshots", status: snapshots.length ? `${snapshots.length} synced` : "not synced", tone: snapshots.length ? "green" as const : "amber" as const },
    { label: "Audience geography", status: snapshots.some((item) => item.india_audience_percent > 0) ? "verified" : "fallback", tone: snapshots.some((item) => item.india_audience_percent > 0) ? "green" as const : "neutral" as const },
    { label: "Bangalore relevance", status: snapshots.some((item) => item.bangalore_audience_percent > 0) ? "verified" : "inferred", tone: snapshots.some((item) => item.bangalore_audience_percent > 0) ? "green" as const : "blue" as const },
    { label: "Engagement quality", status: snapshots.some((item) => item.engagement_rate_30d > 0) ? "verified" : "fallback", tone: snapshots.some((item) => item.engagement_rate_30d > 0) ? "green" as const : "neutral" as const }
  ];
}

function improvementActions(accountCount: number, snapshotCount: number) {
  const actions = [
    accountCount === 0 ? "Connect Instagram, Facebook, or YouTube so Agently can verify your audience and engagement." : "",
    snapshotCount === 0 ? "Run a sync after connecting accounts so your scores use platform metrics instead of fallback profile data." : "",
    "Keep social links, niche, languages, and top cities accurate so matching context stays clean.",
    "Improve real engagement and average views; those lift valuation more than manually edited profile claims.",
    "Complete brand work through Agently so future scores can use closed deal and delivery outcomes."
  ];
  return actions.filter(Boolean);
}

function getConfidenceLabel(accountCount: number, snapshotCount: number) {
  if (snapshotCount >= 2) return "high confidence";
  if (snapshotCount >= 1) return "verified signals";
  if (accountCount >= 1) return "sync needed";
  return "self-reported fallback";
}
