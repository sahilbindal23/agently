import { Badge } from "@/components/ui/badge";
import type { RiskLevel } from "@/types";

export function RiskBadge({ risk }: { risk: RiskLevel }) {
  const tone = risk === "safe" ? "green" : risk === "caution" ? "amber" : "red";
  return <Badge tone={tone}>{risk}</Badge>;
}
