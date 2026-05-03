import Link from "next/link";
import { MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

export function MessageRecipientButton({
  entityId,
  entityType,
  label = "Message",
  variant = "secondary",
  contextId,
  contextType
}: {
  entityId: string;
  entityType: "creator" | "freelancer" | "brand";
  label?: string;
  variant?: "primary" | "secondary" | "ghost";
  contextId?: string;
  contextType?: "deal" | "freelancer_project" | "campaign";
}) {
  const params = new URLSearchParams({ to_type: entityType, to_id: entityId });
  if (contextId && contextType) {
    params.set("context_type", contextType);
    params.set("context_id", contextId);
  }
  return (
    <Link href={`/messages?${params.toString()}`}>
      <Button size="sm" type="button" variant={variant}>
        <MessageCircle className="h-4 w-4" />
        {label}
      </Button>
    </Link>
  );
}
