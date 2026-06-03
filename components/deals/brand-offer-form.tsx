"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { CAMPAIGN_GOALS } from "@/lib/taxonomies";
import type { Creator } from "@/types";

export function BrandOfferForm({ creators }: { creators: Creator[] }) {
  const router = useRouter();
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [message, setMessage] = useState("");

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("saving");
    setMessage("");

    const formData = new FormData(event.currentTarget);
    const amountInr = Number(formData.get("amount_inr") ?? 0);
    const payload = {
      ...Object.fromEntries(formData.entries()),
      amount_cents: Math.round(amountInr * 100)
    };

    const response = await fetch("/api/deals", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      setStatus("error");
      setMessage(body.error ?? "Could not submit INR offer.");
      return;
    }

    event.currentTarget.reset();
    setStatus("saved");
    setMessage("Brand offer submitted. It is now in the agency review pipeline.");
    router.refresh();
  }

  return (
    <form className="grid gap-3 md:grid-cols-2" onSubmit={onSubmit}>
      <Input name="brand_name" placeholder="Brand name" required />
      <Input name="brand_contact_email" placeholder="Brand contact email" type="email" required />
      <Input name="brand_website" placeholder="Brand website" />
      <Input name="brand_industry" placeholder="Brand industry" />
      <select name="creator_id" className="h-10 rounded-md border bg-white px-3 text-sm" required defaultValue="">
        <option value="" disabled>Select creator</option>
        {creators.map((creator) => (
          <option key={creator.id} value={creator.id}>{creator.display_name}</option>
        ))}
      </select>
      <Input name="amount_inr" placeholder="Offer amount in INR" type="number" min="1" required />
      <Input name="title" placeholder="Campaign title" required />
      <Input name="due_date" type="date" />
      <Textarea className="md:col-span-2" name="deliverables" placeholder="Requested deliverables" required />
      <Select className="md:col-span-2" name="campaign_goal" label="Primary campaign goal" options={CAMPAIGN_GOALS} placeholderOption="Pick the main goal" />
      <Button className="md:col-span-2" disabled={status === "saving"}>
        {status === "saving" ? "Submitting..." : "Submit brand offer"}
      </Button>
      {message ? (
        <p className={`md:col-span-2 text-sm ${status === "error" ? "text-red-600" : "text-emerald-700"}`}>
          {message}
        </p>
      ) : null}
    </form>
  );
}
