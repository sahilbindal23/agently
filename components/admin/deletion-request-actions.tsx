"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";

type Props = { requestId: string };

export function DeletionRequestActions({ requestId }: Props) {
  const router = useRouter();
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState<"approve" | "reject" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function act(action: "approve" | "reject") {
    if (action === "approve" && !confirm("Approve will anonymise this account immediately and remove their auth login. Transactional rows (deals, payments, contracts) stay for legal/tax purposes. Proceed?")) {
      return;
    }
    setBusy(action);
    setError(null);
    const response = await fetch(`/api/admin/deletion-requests/${requestId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, note })
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      setError(body.error ?? "Could not process this request.");
      setBusy(null);
      return;
    }
    router.refresh();
  }

  return (
    <div className="mt-4 grid gap-2 md:grid-cols-[1fr_auto_auto]">
      <input
        className="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring dark:border-white/10"
        onChange={(event) => setNote(event.target.value)}
        placeholder="Optional admin note (saved to request metadata)"
        value={note}
      />
      <Button disabled={busy !== null} onClick={() => act("reject")} type="button" variant="secondary">
        {busy === "reject" ? "Rejecting…" : "Reject"}
      </Button>
      <Button disabled={busy !== null} onClick={() => act("approve")} type="button" variant="danger">
        {busy === "approve" ? "Deleting…" : "Approve & delete"}
      </Button>
      {error ? <p className="md:col-span-3 text-xs font-semibold text-red-700 dark:text-red-300">{error}</p> : null}
    </div>
  );
}
