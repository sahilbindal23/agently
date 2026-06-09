"use client";

import { useState } from "react";
import { ArrowRight, CheckCircle2, Sparkles } from "lucide-react";
import { trackMetaEvent } from "@/components/analytics/meta-pixel";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { CREATOR_SIZE_BANDS, INDIAN_CITIES, NICHES, PLATFORMS } from "@/lib/taxonomies";

export function EarlyAccessForm() {
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
    // Attribution: ?source=instagram_ad etc. from the ad link, if present.
    const source = new URLSearchParams(window.location.search).get("source") ?? undefined;
    const payload = {
      role: "creator",
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

    // Same conversion event the signup flow fires, so an ad optimised for
    // "Lead" counts a waitlist request as a conversion.
    trackMetaEvent("Lead", { content_name: "creator_waitlist" });
    setStatus("success");
  }

  if (status === "success") {
    return (
      <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-6 dark:border-emerald-900/50 dark:bg-emerald-950/30">
        <CheckCircle2 className="h-7 w-7 text-emerald-600 dark:text-emerald-400" />
        <h2 className="mt-3 text-xl font-bold text-emerald-900 dark:text-emerald-100">You&apos;re on the list</h2>
        <p className="mt-2 text-sm leading-6 text-emerald-800 dark:text-emerald-200">
          We&apos;re onboarding founding creators in small batches so every profile gets proper
          attention. We&apos;ll email you when your invite is ready — keep an eye on your inbox.
        </p>
      </div>
    );
  }

  return (
    <form className="grid gap-3" onSubmit={onSubmit}>
      <Input name="full_name" placeholder="Full name" required autoComplete="name" />
      <Input name="email" type="email" placeholder="Email" required autoComplete="email" />
      <div className="grid gap-3 sm:grid-cols-2">
        <Select name="primary_platform" options={PLATFORMS} placeholderOption="Main platform" aria-label="Main platform" />
        <Input name="handle" placeholder="@your handle" autoComplete="off" />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <Select name="primary_niche" options={NICHES} placeholderOption="Your niche" aria-label="Your niche" />
        <Select name="follower_band" options={CREATOR_SIZE_BANDS} placeholderOption="Audience size" aria-label="Audience size" />
      </div>
      <Select name="city" options={INDIAN_CITIES} placeholderOption="City" aria-label="City" />
      <Textarea name="note" placeholder="Anything we should know? (optional — e.g. brands you've worked with)" />
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
