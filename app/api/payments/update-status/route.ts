import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const allowedStatuses = ["unpaid", "pending", "funded", "release_ready", "released", "refunded", "disputed"] as const;
type EntityType = "deal" | "freelancer_project";

export async function POST(request: Request) {
  const body = await request.json();
  const entityType = String(body.entity_type ?? "deal") as EntityType;
  const entityId = String(body.entity_id ?? "").trim();
  const status = String(body.status ?? "").trim() as typeof allowedStatuses[number];

  if (!entityId || (entityType !== "deal" && entityType !== "freelancer_project") || !allowedStatuses.includes(status)) {
    return NextResponse.json({ error: "Entity, entity type, and valid payment status are required." }, { status: 400 });
  }

  const auth = await createClient();
  const { data: authData } = await auth.auth.getUser();
  if (!authData.user) return NextResponse.json({ error: "Login required." }, { status: 401 });

  const admin = createAdminClient();
  if (!admin) return NextResponse.json({ error: "Supabase service role key is not configured." }, { status: 500 });

  const { data: profile } = await admin.from("profiles").select("role").eq("id", authData.user.id).single();
  if (profile?.role !== "admin" && profile?.role !== "brand") {
    return NextResponse.json({ error: "Only brands or admins can update payment status in this prototype." }, { status: 403 });
  }

  if (entityType === "deal") {
    const { data, error } = await admin
      .from("deals")
      .update({ payment_status: status })
      .eq("id", entityId)
      .select("*")
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    await upsertPaymentForDeal(admin, data, status);
    return NextResponse.json({ data });
  }

  const { data, error } = await admin
    .from("freelancer_projects")
    .update({ payment_status: status })
    .eq("id", entityId)
    .select("*")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data });
}

async function upsertPaymentForDeal(admin: NonNullable<ReturnType<typeof createAdminClient>>, deal: Record<string, unknown>, status: string) {
  const amount = Number(deal.amount_cents ?? 0);
  const platformFee = Math.round(amount * 0.1);
  await admin.from("payments").upsert({
    deal_id: String(deal.id),
    amount_cents: amount,
    platform_fee_cents: platformFee,
    creator_payout_cents: Math.max(0, amount - platformFee),
    status,
    funded_at: status === "funded" ? new Date().toISOString() : null,
    released_at: status === "released" ? new Date().toISOString() : null
  }, { onConflict: "deal_id" });
}
