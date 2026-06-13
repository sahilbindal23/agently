import { NextResponse } from "next/server";
import { z } from "zod";
import { gateRateLimit } from "@/lib/security/rate-limit-gate";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { isHttpUrl } from "@/lib/utils/safe-url";

const openSchema = z.object({
  deal_id: z.string().uuid().optional(),
  freelancer_project_id: z.string().uuid().optional(),
  reason: z.string().trim().min(10, "Please describe the issue in at least 10 characters.").max(2000),
  evidence_url: z.string().trim().url("Evidence URL must be a valid link.").max(500).refine(isHttpUrl, "Evidence link must start with http:// or https://").optional().or(z.literal(""))
}).refine((data) => Boolean(data.deal_id) !== Boolean(data.freelancer_project_id), {
  message: "Provide exactly one of deal_id or freelancer_project_id."
});

export async function GET() {
  const auth = await createClient();
  const { data: authData } = await auth.auth.getUser();
  if (!authData.user) return NextResponse.json({ error: "Login required." }, { status: 401 });

  const admin = createAdminClient();
  if (!admin) return NextResponse.json({ error: "Supabase service role key is not configured." }, { status: 500 });

  const { data: profile } = await admin.from("profiles").select("role").eq("id", authData.user.id).single();
  const role = String(profile?.role ?? "");

  if (role === "admin") {
    const { data, error } = await admin.from("disputes").select("*").order("created_at", { ascending: false });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ data: data ?? [] });
  }

  const { data, error } = await admin
    .from("disputes")
    .select("*")
    .eq("opened_by_profile_id", authData.user.id)
    .order("created_at", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data: data ?? [] });
}

export async function POST(request: Request) {
  const gate = await gateRateLimit(request, "disputes:open");
  if (gate) return gate;

  const parsed = openSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid dispute payload." }, { status: 400 });
  }
  const body = parsed.data;

  const auth = await createClient();
  const { data: authData } = await auth.auth.getUser();
  if (!authData.user) return NextResponse.json({ error: "Login required." }, { status: 401 });

  const admin = createAdminClient();
  if (!admin) return NextResponse.json({ error: "Supabase service role key is not configured." }, { status: 500 });

  const { data: profile } = await admin.from("profiles").select("role").eq("id", authData.user.id).single();
  const role = String(profile?.role ?? "");
  if (!["brand", "creator", "freelancer"].includes(role)) {
    return NextResponse.json({ error: "Only the brand or talent on this contract can open a dispute." }, { status: 403 });
  }

  const authorized = await isPartyToContract(admin, authData.user.id, role, body.deal_id, body.freelancer_project_id);
  if (!authorized) {
    return NextResponse.json({ error: "You are not a party to this contract." }, { status: 403 });
  }

  const existing = await admin
    .from("disputes")
    .select("id")
    .eq("status", "open")
    .match(body.deal_id ? { deal_id: body.deal_id } : { freelancer_project_id: body.freelancer_project_id })
    .maybeSingle();
  if (existing.data) {
    return NextResponse.json({ error: "There is already an open dispute on this contract." }, { status: 409 });
  }

  const { data: dispute, error } = await admin
    .from("disputes")
    .insert({
      deal_id: body.deal_id ?? null,
      freelancer_project_id: body.freelancer_project_id ?? null,
      opened_by_profile_id: authData.user.id,
      opener_role: role,
      reason: body.reason,
      evidence_url: body.evidence_url || null,
      status: "open"
    })
    .select("*")
    .single();
  if (error || !dispute) return NextResponse.json({ error: error?.message ?? "Could not open dispute." }, { status: 500 });

  if (body.deal_id) {
    await admin.from("deals").update({ dispute_status: "open" }).eq("id", body.deal_id);
  } else if (body.freelancer_project_id) {
    await admin.from("freelancer_projects").update({ dispute_status: "open" }).eq("id", body.freelancer_project_id);
  }

  return NextResponse.json({ data: dispute }, { status: 201 });
}

async function isPartyToContract(
  admin: NonNullable<ReturnType<typeof createAdminClient>>,
  profileId: string,
  role: string,
  dealId?: string,
  projectId?: string
) {
  if (dealId) {
    const { data: deal } = await admin.from("deals").select("creator_id, brand_id").eq("id", dealId).maybeSingle();
    if (!deal) return false;
    if (role === "creator") {
      const { data: creator } = await admin.from("creators").select("id").eq("profile_id", profileId).maybeSingle();
      return creator?.id === deal.creator_id;
    }
    if (role === "brand") {
      const { data: brands } = await admin.from("brands").select("id, contact_email").eq("id", deal.brand_id);
      const { data: user } = await admin.from("profiles").select("email").eq("id", profileId).maybeSingle();
      return Boolean((brands ?? []).find((b) => b.contact_email === user?.email));
    }
    return false;
  }
  if (projectId) {
    const { data: project } = await admin.from("freelancer_projects").select("freelancer_id, brand_id").eq("id", projectId).maybeSingle();
    if (!project) return false;
    if (role === "freelancer") {
      const { data: freelancer } = await admin.from("freelancers").select("id").eq("profile_id", profileId).maybeSingle();
      return freelancer?.id === project.freelancer_id;
    }
    if (role === "brand") {
      const { data: brands } = await admin.from("brands").select("id, contact_email").eq("id", project.brand_id);
      const { data: user } = await admin.from("profiles").select("email").eq("id", profileId).maybeSingle();
      return Boolean((brands ?? []).find((b) => b.contact_email === user?.email));
    }
    return false;
  }
  return false;
}
