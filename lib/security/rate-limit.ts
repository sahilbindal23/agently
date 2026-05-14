import type { SupabaseClient } from "@supabase/supabase-js";

// Wrapper around the touch_rate_limit() Postgres RPC (migration 044).
// Each protected route calls enforceRateLimit before doing real work.
// Admins bypass.
//
// Usage:
//   const limit = await enforceRateLimit(supabase, {
//     key: "ai:value-creator", limit: 30, windowSeconds: 3600
//   });
//   if (!limit.allowed) {
//     return NextResponse.json(
//       { error: limit.message },
//       { status: 429, headers: { "Retry-After": String(limit.retry_after_seconds) } }
//     );
//   }

export type RateLimitVerdict = {
  allowed: boolean;
  limit: number;
  count: number;
  retry_after_seconds: number;
  reason: string;
  message: string;
};

export type RateLimitOptions = {
  /** Stable bucket key, e.g. "ai:value-creator". */
  key: string;
  /** Max allowed requests per window. */
  limit: number;
  /** Window length in seconds. Default 1 hour. */
  windowSeconds?: number;
  /** Optional metadata stored on the rate_limits row for audit. */
  metadata?: Record<string, unknown>;
  /** When true, fail-open if the RPC itself errors (default true). */
  failOpen?: boolean;
};

/**
 * Hit the touch_rate_limit RPC for the current authenticated user.
 *
 * Returns `allowed: false` when the bucket is exhausted. The RPC handles
 * the increment + window logic in one round-trip.
 *
 * Fails open by default: if the RPC errors (DB down, permission issue),
 * the request is allowed through. Set failOpen: false to lock down a
 * critical-money path (payment_link, dispute open).
 */
export async function enforceRateLimit(
  supabase: SupabaseClient,
  options: RateLimitOptions
): Promise<RateLimitVerdict> {
  const windowSeconds = options.windowSeconds ?? 3600;
  try {
    const { data, error } = await supabase.rpc("touch_rate_limit", {
      rate_key: options.key,
      max_count: options.limit,
      window_seconds: windowSeconds,
      rate_metadata: options.metadata ?? {}
    });

    if (error) {
      if (options.failOpen === false) {
        return {
          allowed: false,
          limit: options.limit,
          count: 0,
          retry_after_seconds: windowSeconds,
          reason: "rpc_error",
          message: "Rate-limit service unavailable. Try again shortly."
        };
      }
      return {
        allowed: true,
        limit: options.limit,
        count: 0,
        retry_after_seconds: 0,
        reason: "rpc_error_fail_open",
        message: ""
      };
    }

    const result = (data ?? {}) as {
      allowed?: boolean;
      count?: number;
      limit?: number;
      reason?: string;
      retry_after_seconds?: number;
    };
    const allowed = Boolean(result.allowed);
    const count = Number(result.count ?? 0);
    const limit = Number(result.limit ?? options.limit);
    const retry = Number(result.retry_after_seconds ?? windowSeconds);
    const reason = String(result.reason ?? (allowed ? "ok" : "limit_exceeded"));

    return {
      allowed,
      limit,
      count,
      retry_after_seconds: retry,
      reason,
      message: allowed
        ? ""
        : `Too many requests. You can make ${limit} per hour. Try again in about ${Math.ceil(retry / 60)} minute${retry > 60 ? "s" : ""}.`
    };
  } catch {
    if (options.failOpen === false) {
      return {
        allowed: false,
        limit: options.limit,
        count: 0,
        retry_after_seconds: windowSeconds,
        reason: "exception",
        message: "Rate-limit check failed. Try again shortly."
      };
    }
    return {
      allowed: true,
      limit: options.limit,
      count: 0,
      retry_after_seconds: 0,
      reason: "exception_fail_open",
      message: ""
    };
  }
}

/**
 * Convenience: skip the rate check for admins. Returns a synthetic
 * "allowed" verdict so callers can use the same branching code.
 */
export function bypassForAdmin(): RateLimitVerdict {
  return {
    allowed: true,
    limit: Infinity,
    count: 0,
    retry_after_seconds: 0,
    reason: "admin_bypass",
    message: ""
  };
}

/**
 * Canonical per-bucket limits. Centralised so we can tune without finding
 * every route. Per authenticated user per 1-hour window.
 */
export const RATE_LIMITS = {
  "ai:value-creator":    { limit: 30 },
  "ai:brand-match":      { limit: 30 },
  "ai:negotiate":        { limit: 60 },  // can be called more often during a deal
  "ai:scan-contract":    { limit: 20 },
  "ai:audit-creator":    { limit: 20 },
  "ai:audit-brand":      { limit: 20 },
  "phyllo:init":         { limit: 50 },  // SDK token mint
  "social:scrape":       { limit: 100 }, // any of IG / FB / YT / TW scrape
  "messages:send":       { limit: 200 }, // anti-spam
  "payments:create-link":{ limit: 20, failOpen: false }, // financial - never fail open
  "disputes:open":       { limit: 10 },
  "contracts:sign":      { limit: 30 }
} as const;

export type RateLimitBucket = keyof typeof RATE_LIMITS;

/**
 * Route-level convenience wrapper. Returns either:
 *   - null  -> request is allowed, proceed
 *   - NextResponse -> 429 response with proper headers, return immediately
 *
 * Admins bypass automatically. Unauthenticated users get a 401.
 *
 * Audits the block in audit_logs so we can see who's hitting limits.
 *
 * Usage in a route handler:
 *   const gate = await gateRateLimit(request, "ai:value-creator");
 *   if (gate) return gate;
 *   // ... rest of handler
 */
// Implementation lives in rate-limit-gate.ts to keep this module
// server-component-safe. The browser-importable shape is the helpers + types
// above; gateRateLimit needs server-only deps (next/server, supabase server
// client) and so lives in a separate module.
