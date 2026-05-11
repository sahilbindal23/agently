import { Badge } from "@/components/ui/badge";
import { socialTrustFromSource } from "@/lib/social/trust";

export function SocialTrustBadge({
  source,
  compact = false
}: {
  source?: string | null;
  /** Kept for backwards compatibility with existing call sites. Labels are
   * now uniformly short, so this no longer changes anything. */
  compact?: boolean;
}) {
  void compact;
  const trust = socialTrustFromSource(source);
  if (!trust.label) return null;
  return <Badge tone={trust.tone}>{trust.label}</Badge>;
}
