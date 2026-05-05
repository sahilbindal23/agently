"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Cable, CheckCircle2, RefreshCw, ShieldAlert, ShieldCheck } from "lucide-react";
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
            <div className="rounded-md border bg-white p-3 dark:border-white/8 dark:bg-card" key={item.id}>
              <div className="mb-2 flex items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold">{item.label}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{item.platformLabel}</p>
                </div>
                <StatusIcon state={state.key} />
              </div>
              <Badge tone={state.tone}>{state.label}</Badge>
              <p className="mt-2 text-xs leading-5 text-muted-foreground">{state.copy}</p>
              {oauthReadyProviders[item.id] ? (
                <a
                  className="mt-3 inline-flex h-8 items-center justify-center rounded-md border px-3 text-xs font-semibold transition hover:bg-muted dark:border-white/10 dark:hover:bg-white/6"
                  href={`/api/social/connect?provider=${item.id}&return_to=/profile`}
                >
                  Connect with OAuth
                </a>
              ) : null}
            </div>
          );
        })}
      </div>

      <MetaReadinessGuide />

      <form className="grid gap-3 md:grid-cols-[0.7fr_1fr_1.2fr_auto]" onSubmit={connect}>
        <select
          className="h-10 rounded-md border bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-ring dark:border-white/10 dark:bg-card dark:text-foreground"
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
            <div className="rounded-md border bg-white p-3 dark:border-white/8 dark:bg-card" key={account.id}>
              <div className="mb-3 flex items-start justify-between gap-3">
                <div>
                  <p className="font-semibold">{providerName(account.provider)} {account.handle}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{accountStatusCopy(account, latest)}</p>
                </div>
                <div className="flex flex-wrap justify-end gap-2">
                  <Badge tone={latest ? "green" : "amber"}>{latest ? "synced" : "waiting for sync"}</Badge>
                  {latest ? <Badge tone={sourceTone(latest.source)}>{sourceLabel(latest.source)}</Badge> : null}
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
                  <Signal label="Source" value={sourceLabel(latest.source)} />
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

function MetaReadinessGuide() {
  const items = [
    "Use an Instagram Creator or Business account for useful insights.",
    "Keep the Instagram account linked to a Facebook Page.",
    "Grant insights permissions during OAuth when prompted.",
    "If the creator is not ready, use prototype connect until their account setup is fixed."
  ];

  return (
    <div className="mb-4 rounded-md border border-blue-200 bg-blue-50/70 p-3 dark:border-sky-900/60 dark:bg-sky-950/25">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <p className="text-sm font-semibold text-blue-950 dark:text-sky-100">Instagram/Facebook setup checklist</p>
          <p className="mt-1 text-xs leading-5 text-blue-800 dark:text-sky-300">
            Meta works best when the creator has a professional Instagram account connected to a Facebook Page.
          </p>
        </div>
        <Badge tone="blue">Meta ready path</Badge>
      </div>
      <div className="mt-3 grid gap-2 md:grid-cols-2">
        {items.map((item) => (
          <div className="flex items-start gap-2 rounded-md bg-white/70 p-2 text-xs leading-5 text-blue-900 dark:bg-white/5 dark:text-sky-200" key={item}>
            <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
            <span>{item}</span>
          </div>
        ))}
      </div>
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
  if (latest.source.includes("no_creator_data")) {
    return {
      key: "waiting",
      label: "no creator data yet",
      copy: "OAuth worked, but this account has no usable creator performance data yet. Connect an active channel or keep using prototype metrics for demos.",
      tone: "amber" as const
    };
  }
  if (latest.source.includes("permission")) {
    return {
      key: "expired",
      label: "permission needed",
      copy: "The account needs refreshed permissions before Agently can sync creator metrics.",
      tone: "red" as const
    };
  }
  if (latest.source.includes("setup_required")) {
    return {
      key: "waiting",
      label: "setup required",
      copy: "Meta connected, but Agently could not find the required professional account/Page setup.",
      tone: "amber" as const
    };
  }
  if (latest.source === "mock_api") {
    return { key: "synced", label: "prototype metrics synced", copy: "Prototype metrics are available for demo scoring until real social data is connected.", tone: "blue" as const };
  }
  return { key: "synced", label: "verified metrics synced", copy: "Platform metrics are available for scoring and profile verification.", tone: "green" as const };
}

function StatusIcon({ state }: { state: string }) {
  if (state === "synced") return <ShieldCheck className="h-4 w-4 text-emerald-600" />;
  if (state === "expired" || state === "failed") return <ShieldAlert className="h-4 w-4 text-red-600" />;
  return <Cable className="h-4 w-4 text-muted-foreground" />;
}

function accountStatusCopy(account: ConnectedAccountRow, latest?: SocialSnapshotRow) {
  if (!latest) return `Connected as ${account.handle}. Sync required before scores can use this data.`;
  if (latest.source.includes("no_creator_data")) return `Connected as ${account.handle}, but no creator performance data was found.`;
  if (latest.source.includes("permission")) return `Connected as ${account.handle}, but permissions need to be refreshed.`;
  if (latest.source.includes("setup_required")) return `Connected as ${account.handle}, but account setup needs attention.`;
  return `Connected as ${account.handle}. Last synced ${formatDate(latest.synced_at)}.`;
}

function sourceLabel(source: string) {
  if (source === "mock_api") return "prototype metrics";
  if (source.includes("youtube_analytics")) return "youtube analytics";
  if (source.includes("youtube_no_creator")) return "no creator data";
  if (source.includes("permission")) return "permission needed";
  if (source.includes("setup_required")) return "setup required";
  if (source.includes("instagram")) return "instagram api";
  if (source.includes("facebook")) return "facebook api";
  if (source.includes("youtube")) return "youtube api";
  return source.replaceAll("_", " ");
}

function sourceTone(source: string) {
  if (source === "mock_api") return "blue" as const;
  if (source.includes("permission")) return "red" as const;
  if (source.includes("no_creator") || source.includes("setup_required")) return "amber" as const;
  return "green" as const;
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
