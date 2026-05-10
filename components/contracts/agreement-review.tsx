"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, FileSignature } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export type AgreementForReview = {
  id: string;
  rendered_html: string;
  status: "pending_signatures" | "fully_signed" | "voided";
  brand_signed_at: string | null;
  brand_signed_name: string | null;
  talent_signed_at: string | null;
  talent_signed_name: string | null;
};

export function AgreementReview({
  agreement,
  viewerSide,
  defaultName
}: {
  agreement: AgreementForReview;
  viewerSide: "brand" | "talent";
  defaultName?: string;
}) {
  const router = useRouter();
  const [name, setName] = useState(defaultName ?? "");
  const [status, setStatus] = useState<"idle" | "saving" | "error">("idle");
  const [message, setMessage] = useState("");

  const viewerHasSigned = viewerSide === "brand" ? !!agreement.brand_signed_at : !!agreement.talent_signed_at;
  const otherHasSigned = viewerSide === "brand" ? !!agreement.talent_signed_at : !!agreement.brand_signed_at;
  const fullySigned = agreement.status === "fully_signed";

  async function sign() {
    if (!name.trim() || name.trim().length < 2) {
      setStatus("error");
      setMessage("Please type your full name to sign.");
      return;
    }
    setStatus("saving");
    setMessage("");
    try {
      const r = await fetch("/api/contracts/sign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agreement_id: agreement.id, typed_name: name.trim() })
      });
      if (!r.ok) {
        const body = await r.json().catch(() => ({}));
        setStatus("error");
        setMessage(body.error ?? "Could not sign. Please try again.");
        return;
      }
      setStatus("idle");
      router.refresh();
    } catch {
      setStatus("error");
      setMessage("Network error. Please try again.");
    }
  }

  return (
    <div className="rounded-md border bg-white p-4 dark:border-white/8 dark:bg-card">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <FileSignature className="h-4 w-4 text-primary" />
          <p className="text-sm font-semibold">Standard agreement</p>
        </div>
        {fullySigned ? (
          <Badge tone="green">fully signed</Badge>
        ) : viewerHasSigned ? (
          <Badge tone="blue">waiting on counter-party</Badge>
        ) : (
          <Badge tone="amber">your signature required</Badge>
        )}
      </div>

      {/* Rendered agreement HTML in a scrollable box */}
      <div
        className="agreement-content max-h-[420px] overflow-y-auto rounded border bg-muted/40 p-4 text-sm leading-6 dark:border-white/8 dark:bg-white/4"
        dangerouslySetInnerHTML={{ __html: agreement.rendered_html }}
      />

      {/* Signature status */}
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        <SignatureStatus
          label="Brand signature"
          signedAt={agreement.brand_signed_at}
          signedName={agreement.brand_signed_name}
        />
        <SignatureStatus
          label={viewerSide === "brand" ? "Talent signature" : "Your signature"}
          signedAt={agreement.talent_signed_at}
          signedName={agreement.talent_signed_name}
        />
      </div>

      {/* Sign action */}
      {!fullySigned && !viewerHasSigned ? (
        <div className="mt-4 rounded-md border border-amber-200 bg-amber-50 p-3 dark:border-amber-900/50 dark:bg-amber-950/30">
          <p className="text-xs font-semibold uppercase text-amber-800 dark:text-amber-300">Sign to continue</p>
          <p className="mt-1 text-xs leading-5 text-amber-900 dark:text-amber-200">
            Type your full legal name to record your signature. We capture timestamp and IP as proof of execution.
            {otherHasSigned ? " The other party has already signed — your signature completes the agreement." : ""}
          </p>
          <div className="mt-3 flex flex-col gap-2 sm:flex-row">
            <Input
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Type your full legal name"
              className="sm:flex-1"
            />
            <Button onClick={sign} disabled={status === "saving"} type="button">
              <CheckCircle2 className="h-4 w-4" />
              {status === "saving" ? "Signing..." : "I agree and sign"}
            </Button>
          </div>
          {message ? <p className="mt-2 text-sm text-red-600 dark:text-red-400">{message}</p> : null}
        </div>
      ) : null}

      {fullySigned ? (
        <div className="mt-4 rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-200">
          Both parties signed. Payment funding can proceed.
        </div>
      ) : null}
    </div>
  );
}

function SignatureStatus({ label, signedAt, signedName }: { label: string; signedAt: string | null; signedName: string | null }) {
  return (
    <div className="rounded-md border bg-muted/40 p-3 text-xs dark:border-white/8 dark:bg-white/4">
      <p className="font-semibold uppercase text-muted-foreground">{label}</p>
      {signedAt && signedName ? (
        <>
          <p className="mt-1 font-semibold">{signedName}</p>
          <p className="mt-0.5 text-muted-foreground">{new Date(signedAt).toLocaleString()}</p>
        </>
      ) : (
        <p className="mt-1 text-muted-foreground">Not signed yet</p>
      )}
    </div>
  );
}
