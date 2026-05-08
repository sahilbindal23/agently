"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { RiskBadge } from "@/components/contracts/risk-badge";
import type { RiskLevel } from "@/types";

type DealOption = {
  id: string;
  title: string;
  creatorName?: string;
  brandName?: string;
};

  type ScanResult = {
  risk_level: RiskLevel;
  summary: string;
  flags: Array<{
    flag_type: string;
    severity: "low" | "medium" | "high";
    excerpt: string;
    recommendation: string;
  }>;
  file_name?: string | null;
  review_status?: string | null;
  source?: string;
};

export function DealContractScanForm({
  deals,
  dealId
}: {
  deals?: DealOption[];
  dealId?: string;
}) {
  const router = useRouter();
  const [status, setStatus] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [message, setMessage] = useState("");
  const [result, setResult] = useState<ScanResult | null>(null);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    const selectedDealId = dealId ?? String(formData.get("deal_id") ?? "");
    const file = formData.get("file");
    const pastedText = String(formData.get("raw_text") ?? "").trim();
    const isTextFile = file instanceof File && file.size > 0
      ? file.type.startsWith("text/") || file.type === "application/json" || /\.(txt|md|csv|rtf)$/i.test(file.name)
      : false;
    const fileText = file instanceof File && file.size > 0 && isTextFile ? await file.text() : "";
    const rawText = pastedText || fileText.trim();

    if (!selectedDealId || !rawText) {
      setStatus("error");
      setMessage(file instanceof File && file.name.toLowerCase().endsWith(".pdf")
        ? "PDF selected. For this prototype, paste the contract text from the PDF so Agently can scan it."
        : "Choose a deal and paste the contract text before scanning.");
      return;
    }

    setStatus("loading");
    setMessage("");

    const payloadForm = new FormData();
    payloadForm.set("deal_id", selectedDealId);
    payloadForm.set("raw_text", rawText);
    if (file instanceof File && file.size > 0) payloadForm.set("file", file);

    const response = await fetch("/api/ai/scan-contract", {
      method: "POST",
      body: payloadForm
    });

    const payload = await response.json();
    if (!response.ok) {
      setStatus("error");
      setMessage(payload.error ?? "Could not scan this contract.");
      return;
    }

    setResult(payload);
    setStatus("done");
    setMessage(payload.source === "rules_fallback" ? "Contract packet saved with the local rules fallback." : "Contract packet saved to the deal.");
    form.reset();
    router.refresh();
  }

  return (
    <form className="space-y-3" onSubmit={onSubmit}>
      {dealId ? null : (
        <select
          name="deal_id"
          className="h-10 w-full rounded-md border bg-white px-3 text-sm dark:border-white/10 dark:bg-card dark:text-foreground outline-none transition focus:ring-2 focus:ring-ring"
          defaultValue=""
        >
          <option value="" disabled>Select deal to attach scan</option>
          {(deals ?? []).map((deal) => (
            <option key={deal.id} value={deal.id}>
              {deal.title} {deal.creatorName || deal.brandName ? `- ${[deal.creatorName, deal.brandName].filter(Boolean).join(" x ")}` : ""}
            </option>
          ))}
        </select>
      )}
      <Input name="file" type="file" accept=".txt,.md,.csv,.rtf,.pdf,.doc,.docx" />
      <p className="text-xs leading-5 text-muted-foreground">
        Start from the Agently template whenever possible. Brand-supplied contracts should be treated as exception cases and scanned for usage, payment, exclusivity, revision, cancellation, and dispute risks before anyone accepts.
      </p>
      <Textarea
        name="raw_text"
        placeholder="Paste the Agently contract packet or redlined brand terms here: scope, payment timing, usage rights, exclusivity, whitelisting, revisions, cancellation, dispute process, and licensing duration."
        className="min-h-48"
      />
      <Button type="submit" disabled={status === "loading"}>
        <Upload className="h-4 w-4" />
        {status === "loading" ? "Scanning..." : "Run contract scan"}
      </Button>
      {message ? (
        <p className={status === "error" ? "text-sm text-red-600" : "text-sm text-muted-foreground"}>{message}</p>
      ) : null}
      {result ? (
        <div className="rounded-md border bg-white p-3 dark:border-white/8 dark:bg-card">
          <div className="mb-2 flex items-center justify-between gap-3">
            <p className="text-sm font-semibold">Latest result</p>
            <RiskBadge risk={result.risk_level} />
          </div>
          {result.file_name ? (
            <p className="mb-2 text-xs font-medium text-muted-foreground">Attached file: {result.file_name}</p>
          ) : null}
          <p className="text-sm leading-6 text-muted-foreground">{result.summary}</p>
        </div>
      ) : null}
    </form>
  );
}
