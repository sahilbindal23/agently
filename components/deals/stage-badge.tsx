import { Badge } from "@/components/ui/badge";
import type { DealStage } from "@/types";

export function StageBadge({ stage }: { stage: DealStage }) {
  const tone = stage === "paid" || stage === "approved" ? "green" : stage === "disputed" ? "red" : stage === "negotiating" ? "amber" : "neutral";
  return <Badge tone={tone}>{stage}</Badge>;
}
