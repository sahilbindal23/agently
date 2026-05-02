import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const allowedStatuses = ["accepted", "changes_requested", "declined"] as const;

export async function POST(request: Request) {
  const body = await request.json();
  const dealId = String(body.deal_id ?? "").trim();
  const status = String(body.status ?? "").trim() as typeof allowedStatuses[number];
  const response = String(body.response ?? "").trim();

  if (!dealId || !allowedStatuses.includes(status)) {
    return NextResponse.json({ error: "Deal and valid response status are required." }, { status: 400 });
  }

  const auth = await createClient();
  const { data: authData } = await auth.auth.getUser();
  if (!authData.user) return NextResponse.json({ error: "Login required." }, { status: 401 });

  const admin = createAdminClient();
  if (!admin) return NextResponse.json({ error: "Supabase service role key is not configured." }, { status: 500 });

  const { data: deal } = await admin.from("deals").select("*").eq("id", dealId).single();
  if (!deal) return NextResponse.json({ error: "Offer not found." }, { status: 404 });

  const { data: creator } = await admin.from("creators").select("profile_id").eq("id", deal.creator_id).single();
  const { data: profile } = await admin.from("profiles").select("role").eq("id", authData.user.id).single();
  if (creator?.profile_id !== authData.user.id && profile?.role !== "admin") {
    return NextResponse.json({ error: "Not allowed to respond to this offer." }, { status: 403 });
  }

  const nextStage = status === "accepted" ? "negotiating" : deal.stage;
  const { data, error } = await admin
    .from("deals")
    .update({
      offer_status: status,
      talent_response: response,
      responded_at: new Date().toISOString(),
      stage: nextStage,
      notes: [deal.notes, response ? `Talent response: ${response}` : ""].filter(Boolean).join("\n")
    })
    .eq("id", dealId)
    .select("*")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data });
}
