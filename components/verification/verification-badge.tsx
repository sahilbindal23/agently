import { Badge } from "@/components/ui/badge";

export function VerificationBadge({ status, tier }: { status?: unknown; tier?: unknown }) {
  const level = String(tier ?? "");
  const value = String(status ?? "unverified");
  if (level === "performance") return <Badge tone="green">Performance verified</Badge>;
  if (level === "social") return <Badge tone="green">Social verified</Badge>;
  if (level === "profile") return <Badge tone="blue">Profile reviewed</Badge>;
  if (value === "reviewing") return <Badge tone="amber">Under review</Badge>;
  if (value === "rejected") return <Badge tone="red">Needs correction</Badge>;
  if (value === "verified") return <Badge tone="blue">Profile reviewed</Badge>;
  return <Badge tone="neutral">Unverified</Badge>;
}
