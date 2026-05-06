"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, CreditCard, RefreshCw, Send, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";

type EntityType = "deal" | "freelancer_project";

export function PaymentActions({
  canFund = true,
  canRelease = false,
  entityId,
  entityType,
  isAdmin = false,
  paymentStatus = "unpaid"
}: {
  canFund?: boolean;
  canRelease?: boolean;
  entityId: string;
  entityType: EntityType;
  isAdmin?: boolean;
  paymentStatus?: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null);

  const isFunded = ["funded", "release_ready", "released"].includes(paymentStatus);
  const isPending = paymentStatus === "pending";

  async function createLink() {
    setBusy(true);
    setMessage(null);
    const res = await fetch("/api/payments/create-link", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ entity_id: entityId, entity_type: entityType })
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setMessage({ text: data.error ?? "Could not create funding link.", ok: false });
      return;
    }
    if (data.checkout_url) {
      window.open(data.checkout_url, "_blank", "noopener,noreferrer");
    }
    router.refresh();
  }

  async function verifyPayment() {
    setBusy(true);
    setMessage(null);
    const res = await fetch("/api/payments/verify-stripe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ entity_id: entityId, entity_type: entityType })
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setMessage({ text: data.error ?? "Could not check funding.", ok: false });
      return;
    }
    if (data.funded) {
      setMessage({ text: "Funding confirmed. Work is now protected.", ok: true });
      router.refresh();
    } else {
      setMessage({ text: "Funding is not confirmed yet. Complete checkout and try again.", ok: false });
    }
  }

  async function update(nextStatus: string) {
    setBusy(true);
    setMessage(null);
    const res = await fetch("/api/payments/update-status", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ entity_id: entityId, entity_type: entityType, status: nextStatus })
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setMessage({ text: data.error ?? "Could not update payment status.", ok: false });
      return;
    }
    router.refresh();
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap justify-end gap-2">
        {/* Payment link — available until funded */}
        {!isFunded && (
          <Button
            disabled={busy || !canFund}
            onClick={createLink}
            size="sm"
            type="button"
            variant="secondary"
            title={canFund ? undefined : "Offer must be accepted before funding."}
          >
            <CreditCard className="h-4 w-4" />
            {isPending ? "Reopen funding link" : "Generate funding link"}
          </Button>
        )}

        {/* Verify payment — shows for brands once a Stripe session exists */}
        {!isFunded && isPending && !isAdmin && (
          <Button disabled={busy} onClick={verifyPayment} size="sm" type="button" variant="secondary">
            <RefreshCw className="h-4 w-4" />
            Check funding
          </Button>
        )}

        {/* Admin: verify shortcut + manual overrides */}
        {isAdmin && (
          <>
            {isPending && (
              <Button disabled={busy} onClick={verifyPayment} size="sm" type="button" variant="secondary">
                <RefreshCw className="h-4 w-4" />
                Check funding
              </Button>
            )}
            <Button disabled={busy} onClick={() => update("funded")} size="sm" type="button" variant="secondary">
              <ShieldCheck className="h-4 w-4" />
              Force fund
            </Button>
            {canRelease && (
              <>
                <Button disabled={busy} onClick={() => update("release_ready")} size="sm" type="button" variant="secondary">
                  <CheckCircle2 className="h-4 w-4" />
                  Mark ready
                </Button>
                <Button disabled={busy} onClick={() => update("released")} size="sm" type="button">
                  <Send className="h-4 w-4" />
                  Release payout
                </Button>
              </>
            )}
          </>
        )}
      </div>

      {message && (
        <p className={`text-right text-sm ${message.ok ? "text-emerald-700" : "text-red-600"}`}>
          {message.text}
        </p>
      )}
    </div>
  );
}
