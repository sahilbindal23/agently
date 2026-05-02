"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";

export function OfferComposerForm({
  campaignId,
  creatorId,
  brandName,
  campaignTitle,
  campaignGoal,
  defaultAmountInr
}: {
  campaignId: string;
  creatorId: string;
  brandName: string;
  campaignTitle: string;
  campaignGoal: string;
  defaultAmountInr: number;
}) {
  const router = useRouter();
  const [status, setStatus] = useState<"idle" | "saving" | "error">("idle");
  const [message, setMessage] = useState("");

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    const amountInr = Number(formData.get("amount_inr") ?? 0);
    setStatus("saving");
    setMessage("");

    const response = await fetch("/api/deals", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        campaign_id: campaignId,
        creator_id: creatorId,
        brand_name: brandName,
        title: formData.get("title"),
        deliverables: formData.get("deliverables"),
        amount_cents: Math.round(amountInr * 100),
        due_date: formData.get("due_date"),
        campaign_goal: campaignGoal,
        notes: [
          formData.get("usage_rights") ? `Usage rights: ${formData.get("usage_rights")}` : "",
          formData.get("approval_terms") ? `Approval terms: ${formData.get("approval_terms")}` : "",
          formData.get("notes") ? `Brand notes: ${formData.get("notes")}` : ""
        ].filter(Boolean).join("\n")
      })
    });

    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      setStatus("error");
      setMessage(body.error ?? "Could not create offer.");
      return;
    }

    router.push("/deals");
    router.refresh();
  }

  return (
    <form className="grid gap-3 md:grid-cols-2" onSubmit={onSubmit}>
      <Input name="title" placeholder="Offer title" required defaultValue={campaignTitle} />
      <Input name="amount_inr" placeholder="Offer amount INR" type="number" min="1" required defaultValue={defaultAmountInr || ""} />
      <Input name="due_date" type="date" />
      <Input name="usage_rights" placeholder="Usage rights, e.g. 30 days organic usage" />
      <Textarea className="md:col-span-2" name="deliverables" placeholder="Deliverables, e.g. 1 Reel, 3 Stories, whitelisted ad usage" required />
      <Textarea className="md:col-span-2" name="approval_terms" placeholder="Approval and revision terms, e.g. 1 revision round, approval in 3 business days" />
      <Textarea className="md:col-span-2" name="notes" placeholder="Internal notes or brand context" />
      <Button className="md:col-span-2" disabled={status === "saving"}>
        <Send className="h-4 w-4" />
        {status === "saving" ? "Creating offer..." : "Submit offer to deal pipeline"}
      </Button>
      {message ? <p className={`md:col-span-2 text-sm ${status === "error" ? "text-red-600" : "text-emerald-700"}`}>{message}</p> : null}
    </form>
  );
}
