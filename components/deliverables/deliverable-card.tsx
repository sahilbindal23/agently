import Link from "next/link";
import { ExternalLink } from "lucide-react";
import { DeliverableReviewActions } from "@/components/deliverables/deliverable-review-actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { Deliverable } from "@/types";

export function DeliverableCard({
  deliverable,
  canReview = false
}: {
  deliverable?: Deliverable | null;
  canReview?: boolean;
}) {
  if (!deliverable) {
    return (
      <div className="rounded-md border bg-muted p-3">
        <p className="text-sm font-semibold">No deliverable submitted yet</p>
        <p className="mt-1 text-sm leading-6 text-muted-foreground">Once the talent submits a URL or asset link, it will show here for review.</p>
      </div>
    );
  }

  return (
    <div className="rounded-md border bg-white p-3">
      <div className="mb-2 flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold">{deliverable.title || "Submitted deliverable"}</p>
          <p className="mt-1 text-xs text-muted-foreground">{deliverable.platform || "Asset link"}</p>
        </div>
        <Badge tone={deliverable.status === "approved" ? "green" : deliverable.status === "revision_requested" ? "amber" : "blue"}>
          {deliverable.status}
        </Badge>
      </div>
      <p className="text-sm leading-6 text-muted-foreground">{deliverable.notes || "No talent notes added."}</p>
      <div className="mt-3">
        <Link href={deliverable.content_url} target="_blank">
          <Button type="button" variant="secondary" size="sm">
            <ExternalLink className="h-4 w-4" />
            Open deliverable
          </Button>
        </Link>
      </div>
      {deliverable.review_notes ? (
        <div className="mt-3 rounded-md bg-muted p-3">
          <p className="text-xs font-semibold uppercase text-muted-foreground">Review notes</p>
          <p className="mt-1 text-sm leading-6">{deliverable.review_notes}</p>
        </div>
      ) : null}
      {canReview && deliverable.status === "submitted" ? (
        <div className="mt-3">
          <DeliverableReviewActions deliverableId={deliverable.id} />
        </div>
      ) : null}
    </div>
  );
}
