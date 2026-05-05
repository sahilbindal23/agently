"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ClipboardList } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import type { Creator } from "@/types";

export function CreateCampaignForm({ creators = [] }: { creators?: Creator[] }) {
  const router = useRouter();
  const [status, setStatus] = useState<"idle" | "saving" | "error">("idle");
  const [message, setMessage] = useState("");
  const [visibility, setVisibility] = useState<"open" | "invite_only">("open");
  const [selectedCreatorIds, setSelectedCreatorIds] = useState<string[]>([]);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    setStatus("saving");
    setMessage("");

    const formData = new FormData(form);
    if (visibility === "invite_only" && selectedCreatorIds.length === 0) {
      setStatus("error");
      setMessage("Choose at least one creator for an invite-only campaign.");
      return;
    }

    const response = await fetch("/api/campaigns", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(Object.fromEntries(formData.entries()))
    });

    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      setStatus("error");
      setMessage(body.error ?? "Could not create campaign.");
      return;
    }

    form.reset();
    setSelectedCreatorIds([]);
    setVisibility("open");
    setStatus("idle");
    router.refresh();
  }

  function toggleCreator(id: string) {
    setSelectedCreatorIds((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  }

  return (
    <form className="grid gap-3 md:grid-cols-2" onSubmit={onSubmit}>
      <Input name="title" placeholder="Campaign title" required />
      <Input name="brand_name" placeholder="Brand name, optional" />
      <Input name="brand_category" placeholder="Brand category" />
      <Input name="budget_inr" placeholder="Budget INR" type="number" />
      <Input name="city_focus" placeholder="City focus, optional" />
      <Input name="region_focus" placeholder="Region focus, e.g. Bangalore, India, global" />
      <Input name="campaign_length" placeholder="Campaign length, e.g. 2 weeks, 3 months" />
      <select name="visibility" className="h-10 rounded-md border bg-white px-3 text-sm dark:border-white/10 dark:bg-card dark:text-foreground" value={visibility} onChange={(event) => setVisibility(event.target.value as "open" | "invite_only")}>
        <option value="open">Open discovery</option>
        <option value="invite_only">Invite-only creator campaign</option>
      </select>
      <Input name="platforms" placeholder="Platforms, e.g. Instagram, YouTube" />
      <Input name="creator_categories" placeholder="Creator categories, e.g. fashion, gaming" />
      <Input name="freelancer_needs" placeholder="Freelancer needs, e.g. editor, videographer" />
      <Input className="md:col-span-2" name="languages" placeholder="Languages, e.g. English, Hindi, Kannada" />
      {visibility === "invite_only" ? (
        <div className="md:col-span-2 rounded-md border bg-white p-3 dark:border-white/8 dark:bg-card">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-xs font-semibold uppercase text-muted-foreground">Invite specific creators</p>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">Only selected creators will appear in recommendations for this campaign.</p>
            </div>
            <span className="rounded-full border bg-muted px-2.5 py-1 text-xs font-medium">{selectedCreatorIds.length} selected</span>
          </div>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {creators.map((creator) => (
              <label className={`flex items-center gap-2 rounded-md border px-3 py-2 text-sm ${selectedCreatorIds.includes(creator.id) ? "border-primary bg-primary/5" : ""}`} key={creator.id}>
                <input checked={selectedCreatorIds.includes(creator.id)} name="invited_creator_ids" onChange={() => toggleCreator(creator.id)} type="checkbox" value={creator.id} />
                <span>{creator.display_name}</span>
              </label>
            ))}
          </div>
        </div>
      ) : null}
      <Textarea className="md:col-span-2" name="target_audience" placeholder="Target audience" />
      <Textarea className="md:col-span-2" name="campaign_goal" placeholder="Campaign goal and context" required />
      <Button className="md:col-span-2" disabled={status === "saving"}>
        <ClipboardList className="h-4 w-4" />
        {status === "saving" ? "Creating..." : "Create campaign brief"}
      </Button>
      {message ? <p className={`md:col-span-2 text-sm ${status === "error" ? "text-red-600" : "text-emerald-700"}`}>{message}</p> : null}
    </form>
  );
}
