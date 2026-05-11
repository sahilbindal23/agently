import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth/session";
import { gateRateLimit } from "@/lib/security/rate-limit-gate";
import { createAdminClient } from "@/lib/supabase/admin";

const schema = z.object({
  agreement_id: z.string().uuid(),
  typed_name: z.string().trim().min(2).max(120)
});

export async function POST(request: Request) {
  const gate = await gateRateLimit(request, "contracts:sign");
  if (gate) return gate;

  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Login required." }, { status: 401 });

  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid request." }, { status: 400 });

  const admin = createAdminClient();
  if (!admin) return NextResponse.json({ error: "Service role not configured." }, { status: 500 });

  const { data: agreement } = await admin.from("deal_agreements").select("*").eq("id", parsed.data.agreement_id).maybeSingle();
  if (!agreement) return NextResponse.json({ error: "Agreement not found." }, { status: 404 });
  if (agreement.status === "voided") return NextResponse.json({ error: "This agreement has been voided." }, { status: 409 });
  if (agreement.status === "fully_signed") return NextResponse.json({ error: "This agreement is already fully signed." }, { status: 409 });

  // Determine signer side (brand or talent) based on the user's role and
  // ownership of the underlying deal/project
  const side = await determineSignerSide(admin, user.id, agreement);
  if (!side) return NextResponse.json({ error: "You are not a party to this agreement." }, { status: 403 });

  const ip = String(request.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || null;
  const now = new Date().toISOString();

  if (side === "brand") {
    if (agreement.brand_signed_at) return NextResponse.json({ error: "Brand has already signed." }, { status: 409 });
    await admin.from("deal_agreements").update({
      brand_signed_at: now,
      brand_signed_name: parsed.data.typed_name,
      brand_signed_profile_id: user.id,
      brand_signed_ip: ip
    }).eq("id", agreement.id);
  } else {
    if (agreement.talent_signed_at) return NextResponse.json({ error: "You have already signed." }, { status: 409 });
    await admin.from("deal_agreements").update({
      talent_signed_at: now,
      talent_signed_name: parsed.data.typed_name,
      talent_signed_profile_id: user.id,
      talent_signed_ip: ip
    }).eq("id", agreement.id);
  }

  // Re-fetch and check completion
  const { data: updated } = await admin.from("deal_agreements").select("*").eq("id", agreement.id).single();
  if (updated && updated.brand_signed_at && updated.talent_signed_at && updated.status !== "fully_signed") {
    await admin.from("deal_agreements").update({
      status: "fully_signed",
      fully_signed_at: now
    }).eq("id", agreement.id);
    if (updated.deal_id) {
      await admin.from("deals").update({ agreement_status: "fully_signed", stage: "contracted" }).eq("id", updated.deal_id);
    }
    if (updated.freelancer_project_id) {
      await admin.from("freelancer_projects").update({ agreement_status: "fully_signed" }).eq("id", updated.freelancer_project_id);
    }
  }

  const { data: final } = await admin.from("deal_agreements").select("*").eq("id", agreement.id).single();
  return NextResponse.json({ data: final });
}

async function determineSignerSide(
  admin: NonNullable<ReturnType<typeof createAdminClient>>,
  profileId: string,
  agreement: Record<string, unknown>
): Promise<"brand" | "talent" | null> {
  const { data: profile } = await admin.from("profiles").select("role, email").eq("id", profileId).maybeSingle();
  const role = String(profile?.role ?? "");
  const email = String(profile?.email ?? "").toLowerCase();

  if (role === "admin") {
    // Admin can sign on behalf of either side - default to whichever is unsigned (brand first)
    return agreement.brand_signed_at ? "talent" : "brand";
  }

  if (agreement.deal_id) {
    const { data: deal } = await admin.from("deals").select("brand_id, creator_id").eq("id", String(agreement.deal_id)).maybeSingle();
    if (!deal) return null;
    if (role === "brand") {
      const { data: brand } = await admin.from("brands").select("contact_email").eq("id", deal.brand_id).maybeSingle();
      if (brand && String(brand.contact_email ?? "").toLowerCase() === email) return "brand";
    }
    if (role === "creator") {
      const { data: creator } = await admin.from("creators").select("profile_id").eq("id", deal.creator_id).maybeSingle();
      if (creator && String(creator.profile_id) === profileId) return "talent";
    }
  }

  if (agreement.freelancer_project_id) {
    const { data: project } = await admin.from("freelancer_projects").select("brand_id, freelancer_id").eq("id", String(agreement.freelancer_project_id)).maybeSingle();
    if (!project) return null;
    if (role === "brand") {
      const { data: brand } = await admin.from("brands").select("contact_email").eq("id", project.brand_id).maybeSingle();
      if (brand && String(brand.contact_email ?? "").toLowerCase() === email) return "brand";
    }
    if (role === "freelancer") {
      const { data: freelancer } = await admin.from("freelancers").select("profile_id").eq("id", project.freelancer_id).maybeSingle();
      if (freelancer && String(freelancer.profile_id) === profileId) return "talent";
    }
  }

  return null;
}
