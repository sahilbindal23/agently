import { Badge } from "@/components/ui/badge";

// Two-tier verification model:
//   verified   → Agently confirmed the profile (Phyllo Connect, admin
//                review, or any non-unverified legacy tier value)
//   unverified → nothing yet
// Plus transient states (reviewing, rejected) for in-flight admin work.
//
// Legacy DB values "performance" / "social" / "profile" all map to
// "verified" — we don't backfill, the helper below just normalises.
export function VerificationBadge({ status, tier }: { status?: unknown; tier?: unknown }) {
  const level = String(tier ?? "");
  const value = String(status ?? "unverified");
  if (value === "reviewing" || level === "reviewing") return <Badge tone="amber">Under review</Badge>;
  if (value === "rejected" || level === "rejected") return <Badge tone="red">Needs correction</Badge>;
  if (isVerifiedLevel(level, value)) return <Badge tone="green">Verified by Agently</Badge>;
  return <Badge tone="neutral">Unverified</Badge>;
}

function isVerifiedLevel(tier: string, status: string) {
  if (status === "verified") return true;
  if (!tier || tier === "unverified") return false;
  return true; // any legacy tier value other than "unverified" counts as verified
}
