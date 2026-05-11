"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Cable, CheckCircle2, RefreshCw, ShieldAlert, ShieldCheck, Sparkles, Trash2 } from "lucide-react";
import { socialProviders, type SocialProvider } from "@/lib/social/platforms";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

// Flip to true once Meta App Review and Google OAuth verification are
// approved. OAuth route handlers stay live regardless; this only controls
// whether the per-provider "Connect with OAuth" button is visible.
const SHOW_OAUTH_BUTTONS = false;

// Phyllo Connect SDK loader URL. Provided by Phyllo.
const PHYLLO_SDK_URL = "https://cdn.getphyllo.com/connect/v2/phyllo-connect.js";

// Augment window with the Phyllo SDK type so TS doesn't complain.
declare global {
  interface Window {
    PhylloConnect?: {
      initialize: (config: {
        clientDisplayName: string;
        environment: "staging" | "sandbox" | "production";
        userId: string;
        token: string;
      }) => PhylloConnectInstance;
    };
  }
}
type PhylloConnectInstance = {
  open: () => void;
  // Phyllo validates each callback's arity (Function.length) against the
  // event it's bound to. We have to use explicit named parameters - rest
  // args don't satisfy the check.
  on: {
    (event: "accountConnected", cb: (accountId: string, workplatformId: string, userId: string) => void): void;
    (event: "accountDisconnected", cb: (accountId: string, workplatformId: string, userId: string) => void): void;
    (event: "tokenExpired", cb: (userId: string) => void): void;
    (event: "exit", cb: (reason: string, userId: string) => void): void;
    (event: "connectionFailure", cb: (reason: string, workplatformId: string, userId: string) => void): void;
  };
};

type PhylloSyncInput = {
  accountId: string | null;
  workplatformId: string | null;
};

function loadPhylloSdk(): Promise<NonNullable<Window["PhylloConnect"]>> {
  if (typeof window === "undefined") return Promise.reject(new Error("Not in browser"));
  if (window.PhylloConnect) return Promise.resolve(window.PhylloConnect);
  return new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${PHYLLO_SDK_URL}"]`);
    if (existing) {
      existing.addEventListener("load", () => {
        if (window.PhylloConnect) resolve(window.PhylloConnect);
        else reject(new Error("Phyllo SDK loaded but global is missing"));
      });
      existing.addEventListener("error", () => reject(new Error("Phyllo SDK failed to load")));
      return;
    }
    const script = document.createElement("script");
    script.src = PHYLLO_SDK_URL;
    script.async = true;
    script.onload = () => {
      if (window.PhylloConnect) resolve(window.PhylloConnect);
      else reject(new Error("Phyllo SDK loaded but global is missing"));
    };
    script.onerror = () => reject(new Error("Phyllo SDK failed to load"));
    document.head.appendChild(script);
  });
}

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

  async function disconnect(accountRowId: string) {
    if (!confirm("Disconnect this account? Verified metrics will be removed.")) return;
    setStatus("syncing");
    setMessage("");
    const response = await fetch(`/api/social/disconnect/${accountRowId}`, { method: "DELETE" });
    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      setStatus("error");
      setMessage(body.error ?? "Could not disconnect account.");
      return;
    }
    setStatus("idle");
    setMessage("Account disconnected.");
    router.refresh();
  }

  async function connectViaPhyllo() {
    setStatus("saving");
    setMessage("");
    try {
      // 1. Get a fresh SDK token + user_id from our backend
      const initRes = await fetch("/api/social/phyllo/init", { method: "POST" });
      if (!initRes.ok) {
        const body = await initRes.json().catch(() => ({}));
        setStatus("error");
        setMessage(body.error ?? "Could not start Phyllo Connect.");
        return;
      }
      const { user_id, sdk_token, environment } = await initRes.json();

      // 2. Load the Phyllo SDK
      const PhylloConnect = await loadPhylloSdk();

      // 3. Initialize + open the modal
      const phyllo = PhylloConnect.initialize({
        clientDisplayName: "Agently",
        environment,
        userId: user_id,
        token: sdk_token
      });

      async function syncPhylloAccount(input: PhylloSyncInput) {
        if (!input.accountId || !input.workplatformId) {
          setStatus("error");
          setMessage("Phyllo connected, but did not return enough account details to sync. Please try connecting again.");
          return;
        }

        // Tell our backend to fetch the profile and store metrics
        const res = await fetch("/api/social/phyllo/sync-account", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ account_id: input.accountId, work_platform_id: input.workplatformId })
        });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          setStatus("error");
          setMessage(body.error ?? "Connected, but failed to sync profile data. Try the Sync button.");
          return;
        }
        setStatus("idle");
        setMessage("Account connected and synced.");
        router.refresh();
      }

      // Phyllo's web SDK validates Function.length for every mandatory
      // callback before opening the modal. Keep these as classic functions
      // with explicit parameters so the arity stays exactly what the SDK
      // expects after bundling.
      function onAccountConnected(accountId: string, workplatformId: string, phylloUserId: string) {
        void phylloUserId;
        void syncPhylloAccount({ accountId, workplatformId }).catch(() => {
          setStatus("error");
          setMessage("Connected, but failed to sync profile data. Try the Sync button.");
        });
      }

      function onAccountDisconnected(accountId: string, workplatformId: string, phylloUserId: string) {
        void accountId;
        void workplatformId;
        void phylloUserId;
        router.refresh();
      }

      function onTokenExpired(phylloUserId: string) {
        void phylloUserId;
        setStatus("error");
        setMessage("Phyllo session expired. Click Connect via Phyllo again.");
      }

      function onExit(reason: string, phylloUserId: string) {
        void reason;
        void phylloUserId;
        setStatus("idle");
      }

      function onConnectionFailure(reason: string, workplatformId: string, phylloUserId: string) {
        void workplatformId;
        void phylloUserId;
        setStatus("error");
        setMessage(`Phyllo connection failed: ${reason}`);
      }

      phyllo.on("accountConnected", onAccountConnected);
      phyllo.on("accountDisconnected", onAccountDisconnected);
      phyllo.on("tokenExpired", onTokenExpired);
      phyllo.on("exit", onExit);
      phyllo.on("connectionFailure", onConnectionFailure);

      phyllo.open();
      setStatus("idle");
    } catch (err) {
      setStatus("error");
      setMessage(err instanceof Error ? err.message : "Could not open Phyllo Connect.");
    }
  }

  return (
    <div className="mb-5 rounded-md border bg-muted p-4">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-sm font-semibold">Connected social accounts</p>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">
            Add your Instagram and YouTube handles below. Verified connections help Agently confirm follower counts and performance signals.
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
              {/* OAuth Connect button intentionally hidden from UI while
                  Meta/Google App Verification is in progress. The route
                  `/api/social/connect?provider=...` remains live for when
                  verification is approved - just flip SHOW_OAUTH_BUTTONS to
                  true below. Users currently verify via the public-API path
                  (Instagram scraper / YouTube Data API) instead. */}
              {SHOW_OAUTH_BUTTONS && oauthReadyProviders[item.id] ? (
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

      <div className="mb-4 rounded-md border border-primary/30 bg-primary/5 p-4 dark:border-primary/40 dark:bg-primary/10">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-semibold">Verify with one click via Phyllo</p>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">Opens a Phyllo-hosted login modal for Instagram, YouTube, Facebook, or Twitter. Real follower counts and engagement land here automatically. No Meta App Review needed.</p>
          </div>
          <Button onClick={connectViaPhyllo} disabled={status === "saving"} type="button">
            <Sparkles className="h-4 w-4" />
            {status === "saving" ? "Opening..." : "Connect via Phyllo"}
          </Button>
        </div>
      </div>

      <p className="mb-2 text-xs uppercase tracking-wide text-muted-foreground">Or save a handle manually (no verified metrics)</p>
      <form className="grid gap-3 md:grid-cols-[minmax(180px,0.7fr)_minmax(220px,1fr)_minmax(260px,1.2fr)_auto] md:items-center" onSubmit={connect}>
        <select
          className="h-10 w-full rounded-md border bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-ring dark:border-white/10 dark:bg-card dark:text-foreground"
          onChange={(event) => setProvider(event.target.value as SocialProvider)}
          value={provider}
        >
          {socialProviders.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
        </select>
        <Input onChange={(event) => setHandle(event.target.value)} placeholder="@handle or channel name" required value={handle} />
        <Input onChange={(event) => setAccountUrl(event.target.value)} placeholder="Profile/channel URL" value={accountUrl} />
        <Button className="h-10 w-full md:w-auto" disabled={status === "saving"} type="submit">{status === "saving" ? "Connecting..." : "Connect"}</Button>
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
                <div className="flex flex-wrap gap-2">
                  <Button disabled={status === "syncing"} onClick={() => sync(account.id)} size="sm" type="button" variant="secondary">
                    <RefreshCw className="h-4 w-4" />
                    Sync
                  </Button>
                  <Button disabled={status === "syncing"} onClick={() => disconnect(account.id)} size="sm" type="button" variant="danger">
                    <Trash2 className="h-4 w-4" />
                    Disconnect
                  </Button>
                </div>
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
    "Grant insights permissions during OAuth once the Meta app is approved for them.",
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
  if (account.status === "oauth_limited") {
    return {
      key: "waiting",
      label: "basic login connected",
      copy: "Meta login worked. Insights sync needs an Instagram professional account linked to a Facebook Page plus approved Meta business permissions.",
      tone: "amber" as const
    };
  }
  if (account.status === "pending_metric_review") {
    return {
      key: "waiting",
      label: "pending metric review",
      copy: "The handle is saved, but manual sync cannot verify audience metrics. Scores will not use these numbers until OAuth/API data or admin review is available.",
      tone: "amber" as const
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
  if (latest.source.includes("no_metrics")) {
    return {
      key: "waiting",
      label: "profile metrics needed",
      copy: "Prototype connect worked, but Agently did not find follower/view metrics on this profile. Add platform metrics or use OAuth for verified data.",
      tone: "amber" as const
    };
  }
  if (latest.source.includes("self_reported")) {
    return {
      key: "waiting",
      label: "pending review",
      copy: "Manual connect saved this handle, but it does not verify follower or view metrics. Use OAuth/API sync for score-driving data.",
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
  if (account.status === "oauth_limited") return `Connected as ${account.handle}. Full insights sync needs Meta Page/Instagram permissions.`;
  if (account.status === "pending_metric_review") return `Connected as ${account.handle}. Manual connection is saved, but metrics are not verified.`;
  if (!latest) return `Connected as ${account.handle}. Sync required before scores can use this data.`;
  if (latest.source.includes("no_creator_data")) return `Connected as ${account.handle}, but no creator performance data was found.`;
  if (latest.source.includes("permission")) return `Connected as ${account.handle}, but permissions need to be refreshed.`;
  if (latest.source.includes("setup_required")) return `Connected as ${account.handle}, but account setup needs attention.`;
  if (latest.source.includes("no_metrics")) return `Connected as ${account.handle}, but profile metrics need to be added before scoring.`;
  if (latest.source.includes("self_reported")) return `Connected as ${account.handle}. Manual handles do not verify audience metrics.`;
  return `Connected as ${account.handle}. Last synced ${formatDate(latest.synced_at)}.`;
}

function sourceLabel(source: string) {
  if (source === "mock_api") return "prototype metrics";
  if (source.includes("youtube_analytics")) return "youtube analytics";
  if (source.includes("youtube_no_creator")) return "no creator data";
  if (source.includes("manual_connect")) return "manual review needed";
  if (source.includes("no_metrics")) return "profile metrics needed";
  if (source.includes("permission")) return "permission needed";
  if (source.includes("setup_required")) return "setup required";
  if (source.includes("self_reported")) return "pending review";
  if (source.includes("instagram")) return "instagram api";
  if (source.includes("facebook")) return "facebook api";
  if (source.includes("youtube")) return "youtube api";
  return source.replaceAll("_", " ");
}

function sourceTone(source: string) {
  if (source === "mock_api") return "blue" as const;
  if (source.includes("permission")) return "red" as const;
  if (source.includes("no_creator") || source.includes("setup_required") || source.includes("no_metrics") || source.includes("self_reported")) return "amber" as const;
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
