import type { SupabaseClient, User } from "@supabase/supabase-js";

type TrackEventInput = {
  eventName: string;
  profileId?: string | null;
  role?: string | null;
  entityType?: string | null;
  entityId?: string | null;
  metadata?: Record<string, unknown>;
};

export async function trackEvent(admin: SupabaseClient | null, input: TrackEventInput) {
  if (!admin) return;

  try {
    await admin.from("product_events").insert({
      profile_id: input.profileId ?? null,
      role: input.role ?? null,
      event_name: input.eventName,
      entity_type: input.entityType ?? null,
      entity_id: input.entityId ?? null,
      metadata: input.metadata ?? {}
    });
  } catch {
    // Product telemetry should never block the core workflow.
  }
}

export function userEventBase(user: User, role?: string | null) {
  return {
    profileId: user.id,
    role: role ?? String(user.user_metadata?.role ?? "")
  };
}
