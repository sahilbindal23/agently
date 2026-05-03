"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";

export function MessageComposer({
  recipientId,
  recipientType,
  threadId
}: {
  recipientId?: string;
  recipientType?: string;
  threadId?: string;
}) {
  const router = useRouter();
  const [body, setBody] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "error">("idle");

  async function send() {
    if (!body.trim()) return;
    setStatus("sending");
    const response = await fetch("/api/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        body,
        thread_id: threadId,
        to_id: recipientId,
        to_type: recipientType
      })
    });

    const payload = await response.json();
    if (!response.ok) {
      setStatus("error");
      return;
    }

    setBody("");
    setStatus("idle");
    router.push(`/messages?thread=${payload.thread_id}`);
    router.refresh();
  }

  return (
    <div className="space-y-3">
      <Textarea
        placeholder="Write a message about campaign fit, pricing, deliverables, availability, or next steps."
        value={body}
        onChange={(event) => setBody(event.target.value)}
      />
      <div className="flex items-center justify-between gap-3">
        {status === "error" ? <p className="text-sm text-destructive">Could not send message.</p> : <p className="text-sm text-muted-foreground">Messages are saved to the prototype inbox.</p>}
        <Button disabled={status === "sending" || !body.trim()} onClick={send} type="button">
          <Send className="h-4 w-4" />
          {status === "sending" ? "Sending..." : "Send"}
        </Button>
      </div>
    </div>
  );
}
