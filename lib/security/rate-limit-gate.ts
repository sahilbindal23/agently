import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { writeAuditLog } from "@/lib/security/audit";
import { enforceRateLimit, RATE_LIMITS, type RateLimitBucket } from "@/lib/security/rate-limit";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

type GateOptions = {
  /** Override the default limit/window from RATE_LIMITS. */
  limit?: number;
  windowSeconds?: number;
  /** Audit-log the block (default true). Disable for ultra-hot paths if needed. */
  auditOnBlock?: boolean;
};

/**
 * Wrap a route handler with auth + rate-limit. Returns null when the request
 * should proceed, or a NextResponse the caller should return immediately.
 */
export async function gateRateLimit(
  request: Request,
  bucket: RateLimitBucket,
  options: GateOptions = {}
): Promise<NextResponse | null> {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Login required." }, { status: 401 });
  }

  // Admins are not subject to rate limits.
  if (user.role === "admin") return null;

  const defaults = RATE_LIMITS[bucket];
  const limit = options.limit ?? defaults.limit;
  const failOpen = "failOpen" in defaults ? defaults.failOpen : true;

  const supabase = await createClient();
  const verdict = await enforceRateLimit(supabase, {
    key: bucket,
    limit,
    windowSeconds: options.windowSeconds,
    failOpen
  });

  if (verdict.allowed) return null;

  // Audit-log the block so admins can see who's hitting limits.
  if (options.auditOnBlock !== false) {
    const admin = createAdminClient();
    await writeAuditLog(admin, {
      actorProfileId: user.id,
      actorRole: user.role,
      action: "rate_limit_exceeded",
      entityType: "rate_limit_bucket",
      entityId: bucket,
      request,
      metadata: {
        bucket,
        limit: verdict.limit,
        count: verdict.count,
        reason: verdict.reason
      }
    });
  }

  return NextResponse.json(
    { error: verdict.message, bucket, retry_after_seconds: verdict.retry_after_seconds },
    { status: 429, headers: { "Retry-After": String(verdict.retry_after_seconds) } }
  );
}
