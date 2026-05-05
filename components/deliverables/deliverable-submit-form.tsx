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
  const [status, setStatus] = useState<"idle" | "saving" | "success" | "error">("idle");
  const [message, setMessage] = useState("");

  async function submit(formData: FormData) {
    setStatus("saving");
    setMessage("");
    try {
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

      setStatus("success");
      setMessage("Deliverable submitted for brand review.");
      router.refresh();
    } catch {
      setStatus("error");
      setMessage("Network error. Please try again.");
    }
  }

  if (status === "success") {
    return (
      <div className="rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm font-medium text-emerald-900 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-200">
        {message}
      </div>
    );
  }

  return (
    <form action={submit} className="space-y-3 rounded-md border bg-white p-3 dark:border-white/8 dark:bg-card">
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
      {message && status === "error" ? <p className="text-sm text-red-600 dark:text-red-400">{message}</p> : null}
    </form>
  );
}
