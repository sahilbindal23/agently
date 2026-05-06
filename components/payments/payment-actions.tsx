"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, CreditCard, RefreshCw, Send, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";

type EntityType = "deal" | "freelancer_project";
type RazorpayCheckoutResponse = {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
};

declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => { open: () => void };
  }
}

export function PaymentActions({
  canFund = true,
  canRelease = false,
  entityId,
  entityType,
  isAdmin = false,
  paymentProvider,
  paymentStatus = "unpaid"
}: {
  canFund?: boolean;
  canRelease?: boolean;
  entityId: string;
  entityType: EntityType;
  isAdmin?: boolean;
  paymentProvider?: string | null;
  paymentStatus?: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null);

  const isFunded = ["funded", "release_ready", "released"].includes(paymentStatus);
  const isPending = paymentStatus === "pending";
  const canVerifyStripe = isPending && paymentProvider !== "razorpay";
  const fundButtonLabel = isPending
    ? paymentProvider === "stripe" ? "Open funding link" : "Open Razorpay"
    : "Fund with Razorpay";

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
    if (data.provider === "razorpay") {
      await openRazorpayCheckout(data);
      return;
    }
    if (data.checkout_url) {
      window.open(data.checkout_url, "_blank", "noopener,noreferrer");
    }
    router.refresh();
  }

  async function openRazorpayCheckout(data: Record<string, string | number>) {
    if (!data.razorpay_key_id || !data.razorpay_order_id) {
      setMessage({ text: "Razorpay order was created, but checkout details are incomplete.", ok: false });
      return;
    }

    const loaded = await loadRazorpayScript();
    if (!loaded || !window.Razorpay) {
      setMessage({ text: "Could not load Razorpay Checkout. Check your connection and try again.", ok: false });
      return;
    }

    const checkout = new window.Razorpay({
      key: data.razorpay_key_id,
      amount: data.amount_cents,
      currency: String(data.currency || "INR").toUpperCase(),
      name: data.name,
      description: data.description,
      order_id: data.razorpay_order_id,
      handler: async (response: RazorpayCheckoutResponse) => {
        setBusy(true);
        setMessage(null);
        const verify = await fetch("/api/payments/verify-razorpay", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            entity_id: entityId,
            entity_type: entityType,
            razorpay_order_id: response.razorpay_order_id,
            razorpay_payment_id: response.razorpay_payment_id,
            razorpay_signature: response.razorpay_signature
          })
        });
        const verifyData = await verify.json().catch(() => ({}));
        setBusy(false);
        if (!verify.ok) {
          setMessage({ text: verifyData.error ?? "Payment could not be verified.", ok: false });
          return;
        }
        setMessage({ text: "Funding confirmed. Work is now protected.", ok: true });
        router.refresh();
      },
      modal: {
        ondismiss: () => {
          setMessage({ text: "Razorpay order is pending. Complete checkout when ready.", ok: false });
          router.refresh();
        }
      },
      theme: { color: "#14b8a6" }
    });
    checkout.open();
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
            className="min-h-9 max-w-full whitespace-normal px-3 py-2 text-center leading-tight"
            disabled={busy || !canFund}
            onClick={createLink}
            size="sm"
            type="button"
            variant="secondary"
            title={canFund ? undefined : "Offer must be accepted before funding."}
          >
            <CreditCard className="h-4 w-4" />
            {fundButtonLabel}
          </Button>
        )}

        {/* Verify payment — shows for brands once a Stripe session exists */}
        {!isFunded && canVerifyStripe && !isAdmin && (
          <Button disabled={busy} onClick={verifyPayment} size="sm" type="button" variant="secondary">
            <RefreshCw className="h-4 w-4" />
            Check funding
          </Button>
        )}

        {/* Admin: verify shortcut + manual overrides */}
        {isAdmin && (
          <>
            {canVerifyStripe && (
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

function loadRazorpayScript() {
  if (window.Razorpay) return Promise.resolve(true);
  return new Promise<boolean>((resolve) => {
    const existing = document.querySelector<HTMLScriptElement>('script[src="https://checkout.razorpay.com/v1/checkout.js"]');
    if (existing) {
      existing.addEventListener("load", () => resolve(true), { once: true });
      existing.addEventListener("error", () => resolve(false), { once: true });
      return;
    }

    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.async = true;
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}
