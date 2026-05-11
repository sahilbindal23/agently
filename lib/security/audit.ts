import type { SupabaseClient } from "@supabase/supabase-js";

type AuditInput = {
  actorProfileId?: string | null;
  actorRole?: string | null;
  action: string;
  entityType?: string | null;
  entityId?: string | null;
  request?: Request;
  metadata?: Record<string, unknown>;
};

export async function writeAuditLog(admin: SupabaseClient | null, input: AuditInput) {
  if (!admin) return;

  try {
    await admin.from("audit_logs").insert({
      actor_profile_id: input.actorProfileId ?? null,
      actor_role: input.actorRole ?? null,
      action: input.action,
      entity_type: input.entityType ?? null,
      entity_id: input.entityId ?? null,
      ip_address: clientIp(input.request),
      user_agent: input.request?.headers.get("user-agent") ?? null,
      metadata: input.metadata ?? {}
    });
  } catch {
    // Security telemetry should not block the user workflow.
  }
}

function clientIp(request?: Request) {
  if (!request) return null;
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    null
  );
}
