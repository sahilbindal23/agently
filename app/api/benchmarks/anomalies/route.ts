import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";

const resolveSchema = z.object({
  anomaly_id: z.string().uuid(),
  resolution: z.enum(["confirmed_normal", "confirmed_outlier", "rejected", "manual_override"]),
  resolution_note: z.string().trim().min(3).max(2000)
});

export async function GET() {
  const user = await getCurrentUser();
  if (!user || user.role !== "admin") return NextResponse.json({ error: "Admin only." }, { status: 403 });
  const admin = createAdminClient();
  if (!admin) return NextResponse.json({ error: "Service role key missing." }, { status: 500 });

  const { data, error } = await admin
    .from("benchmark_anomalies_review")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data: data ?? [] });
}

export async function PATCH(request: Request) {
  const user = await getCurrentUser();
  if (!user || user.role !== "admin") return NextResponse.json({ error: "Admin only." }, { status: 403 });

  const parsed = resolveSchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid request." }, { status: 400 });

  const admin = createAdminClient();
  if (!admin) return NextResponse.json({ error: "Service role key missing." }, { status: 500 });

  const { data: anomaly } = await admin.from("benchmark_anomalies").select("*").eq("id", parsed.data.anomaly_id).maybeSingle();
  if (!anomaly) return NextResponse.json({ error: "Anomaly not found." }, { status: 404 });

  // If admin says "rejected", flip the underlying observation to outlier_status='rejected' so it stops counting in matview
  if (parsed.data.resolution === "rejected" && anomaly.observation_id) {
    await admin.from("rate_observations").update({ outlier_status: "rejected" }).eq("id", anomaly.observation_id);
  }
  // If admin says "confirmed_normal", flip the observation back to normal
  if (parsed.data.resolution === "confirmed_normal" && anomaly.observation_id) {
    await admin.from("rate_observations").update({ outlier_status: "normal" }).eq("id", anomaly.observation_id);
  }

  const { data, error } = await admin
    .from("benchmark_anomalies")
    .update({
      resolved_at: new Date().toISOString(),
      resolved_by_profile_id: user.id,
      resolution: parsed.data.resolution,
      resolution_note: parsed.data.resolution_note
    })
    .eq("id", parsed.data.anomaly_id)
    .select("*")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Refresh matview so resolution takes effect immediately (best-effort)
  try { await admin.rpc("refresh_benchmark_aggregates"); } catch { /* ignore - cron will refresh */ }

  return NextResponse.json({ data });
}
