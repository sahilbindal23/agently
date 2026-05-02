"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";

type EntityType = "deal" | "freelancer_project";

export function DeliverableSubmitForm({
  entityId,
  entityType,
  label = "Submit deliverable"
}: {
  entityId: string;
  entityType: EntityType;
  label?: string;
}) {
  const router = useRouter();
  const [status, setStatus] = useState<"idle" | "saving" | "error">("idle");
  const [message, setMessage] = useState("");

  async function submit(formData: FormData) {
    setStatus("saving");
    setMessage("");
    const response = await fetch("/api/deliverables", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        entity_id: entityId,
        entity_type: entityType,
        title: formData.get("title"),
        platform: formData.get("platform"),
        content_url: formData.get("content_url"),
        notes: formData.get("notes")
      })
    });

    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      setStatus("error");
      setMessage(body.error ?? "Could not submit deliverable.");
      return;
    }

    setStatus("idle");
    setMessage("Deliverable submitted for review.");
    router.refresh();
  }

  return (
    <form action={submit} className="space-y-3 rounded-md border bg-white p-3">
      <p className="text-sm font-semibold">{label}</p>
      <div className="grid gap-3 md:grid-cols-2">
        <Input name="title" placeholder="Deliverable title" />
        <Input name="platform" placeholder="Platform or asset type" />
      </div>
      <Input name="content_url" placeholder="URL to draft, post, Drive folder, portfolio file, or asset link" required />
      <Textarea name="notes" placeholder="Notes for review, context, or anything the brand should check" />
      <Button disabled={status === "saving"} type="submit">
        <Send className="h-4 w-4" />
        {status === "saving" ? "Submitting..." : "Submit for review"}
      </Button>
      {message ? <p className={`text-sm ${status === "error" ? "text-red-600" : "text-emerald-700"}`}>{message}</p> : null}
    </form>
  );
}
