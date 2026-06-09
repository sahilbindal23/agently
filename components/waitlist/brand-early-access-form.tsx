"use client";

import { useState } from "react";
import { ArrowRight, CheckCircle2, Sparkles } from "lucide-react";
import { trackMetaEvent } from "@/components/analytics/meta-pixel";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { BRAND_INDUSTRIES, type Option } from "@/lib/taxonomies";

// Per-campaign budget bands, brand-side. Kept local because this framing
// (campaign spend) is specific to the brand waitlist, not a reusable taxonomy.
const BUDGET_BANDS: Option[] = [
  { value: "under_25k", label: "Under ₹25,000 / campaign" },
  { value: "25k_1l", label: "₹25,000 – ₹1,00,000" },
  { value: "1l_5l", label: "₹1,00,000 – ₹5,00,000" },
  { value: "5l_plus", label: "₹5,00,000+" },
  { value: "exploring", label: "Just exploring for now" }
];

export function BrandEarlyAccessForm() {
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [error, setError] = useState("");
  const [agreed, setAgreed] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!agreed) {
      setError("Please agree to be contacted about your early-access invite.");
      setStatus("error");
      return;
    }
    setStatus("loading");
    setError("");

    const formData = new FormData(event.currentTarget);
    const source = new URLSearchParams(window.location.search).get("source") ?? undefined;
    const payload = {
      role: "brand",
      ...Object.fromEntries(formData.entries()),
      source
    };

    const response = await fetch("/api/waitlist", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({}));
      setStatus("error");
      setError(errorBody.error ?? "Something went wrong. Please try again.");
      return;
    }

    trackMetaEvent("Lead", { content_name: "brand_waitlist" });
    setStatus("success");
  }

  if (status === "success") {
    return (
      <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-6 dark:border-emerald-900/50 dark:bg-emerald-950/30">
        <CheckCircle2 className="h-7 w-7 text-emerald-600 dark:text-emerald-400" />
        <h2 className="mt-3 text-xl font-bold text-emerald-900 dark:text-emerald-100">Thanks — you&apos;re on the list</h2>
        <p className="mt-2 text-sm leading-6 text-emerald-800 dark:text-emerald-200">
          We&apos;re onboarding brands in small batches alongside a vetted roster of creators, so your
          first campaign has talent ready to match. We&apos;ll email you when your invite is ready.
        </p>
      </div>
    );
  }

  return (
    <form className="grid gap-3" onSubmit={onSubmit}>
      <Input name="company" placeholder="Company / brand name" required autoComplete="organization" />
      <Input name="full_name" placeholder="Your name" required autoComplete="name" />
      <Input name="email" type="email" placeholder="Work email" required autoComplete="email" />
      <Input name="website" placeholder="Website (optional)" autoComplete="url" />
      <div className="grid gap-3 sm:grid-cols-2">
        <Select name="industry" options={BRAND_INDUSTRIES} placeholderOption="Industry" aria-label="Industry" />
        <Select name="budget_band" options={BUDGET_BANDS} placeholderOption="Budget per campaign" aria-label="Budget per campaign" />
      </div>
      <Textarea name="note" placeholder="What are you hoping to run? (optional — goals, products, timelines)" />
      <label className="flex cursor-pointer items-start gap-2 rounded-md border bg-white p-3 text-sm leading-5 dark:bg-card dark:border-white/10">
        <input
          checked={agreed}
          className="mt-0.5 h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
          onChange={(event) => setAgreed(event.target.checked)}
          type="checkbox"
        />
        <span className="text-muted-foreground">
          I agree to be contacted by Agently about my early-access invite. My data is processed per
          India&apos;s DPDP Act 2023.
        </span>
      </label>
      <Button disabled={status === "loading" || !agreed} className="h-11">
        <Sparkles className="h-4 w-4" />
        {status === "loading" ? "Submitting…" : "Request early access"}
        <ArrowRight className="h-4 w-4" />
      </Button>
      {error ? <p className="text-sm text-red-600 dark:text-red-400">{error}</p> : null}
    </form>
  );
}
