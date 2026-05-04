"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";

export function NotificationActions({ notificationId }: { notificationId?: string }) {
  const router = useRouter();
  const [status, setStatus] = useState<"idle" | "saving">("idle");

  async function update(action: "read" | "dismiss" | "read_all") {
    setStatus("saving");
    await fetch("/api/notifications/read", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, notification_id: notificationId })
    });
    setStatus("idle");
    router.refresh();
  }

  if (!notificationId) {
    return (
      <Button disabled={status === "saving"} onClick={() => update("read_all")} size="sm" type="button" variant="secondary">
        <Check className="h-4 w-4" />
        Mark all read
      </Button>
    );
  }

  return (
    <div className="flex gap-1">
      <Button disabled={status === "saving"} onClick={() => update("read")} size="sm" type="button" variant="secondary" title="Mark read">
        <Check className="h-4 w-4" />
      </Button>
      <Button disabled={status === "saving"} onClick={() => update("dismiss")} size="sm" type="button" variant="secondary" title="Dismiss">
        <X className="h-4 w-4" />
      </Button>
    </div>
  );
}
