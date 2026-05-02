"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";

export function FreelancerProjectComposerForm({
  campaignId,
  freelancerId,
  campaignTitle,
  defaultAmountInr
}: {
  campaignId: string;
  freelancerId: string;
  campaignTitle: string;
  defaultAmountInr: number;
}) {
  const router = useRouter();
  const [status, setStatus] = useState<"idle" | "saving" | "error">("idle");
  const [message, setMessage] = useState("");

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    setStatus("saving");
    setMessage("");

    const response = await fetch("/api/freelancer-projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        campaign_id: campaignId,
        freelancer_id: freelancerId,
        title: formData.get("title"),
        amount_inr: formData.get("amount_inr"),
        due_date: formData.get("due_date"),
        scope: formData.get("scope"),
        usage_context: formData.get("usage_context"),
        approval_terms: formData.get("approval_terms"),
        notes: formData.get("notes")
      })
    });

    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      setStatus("error");
      setMessage(body.error ?? "Could not create project.");
      return;
    }

    router.push("/campaigns");
    router.refresh();
  }

  return (
    <form className="grid gap-3 md:grid-cols-2" onSubmit={onSubmit}>
      <Input name="title" placeholder="Project title" required defaultValue={`${campaignTitle} production support`} />
      <Input name="amount_inr" placeholder="Project amount INR" type="number" min="1" required defaultValue={defaultAmountInr || ""} />
      <Input name="due_date" type="date" />
      <Input name="usage_context" placeholder="Usage context, e.g. paid ads, brand socials, internal edit" />
      <Textarea className="md:col-span-2" name="scope" placeholder="Project scope, e.g. shoot 10 reels, edit podcast clips, design thumbnails" required />
      <Textarea className="md:col-span-2" name="approval_terms" placeholder="Approval and revision terms" />
      <Textarea className="md:col-span-2" name="notes" placeholder="Brand notes or production context" />
      <Button className="md:col-span-2" disabled={status === "saving"}>
        <Send className="h-4 w-4" />
        {status === "saving" ? "Creating project..." : "Submit project offer"}
      </Button>
      {message ? <p className={`md:col-span-2 text-sm ${status === "error" ? "text-red-600" : "text-emerald-700"}`}>{message}</p> : null}
    </form>
  );
}
