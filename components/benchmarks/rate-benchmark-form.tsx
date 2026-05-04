"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";

export function RateBenchmarkForm() {
  const router = useRouter();
  const [status, setStatus] = useState<"idle" | "saving" | "error">("idle");
  const [message, setMessage] = useState("");

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("saving");
    setMessage("");
    const form = event.currentTarget;
    const formData = new FormData(form);
    const payload = Object.fromEntries(formData.entries());

    const response = await fetch("/api/rate-benchmarks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      setStatus("error");
      setMessage(body.error ?? "Could not save benchmark.");
      return;
    }

    form.reset();
    setStatus("idle");
    setMessage("Benchmark saved.");
    router.refresh();
  }

  return (
    <form className="grid gap-3 md:grid-cols-2" onSubmit={onSubmit}>
      <Input name="platform" placeholder="Platform, e.g. Instagram" required />
      <Input name="deliverable_type" placeholder="Deliverable, e.g. Reel + 3 stories" required />
      <Input name="niche" placeholder="Niche/service, e.g. fashion" required />
      <Input name="city" placeholder="City, e.g. Bengaluru" />
      <Input name="market" placeholder="Market, e.g. India" />
      <Input name="source_label" placeholder="Source, e.g. friend interview May 2026" />
      <Input name="follower_min" placeholder="Follower min" type="number" />
      <Input name="follower_max" placeholder="Follower max" type="number" />
      <Input name="avg_view_min" placeholder="Avg view min" type="number" />
      <Input name="avg_view_max" placeholder="Avg view max" type="number" />
      <Input name="low_inr" placeholder="Low INR" required type="number" />
      <Input name="base_inr" placeholder="Base INR" required type="number" />
      <Input name="high_inr" placeholder="High INR" required type="number" />
      <Input name="confidence_score" placeholder="Confidence 0-1" step="0.05" type="number" />
      <Input name="source_type" placeholder="Source type, e.g. creator_interview" />
      <Textarea className="md:col-span-2" name="notes" placeholder="Notes: context, caveats, sample creator type, negotiation details" />
      <Button className="md:col-span-2" disabled={status === "saving"} type="submit">
        <Plus className="h-4 w-4" />
        {status === "saving" ? "Saving..." : "Add benchmark"}
      </Button>
      {message ? <p className={`md:col-span-2 text-sm ${status === "error" ? "text-red-600" : "text-emerald-700"}`}>{message}</p> : null}
    </form>
  );
}
