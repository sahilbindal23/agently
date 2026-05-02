"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";

export function CreateCreatorForm() {
  const router = useRouter();
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [message, setMessage] = useState("");

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("saving");
    setMessage("");

    const formData = new FormData(event.currentTarget);
    const payload = Object.fromEntries(formData.entries());

    const response = await fetch("/api/creators", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      setStatus("error");
      setMessage(body.error ?? "Could not save creator.");
      return;
    }

    event.currentTarget.reset();
    setStatus("saved");
    setMessage("Creator profile saved to Supabase.");
    router.refresh();
  }

  return (
    <form className="grid gap-3 md:grid-cols-3" onSubmit={onSubmit}>
      <Input name="display_name" placeholder="Display name" required />
      <Input name="primary_niche" placeholder="Primary niche" />
      <Input name="country" placeholder="Country" />
      <Input name="platform" placeholder="Platform" />
      <Input name="handle" placeholder="Handle" />
      <Input name="followers" placeholder="Followers" type="number" min="0" />
      <Input name="avg_views" placeholder="Average views" type="number" min="0" />
      <Input name="engagement_rate" placeholder="Engagement rate %" type="number" min="0" step="0.1" />
      <Input name="india_audience_percent" placeholder="India audience %" type="number" min="0" max="100" step="0.1" />
      <Input name="home_city" placeholder="Home city" />
      <Input name="languages" placeholder="Languages" />
      <Input name="top_indian_cities" placeholder="Top Indian cities" />
      <Input name="audience_age_range" placeholder="Audience age range" />
      <Input name="content_style" placeholder="Content style" />
      <Input name="prior_sponsor_categories" placeholder="Prior sponsor categories" />
      <Textarea name="bio" className="md:col-span-3" placeholder="Creator positioning notes" />
      <Button className="md:col-span-3" disabled={status === "saving"}>
        {status === "saving" ? "Saving..." : "Save creator profile"}
      </Button>
      {message ? (
        <p className={`md:col-span-3 text-sm ${status === "error" ? "text-red-600" : "text-emerald-700"}`}>
          {message}
        </p>
      ) : null}
    </form>
  );
}
