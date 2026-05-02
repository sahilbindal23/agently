"use client";

import Link from "next/link";
import { Send } from "lucide-react";
import { Button } from "@/components/ui/button";

export function CreateFreelancerProjectButton({ campaignId, freelancerId }: { campaignId: string; freelancerId: string }) {
  return (
    <Link href={`/campaigns/${campaignId}/project/${freelancerId}`}>
      <Button size="sm" type="button">
        <Send className="h-4 w-4" />
        Compose project
      </Button>
    </Link>
  );
}
