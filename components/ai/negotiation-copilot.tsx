"use client";

import { useState } from "react";
import { Handshake } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, Textarea } from "@/components/ui/input";
import { formatCurrency } from "@/lib/utils/format";

type NegotiationResult = {
  recommended_counter_cents: number;
  minimum_floor_cents: number;
  terms_to_push_back_on: string[];
  acceptance_likelihood: number;
  message: string;
  source?: string;
};

type NegotiationPrefill = {
  offer_amount_inr?: string;
  brand?: string;
  deliverables?: string;
  contract_terms?: string;
  valuation_context?: string;
};

export function NegotiationCopilot({ role, initialValues }: { role: "admin" | "creator" | "freelancer"; initialValues?: NegotiationPrefill }) {
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [result, setResult] = useState<NegotiationResult | null>(null);
  const [error, setError] = useState("");

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("loading");
    setError("");

    const formData = new FormData(event.currentTarget);
    const offerAmountInr = Number(formData.get("offer_amount_inr") ?? 0);
    const payload = {
      talent_type: role === "freelancer" ? "freelancer" : "creator",
      offer_amount_cents: Math.round(offerAmountInr * 100),
      deliverables: formData.get("deliverables"),
      contract_terms: formData.get("contract_terms"),
      brand: formData.get("brand"),
      valuation_context: formData.get("valuation_context")
    };

    const response = await fetch("/api/ai/negotiate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      setStatus("error");
      setError("Could not generate negotiation guidance.");
      return;
    }

    setResult(await response.json());
    setStatus("idle");
  }

  return (
    <section className="mt-5 grid gap-5 xl:grid-cols-[0.9fr_1.1fr]" id="negotiation">
      <Card>
        <CardHeader>
          <div>
            <CardTitle>Talent Negotiation Copilot</CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">Creator and freelancer-side guidance for counter offers, floor pricing, risky terms, and response copy.</p>
          </div>
          <Badge tone="blue">talent-side</Badge>
        </CardHeader>
        <form className="grid gap-3 md:grid-cols-2" onSubmit={onSubmit}>
          <Input defaultValue={initialValues?.offer_amount_inr ?? ""} name="offer_amount_inr" placeholder="Offer amount in INR" type="number" required />
          <Input defaultValue={initialValues?.brand ?? ""} name="brand" placeholder="Brand name" />
          <Textarea className="md:col-span-2" defaultValue={initialValues?.deliverables ?? ""} name="deliverables" placeholder="Deliverables, timelines, channels, assets, or services requested" required />
          <Textarea className="md:col-span-2" defaultValue={initialValues?.contract_terms ?? ""} name="contract_terms" placeholder="Contract terms or concerns, e.g. usage, payment timing, revisions, exclusivity" />
          <Textarea className="md:col-span-2" defaultValue={initialValues?.valuation_context ?? ""} name="valuation_context" placeholder="Your rate context, audience/portfolio strength, past deal range, or minimum acceptable rate" />
          <Button className="md:col-span-2" disabled={status === "loading"}>
            <Handshake className="h-4 w-4" />
            {status === "loading" ? "Generating..." : "Generate counter"}
          </Button>
          {error ? <p className="md:col-span-2 text-sm text-red-600">{error}</p> : null}
        </form>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Recommended Position</CardTitle>
          <Badge tone="green">{result?.source ?? "ready"}</Badge>
        </CardHeader>
        {result ? (
          <div className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-3">
              <Metric label="Counter" value={formatCurrency(result.recommended_counter_cents, "inr")} />
              <Metric label="Floor" value={formatCurrency(result.minimum_floor_cents, "inr")} />
              <Metric label="Likelihood" value={`${Math.round(result.acceptance_likelihood * 100)}%`} />
            </div>
            <div className="rounded-md border bg-white p-3">
              <p className="text-xs font-semibold uppercase text-muted-foreground">Push back on</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {result.terms_to_push_back_on.map((term) => <Badge key={term} tone="amber">{term}</Badge>)}
              </div>
            </div>
            <div className="rounded-md border bg-white p-3">
              <p className="text-xs font-semibold uppercase text-muted-foreground">Suggested message</p>
              <p className="mt-2 whitespace-pre-wrap text-sm leading-6">{result.message}</p>
            </div>
          </div>
        ) : (
          <div className="rounded-md border bg-white p-4 text-sm leading-6 text-muted-foreground">
            Add the offer and terms to generate a talent-friendly counter position.
          </div>
        )}
      </Card>
    </section>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border bg-white p-3">
      <p className="text-xs font-semibold uppercase text-muted-foreground">{label}</p>
      <p className="mt-1 text-lg font-bold">{value}</p>
    </div>
  );
}
