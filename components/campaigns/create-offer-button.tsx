"use client";

import Link from "next/link";
import { Send } from "lucide-react";
import { Button } from "@/components/ui/button";

export function CreateOfferButton({
  campaignId,
  creatorId,
  className
}: {
  campaignId: string;
  creatorId: string;
  className?: string;
}) {
  return (
    <Link href={`/campaigns/${campaignId}/offer/${creatorId}`}>
      <Button className={className} size="sm" type="button">
        <Send className="h-4 w-4" />
        Compose offer
      </Button>
    </Link>
  );
}
