import { Badge } from "@/components/ui/badge";
import type { PaymentStatus } from "@/types";

export function PaymentStatusBadge({ status }: { status: PaymentStatus }) {
  const tone = status === "funded" || status === "release_ready" || status === "released" ? "green" : status === "disputed" || status === "refunded" ? "red" : status === "pending" ? "amber" : "neutral";
  return <Badge tone={tone}>{status}</Badge>;
}
