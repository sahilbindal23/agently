"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Cable, RefreshCw, ShieldAlert, ShieldCheck } from "lucide-react";
import { socialProviders, type SocialProvider } from "@/lib/social/platforms";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export type ConnectedAccountRow = {
  id: string;
  provider: SocialProvider;
  handle: string;
  status?: string;
  last_synced_at?: string | null;
};

export type SocialSnapshotRow = {
  provider: SocialProvider;
  followers: number;
  avg_views_30d: number;
  engagement_rate_30d: number;
  india_audience_percent: number;
  bangalore_audience_percent: number;
  source: string;
  synced_at: string;
};

export function ConnectedAccountsPanel({
  accounts,
  oauthReadyProviders = {},
  snapshots
}: {
  accounts: ConnectedAccountRow[];
  oauthReadyProviders?: Partial<Record<SocialProvider, boolean>>;
  snapshots: SocialSnapshotRow[];
}) {
  const router = useRouter();
  const [provider, setProvider] = useState<SocialProvider>("instagram");
  const [handle, setHandle] = useState("");
  const [accountUrl, setAccountUrl] = useState("");
  const [status, setStatus] = useState<"idle" | "saving" | "syncing" | "error">("idle");
  const [message, setMessage] = useState("");

  async function connect(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("saving");
    setMessage("");
    const response = await fetch("/api/social/connect", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ provider, handle, account_url: accountUrl })
    });
    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      setStatus("error");
      setMessage(body.error ?? "Could not connect account.");
      return;
    }
    setHandle("");
    setAccountUrl("");
    setStatus("idle");
    router.refresh();
  }

  async function sync(accountId: string) {
    setStatus("syncing");
    setMessage("");
    const response = await fetch("/api/social/sync", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ account_id: accountId })
    });
    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      setStatus("error");
      setMessage(body.error ?? "Could not sync account.");
      return;
    }
    setStatus("idle");
    router.refresh();
  }

  return (
    <div className="mb-5 rounded-md border bg-muted p-4">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-sm font-semibold">Connected social accounts</p>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">
            Prototype API layer for Instagram, Facebook, and YouTube. Synced metrics are treated as higher-trust scoring inputs than self-reported screenshots.
          </p>
        </div>
        <Badge tone={accounts.length ? "green" : "amber"}>{accounts.length ? "connected layer active" : "connect accounts"}</Badge>
      </div>

      <div className="mb-4 grid gap-3 md:grid-cols-3">
        {socialProviders.map((item) => {
          const account = accounts.find((row) => row.provider === item.id);
          const latest = snapshots.find((snapshot) => snapshot.provider === item.id);
          const state = getConnectionState(account, latest, Boolean(oauthReadyProviders[item.id]));
          return (
            <div className="rounded-md border bg-white p-3" key={item.id}>
              <div className="mb-2 flex items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold">{item.label}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{item.platformLabel}</p>
                </div>
                <StatusIcon state={state.key} />
              </div>
              <Badge tone={state.tone}>{state.label}</Badge>
              <p className="mt-2 text-xs leading-5 text-muted-foreground">{state.copy}</p>
            </div>
          );
        })}
      </div>

      <form className="grid gap-3 md:grid-cols-[0.7fr_1fr_1.2fr_auto]" onSubmit={connect}>
        <select
          className="h-10 rounded-md border bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
          onChange={(event) => setProvider(event.target.value as SocialProvider)}
          value={provider}
        >
          {socialProviders.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
        </select>
        <Input onChange={(event) => setHandle(event.target.value)} placeholder="@handle or channel name" required value={handle} />
        <Input onChange={(event) => setAccountUrl(event.target.value)} placeholder="Profile/channel URL" value={accountUrl} />
        <Button disabled={status === "saving"} type="submit">{status === "saving" ? "Connecting..." : "Connect"}</Button>
      </form>

      {message ? <p className={`mt-3 text-sm ${status === "error" ? "text-red-600" : "text-emerald-700"}`}>{message}</p> : null}

      <div className="mt-4 grid gap-3 xl:grid-cols-2">
        {accounts.map((account) => {
          const latest = snapshots.find((snapshot) => snapshot.provider === account.provider);
          return (
            <div className="rounded-md border bg-white p-3" key={account.id}>
              <div className="mb-3 flex items-start justify-between gap-3">
                <div>
                  <p className="font-semibold">{providerName(account.provider)} {account.handle}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{accountStatusCopy(account, latest)}</p>
                </div>
                <div className="flex flex-wrap justify-end gap-2">
                  <Badge tone={latest ? "green" : "amber"}>{latest ? "synced" : "waiting for sync"}</Badge>
                  {latest ? <Badge tone={latest.source === "mock_api" ? "blue" : "green"}>{latest.source.replace("_", " ")}</Badge> : null}
                </div>
                <Button disabled={status === "syncing"} onClick={() => sync(account.id)} size="sm" type="button" variant="secondary">
                  <RefreshCw className="h-4 w-4" />
                  Sync
                </Button>
              </div>
              {latest ? (
                <div className="grid gap-2 sm:grid-cols-3">
                  <Signal label="Followers" value={compact(latest.followers)} />
                  <Signal label="Avg views" value={compact(latest.avg_views_30d)} />
                  <Signal label="Engagement" value={`${latest.engagement_rate_30d}%`} />
                  <Signal label="India" value={`${latest.india_audience_percent}%`} />
                  <Signal label="Bangalore" value={`${latest.bangalore_audience_percent}%`} />
                  <Signal label="Source" value={latest.source.replace("_", " ")} />
                  <Signal label="Last sync" value={formatDate(latest.synced_at)} />
                </div>
              ) : (
                <div className="flex items-center gap-2 rounded-md bg-muted p-3 text-sm text-muted-foreground">
                  <ShieldCheck className="h-4 w-4" />
                  Sync this account to generate verified scoring signals.
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Signal({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md bg-muted px-3 py-2">
      <p className="text-[11px] font-semibold uppercase text-muted-foreground">{label}</p>
      <p className="mt-1 text-sm font-semibold">{value}</p>
    </div>
  );
}

function getConnectionState(account: ConnectedAccountRow | undefined, latest: SocialSnapshotRow | undefined, oauthReady: boolean) {
  if (!account) {
    return {
      key: oauthReady ? "not_connected" : "prototype",
      label: oauthReady ? "not connected" : "prototype connect",
      copy: oauthReady ? "OAuth credentials are configured. Connect this provider when ready." : "OAuth credentials are not configured yet, so this uses prototype connect and mock sync.",
      tone: "neutral" as const
    };
  }
  if (String(account.status ?? "").includes("expired")) {
    return { key: "expired", label: "needs reconnect", copy: "The token has expired or permissions need to be renewed.", tone: "red" as const };
  }
  if (!latest) {
    return { key: "waiting", label: "waiting for sync", copy: "Account is connected. Run sync to generate verified scoring signals.", tone: "amber" as const };
  }
  if (String(account.status ?? "").includes("failed")) {
    return { key: "failed", label: "sync failed", copy: "The latest sync failed. Reconnect or retry sync.", tone: "red" as const };
  }
  return { key: "synced", label: "synced", copy: "Metrics are available for scoring and profile verification.", tone: "green" as const };
}

function StatusIcon({ state }: { state: string }) {
  if (state === "synced") return <ShieldCheck className="h-4 w-4 text-emerald-600" />;
  if (state === "expired" || state === "failed") return <ShieldAlert className="h-4 w-4 text-red-600" />;
  return <Cable className="h-4 w-4 text-muted-foreground" />;
}

function accountStatusCopy(account: ConnectedAccountRow, latest?: SocialSnapshotRow) {
  if (!latest) return `Connected as ${account.handle}. Sync required before scores can use this data.`;
  return `Connected as ${account.handle}. Last synced ${formatDate(latest.synced_at)}.`;
}

function providerName(provider: string) {
  return socialProviders.find((item) => item.id === provider)?.label ?? provider;
}

function compact(value = 0) {
  return new Intl.NumberFormat("en-IN", { notation: "compact" }).format(value);
}

function formatDate(value?: string | null) {
  if (!value) return "never";
  return new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "short" }).format(new Date(value));
}
