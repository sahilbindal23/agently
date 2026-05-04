"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { BriefcaseBusiness } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";

export function CreateFreelancerProfileForm({ defaultDisplayName = "" }: { defaultDisplayName?: string }) {
  const router = useRouter();
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [error, setError] = useState("");

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("loading");
    setError("");

    const formData = new FormData(event.currentTarget);
    const response = await fetch("/api/freelancers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(Object.fromEntries(formData.entries()))
    });

    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      setStatus("error");
      setError(body.error ?? "Could not create freelancer profile.");
      return;
    }

    router.refresh();
  }

  return (
    <form className="grid gap-3 md:grid-cols-2" onSubmit={onSubmit}>
      <Input name="display_name" placeholder="Freelancer/studio name" defaultValue={defaultDisplayName} required />
      <Input name="service_category" placeholder="Service category, e.g. editor, videographer, designer" required />
      <Input name="home_city" placeholder="Home city" />
      <Input name="hourly_rate_inr" placeholder="Hourly rate INR" type="number" />
      <Input name="skills" placeholder="Skills, e.g. reels, podcast edits, thumbnails" />
      <Input name="languages" placeholder="Languages" />
      <Input name="service_regions" placeholder="Service regions" />
      <Input name="availability_status" placeholder="Availability status" />
      <Textarea className="md:col-span-2" name="service_rates" placeholder="Service pricing, one per line. Example: Podcast edit - 8000 INR, Reel shoot - 12000 INR" />
      <Textarea className="md:col-span-2" name="portfolio_links" placeholder="Portfolio links, one per line" />
      <Textarea className="md:col-span-2" name="bio" placeholder="Short service bio" />
      <Button className="md:col-span-2" disabled={status === "loading"}>
        <BriefcaseBusiness className="h-4 w-4" />
        {status === "loading" ? "Creating..." : "Create freelancer profile"}
      </Button>
      {error ? <p className="md:col-span-2 text-sm text-red-600">{error}</p> : null}
    </form>
  );
}
