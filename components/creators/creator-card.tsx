import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { getIndiaAudiencePercent } from "@/lib/utils/creator-metrics";
import { formatCurrency, formatNumber, formatPercent } from "@/lib/utils/format";
import type { Creator, CreatorPlatform } from "@/types";

export function CreatorCard({ creator, platform }: { creator: Creator; platform: CreatorPlatform }) {
  const estimatedRate = platform.platform === "YouTube" ? platform.avg_views * 38 : platform.avg_views * 45;

  return (
    <Link href={`/creators/${creator.id}`}>
      <Card className="h-full transition hover:-translate-y-0.5 hover:border-primary/50">
        <CardHeader>
          <div>
            <CardTitle>{creator.display_name}</CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">{creator.primary_niche}</p>
          </div>
          <Badge tone="green">{creator.monetization_score}/100</Badge>
        </CardHeader>
        <p className="mb-4 line-clamp-2 text-sm leading-6 text-muted-foreground">{creator.bio}</p>
        {/* City fit removed from marketplace cards — kept as an internal
            ranking dimension driven by the campaign's city_focus. */}
        <div className="grid grid-cols-2 gap-3 text-sm">
          <Stat label="Platform" value={platform.platform} />
          <Stat label="Followers" value={formatNumber(platform.followers)} />
          <Stat label="Avg views" value={formatNumber(platform.avg_views)} />
          <Stat label="India audience" value={formatPercent(getIndiaAudiencePercent(creator))} />
        </div>
        <div className="mt-4 rounded-md bg-muted p-3">
          <p className="text-xs text-muted-foreground">Estimated rate</p>
          <p className="text-lg font-bold">{formatCurrency(Math.round(estimatedRate), "inr")}</p>
        </div>
      </Card>
    </Link>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="font-semibold">{value}</p>
    </div>
  );
}
