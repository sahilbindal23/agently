import { Badge } from "@/components/ui/badge";
import { socialTrustFromSource } from "@/lib/social/trust";

export function SocialTrustBadge({
  source,
  compact = false
}: {
  source?: string | null;
  compact?: boolean;
}) {
  const trust = socialTrustFromSource(source);
  const label = compact ? compactLabel(trust.label) : trust.label;
  return <Badge tone={trust.tone}>{label}</Badge>;
}

function compactLabel(label: string) {
  if (label.includes("YouTube Analytics")) return "YouTube verified";
  if (label.includes("Instagram API")) return "Instagram verified";
  if (label.includes("Facebook API")) return "Facebook verified";
  if (label.includes("Prototype")) return "Demo metrics";
  if (label.includes("Pending")) return "Pending review";
  if (label.includes("No creator")) return "No creator data";
  if (label.includes("Permission")) return "Permission needed";
  if (label.includes("Setup")) return "Setup needed";
  if (label.includes("Platform")) return "Platform metrics";
  return "Self-reported";
}
