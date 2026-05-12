"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { AlertOctagon, Ban, BanknoteIcon, Hammer, Snowflake } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, Textarea } from "@/components/ui/input";

type FrozenAccount = {
  id: string;
  email: string;
  full_name: string | null;
  role: string | null;
  frozen_at: string | null;
  frozen_reason: string | null;
};

type OpenDispute = {
  id: string;
  deal_id: string | null;
  freelancer_project_id: string | null;
  opener_role: string;
  reason: string;
  created_at: string;
};

type FundedDeal = {
  id: string;
  title: string;
  amount_cents: number;
  payment_status: string;
  dispute_status: string;
  created_at: string;
};

type Props = {
  currentFrozen: FrozenAccount[];
  openDisputes: OpenDispute[];
  recentFundedDeals: FundedDeal[];
};

export function EmergencyToolsPanels({ currentFrozen, openDisputes, recentFundedDeals }: Props) {
  return (
    <div className="grid gap-5 xl:grid-cols-2">
      <FreezeUserPanel currentFrozen={currentFrozen} />
      <RefundDealPanel recentFundedDeals={recentFundedDeals} />
      <ResolveDisputePanel openDisputes={openDisputes} />
    </div>
  );
}

// ============================================================================
// Freeze user
// ============================================================================

function FreezeUserPanel({ currentFrozen }: { currentFrozen: FrozenAccount[] }) {
  const router = useRouter();
  const [targetId, setTargetId] = useState("");
  const [reason, setReason] = useState("");
  const [status, setStatus] = useState<"idle" | "submitting" | "done" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  async function act(action: "freeze" | "unfreeze") {
    if (!targetId.trim()) {
      setError("Enter a profile id (UUID).");
      setStatus("error");
      return;
    }
    if (action === "freeze" && reason.trim().length < 5) {
      setError("Reason is required when freezing (min 5 characters).");
      setStatus("error");
      return;
    }
    if (action === "freeze" && !confirm(`Freeze profile ${targetId.slice(0, 8)}…?\n\nLogin blocked immediately. Existing sessions expire on next JWT refresh (~1h). Audit log written.`)) {
      return;
    }
    setStatus("submitting");
    setError(null);
    const response = await fetch(`/api/admin/users/${targetId.trim()}/freeze`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, reason })
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      setStatus("error");
      setError(body.error ?? `Could not ${action} account.`);
      return;
    }
    setStatus("done");
    setTargetId("");
    setReason("");
    router.refresh();
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Snowflake className="h-4 w-4 text-sky-600" />
          Freeze user
        </CardTitle>
        <Badge tone="amber">trust + safety</Badge>
      </CardHeader>
      <div className="space-y-3">
        <Input
          onChange={(event) => setTargetId(event.target.value)}
          placeholder="Profile UUID (look up in audit logs or Supabase)"
          value={targetId}
        />
        <Textarea
          onChange={(event) => setReason(event.target.value)}
          placeholder="Reason (required for freeze, min 5 chars). E.g. 'Confirmed fraud — fake brand pretending to be Nike'."
          rows={3}
          value={reason}
        />
        <div className="flex flex-wrap gap-2">
          <Button disabled={status === "submitting"} onClick={() => act("freeze")} type="button" variant="danger">
            <Ban className="h-4 w-4" />
            {status === "submitting" ? "Freezing…" : "Freeze account"}
          </Button>
          <Button disabled={status === "submitting"} onClick={() => act("unfreeze")} type="button" variant="secondary">
            Unfreeze
          </Button>
        </div>
        {error ? <p className="text-sm font-medium text-red-600 dark:text-red-400">{error}</p> : null}
        {status === "done" ? <p className="text-sm font-medium text-emerald-700 dark:text-emerald-300">Done. Audit log written.</p> : null}
      </div>

      <div className="mt-5 border-t pt-4 dark:border-white/8">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Currently frozen ({currentFrozen.length})</p>
        {currentFrozen.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">No accounts are frozen right now.</p>
        ) : (
          <ul className="mt-2 space-y-2 text-sm">
            {currentFrozen.map((row) => (
              <li key={row.id} className="rounded-md border bg-white p-3 dark:border-white/8 dark:bg-card">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="font-medium">{row.email}{row.full_name ? ` · ${row.full_name}` : ""}</p>
                    <p className="text-xs text-muted-foreground">{row.role ?? "unknown role"} · frozen {row.frozen_at ? new Date(row.frozen_at).toLocaleString() : "—"}</p>
                  </div>
                  <button
                    className="text-xs font-mono text-primary underline hover:no-underline"
                    onClick={() => setTargetId(row.id)}
                    type="button"
                  >
                    use id
                  </button>
                </div>
                {row.frozen_reason ? <p className="mt-1 text-xs italic text-muted-foreground">&ldquo;{row.frozen_reason}&rdquo;</p> : null}
              </li>
            ))}
          </ul>
        )}
      </div>
    </Card>
  );
}

// ============================================================================
// Force refund
// ============================================================================

function RefundDealPanel({ recentFundedDeals }: { recentFundedDeals: FundedDeal[] }) {
  const router = useRouter();
  const [entityType, setEntityType] = useState<"deal" | "freelancer_project">("deal");
  const [entityId, setEntityId] = useState("");
  const [status, setStatus] = useState<"idle" | "submitting" | "done" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  async function act() {
    if (!entityId.trim()) {
      setError("Enter a deal or project id.");
      setStatus("error");
      return;
    }
    if (!confirm(`Force-mark this ${entityType.replace("_", " ")} as refunded?\n\nThis only updates Agently's records — you must process the actual refund through Stripe/Razorpay separately.`)) {
      return;
    }
    setStatus("submitting");
    setError(null);
    const response = await fetch("/api/payments/update-status", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ entity_type: entityType, entity_id: entityId.trim(), status: "refunded" })
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      setStatus("error");
      setError(body.error ?? "Could not mark as refunded.");
      return;
    }
    setStatus("done");
    setEntityId("");
    router.refresh();
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <BanknoteIcon className="h-4 w-4 text-emerald-600" />
          Force refund
        </CardTitle>
        <Badge tone="amber">records only</Badge>
      </CardHeader>
      <div className="space-y-3">
        <p className="text-xs text-muted-foreground">
          Marks a deal or freelancer project as refunded in our records. Process the actual money movement through Stripe/Razorpay first.
        </p>
        <div className="flex gap-2">
          <select
            className="h-10 rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring dark:border-white/10"
            onChange={(event) => setEntityType(event.target.value as "deal" | "freelancer_project")}
            value={entityType}
          >
            <option value="deal">Deal</option>
            <option value="freelancer_project">Freelancer project</option>
          </select>
          <Input
            className="flex-1"
            onChange={(event) => setEntityId(event.target.value)}
            placeholder={`${entityType === "deal" ? "Deal" : "Project"} UUID`}
            value={entityId}
          />
        </div>
        <Button disabled={status === "submitting"} onClick={act} type="button" variant="danger">
          <Hammer className="h-4 w-4" />
          {status === "submitting" ? "Marking…" : "Mark refunded"}
        </Button>
        {error ? <p className="text-sm font-medium text-red-600 dark:text-red-400">{error}</p> : null}
        {status === "done" ? <p className="text-sm font-medium text-emerald-700 dark:text-emerald-300">Marked refunded. Audit + ledger updated.</p> : null}
      </div>

      <div className="mt-5 border-t pt-4 dark:border-white/8">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Recent funded deals ({recentFundedDeals.length})</p>
        {recentFundedDeals.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">No funded deals recently.</p>
        ) : (
          <ul className="mt-2 space-y-1 text-xs">
            {recentFundedDeals.slice(0, 8).map((row) => (
              <li key={row.id} className="flex items-center justify-between gap-2 rounded-md border bg-white px-2 py-1.5 dark:border-white/8 dark:bg-card">
                <span className="truncate">
                  <span className="font-medium">{row.title}</span>{" "}
                  <span className="text-muted-foreground">· {row.payment_status}</span>
                  {row.dispute_status === "open" ? <span className="ml-1 text-red-600">· dispute</span> : null}
                </span>
                <button
                  className="font-mono text-primary underline hover:no-underline"
                  onClick={() => {
                    setEntityType("deal");
                    setEntityId(row.id);
                  }}
                  type="button"
                >
                  use id
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Card>
  );
}

// ============================================================================
// Force-resolve dispute
// ============================================================================

function ResolveDisputePanel({ openDisputes }: { openDisputes: OpenDispute[] }) {
  const router = useRouter();
  const [disputeId, setDisputeId] = useState("");
  const [resolution, setResolution] = useState<"resolved_release" | "resolved_refund" | "resolved_split" | "dismissed">("resolved_release");
  const [note, setNote] = useState("");
  const [status, setStatus] = useState<"idle" | "submitting" | "done" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  async function act() {
    if (!disputeId.trim()) {
      setError("Enter a dispute id.");
      setStatus("error");
      return;
    }
    if (note.trim().length < 5) {
      setError("Decision note is required (min 5 characters).");
      setStatus("error");
      return;
    }
    if (!confirm(`Force-resolve dispute ${disputeId.slice(0, 8)}… as ${resolution}?\n\nThis applies the resolution to the underlying deal/project and writes an audit entry.`)) {
      return;
    }
    setStatus("submitting");
    setError(null);
    const response = await fetch(`/api/disputes/${disputeId.trim()}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ resolution, decision_note: note })
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      setStatus("error");
      setError(body.error ?? "Could not resolve dispute.");
      return;
    }
    setStatus("done");
    setDisputeId("");
    setNote("");
    router.refresh();
  }

  return (
    <Card className="xl:col-span-2">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <AlertOctagon className="h-4 w-4 text-red-600" />
          Force-resolve dispute
        </CardTitle>
        <Badge tone="amber">use /disputes when possible</Badge>
      </CardHeader>
      <div className="grid gap-3 md:grid-cols-[1fr_1fr_auto]">
        <Input
          onChange={(event) => setDisputeId(event.target.value)}
          placeholder="Dispute UUID"
          value={disputeId}
        />
        <select
          className="h-10 rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring dark:border-white/10"
          onChange={(event) => setResolution(event.target.value as typeof resolution)}
          value={resolution}
        >
          <option value="resolved_release">Resolve - release to talent</option>
          <option value="resolved_refund">Resolve - refund to brand</option>
          <option value="resolved_split">Resolve - split</option>
          <option value="dismissed">Dismiss</option>
        </select>
        <Button disabled={status === "submitting"} onClick={act} type="button" variant="danger">
          <Hammer className="h-4 w-4" />
          {status === "submitting" ? "Resolving…" : "Apply resolution"}
        </Button>
      </div>
      <Textarea
        className="mt-3"
        onChange={(event) => setNote(event.target.value)}
        placeholder="Decision note (required, min 5 chars). Written to the dispute record and the audit log."
        rows={3}
        value={note}
      />
      {error ? <p className="mt-2 text-sm font-medium text-red-600 dark:text-red-400">{error}</p> : null}
      {status === "done" ? <p className="mt-2 text-sm font-medium text-emerald-700 dark:text-emerald-300">Resolution applied. Underlying deal/project updated.</p> : null}

      <div className="mt-5 border-t pt-4 dark:border-white/8">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Open disputes ({openDisputes.length})</p>
        {openDisputes.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">No open disputes. <a className="text-primary underline" href="/disputes">Full disputes page</a></p>
        ) : (
          <ul className="mt-2 space-y-1 text-xs">
            {openDisputes.map((row) => (
              <li key={row.id} className="flex items-center justify-between gap-2 rounded-md border bg-white px-2 py-1.5 dark:border-white/8 dark:bg-card">
                <span className="truncate">
                  <span className="font-medium">{row.opener_role}</span>{" "}
                  <span className="text-muted-foreground">· {row.reason.slice(0, 60)}{row.reason.length > 60 ? "…" : ""}</span>
                </span>
                <button
                  className="font-mono text-primary underline hover:no-underline"
                  onClick={() => setDisputeId(row.id)}
                  type="button"
                >
                  use id
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Card>
  );
}
