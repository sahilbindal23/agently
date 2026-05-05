import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const resolveSchema = z.object({
  resolution: z.enum(["resolved_release", "resolved_refund", "resolved_split", "dismissed"]),
  decision_note: z.string().trim().min(5).max(2000)
});

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const parsed = resolveSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid resolution." }, { status: 400 });
  }

  const auth = await createClient();
  const { data: authData } = await auth.auth.getUser();
  if (!authData.user) return NextResponse.json({ error: "Login required." }, { status: 401 });

  const admin = createAdminClient();
  if (!admin) return NextResponse.json({ error: "Supabase service role key is not configured." }, { status: 500 });

  const { data: profile } = await admin.from("profiles").select("role").eq("id", authData.user.id).single();
  if (profile?.role !== "admin") {
    return NextResponse.json({ error: "Only admins can resolve disputes." }, { status: 403 });
  }

  const { data: dispute } = await admin.from("disputes").select("*").eq("id", id).maybeSingle();
  if (!dispute) return NextResponse.json({ error: "Dispute not found." }, { status: 404 });
  if (dispute.status !== "open") return NextResponse.json({ error: "This dispute is already resolved." }, { status: 409 });

  const { data: updated, error } = await admin
    .from("disputes")
    .update({
      status: parsed.data.resolution,
      decision_note: parsed.data.decision_note,
      resolved_by_profile_id: authData.user.id,
      resolved_at: new Date().toISOString()
    })
    .eq("id", id)
    .select("*")
    .single();
  if (error || !updated) return NextResponse.json({ error: error?.message ?? "Could not resolve dispute." }, { status: 500 });

  if (dispute.deal_id) {
    const dealUpdate: Record<string, string> = { dispute_status: "resolved" };
    if (parsed.data.resolution === "resolved_refund") dealUpdate.payment_status = "refunded";
    if (parsed.data.resolution === "resolved_release") dealUpdate.payment_status = "released";
    await admin.from("deals").update(dealUpdate).eq("id", dispute.deal_id);
  } else if (dispute.freelancer_project_id) {
    const projectUpdate: Record<string, string> = { dispute_status: "resolved" };
    if (parsed.data.resolution === "resolved_refund") projectUpdate.payment_status = "refunded";
    if (parsed.data.resolution === "resolved_release") projectUpdate.payment_status = "released";
    await admin.from("freelancer_projects").update(projectUpdate).eq("id", dispute.freelancer_project_id);
  }

  return NextResponse.json({ data: updated });
}
