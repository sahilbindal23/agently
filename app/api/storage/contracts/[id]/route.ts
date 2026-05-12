import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";

const SIGNED_URL_TTL_SECONDS = 5 * 60;

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Login required." }, { status: 401 });

  const admin = createAdminClient();
  if (!admin) return NextResponse.json({ error: "Supabase service role key is not configured." }, { status: 500 });

  const { data: contract, error: contractError } = await admin
    .from("contracts")
    .select("id, deal_id, file_path, file_name")
    .eq("id", id)
    .maybeSingle();

  if (contractError) return NextResponse.json({ error: contractError.message }, { status: 500 });
  if (!contract) return NextResponse.json({ error: "Contract not found." }, { status: 404 });
  if (!contract.file_path) return NextResponse.json({ error: "No contract file is attached." }, { status: 404 });

  const canView = await canViewContract(admin, String(contract.deal_id), user);
  if (!canView) return NextResponse.json({ error: "You do not have access to this contract file." }, { status: 403 });

  const { data, error } = await admin.storage
    .from("contracts")
    .createSignedUrl(String(contract.file_path), SIGNED_URL_TTL_SECONDS);

  if (error || !data?.signedUrl) {
    return NextResponse.json({ error: error?.message ?? "Could not create signed contract URL." }, { status: 500 });
  }

  return NextResponse.redirect(data.signedUrl);
}

async function canViewContract(
  admin: NonNullable<ReturnType<typeof createAdminClient>>,
  dealId: string,
  user: NonNullable<Awaited<ReturnType<typeof getCurrentUser>>>
) {
  if (user.role === "admin") return true;

  const { data: deal } = await admin
    .from("deals")
    .select("creator_id, brand_id, campaign_id")
    .eq("id", dealId)
    .maybeSingle();

  if (!deal) return false;

  if (user.role === "creator" || user.role === "freelancer") {
    const { data: creator } = await admin
      .from("creators")
      .select("profile_id")
      .eq("id", deal.creator_id)
      .maybeSingle();
    if (creator?.profile_id === user.id) return true;
  }

  if (user.role === "brand") {
    const [{ data: brand }, { data: audit }, { data: campaign }] = await Promise.all([
      admin.from("brands").select("contact_email").eq("id", deal.brand_id).maybeSingle(),
      admin.from("brand_audits").select("id").eq("profile_id", user.id).eq("brand_id", deal.brand_id).maybeSingle(),
      deal.campaign_id
        ? admin.from("campaigns").select("profile_id").eq("id", deal.campaign_id).maybeSingle()
        : Promise.resolve({ data: null })
    ]);

    return Boolean(
      (brand?.contact_email && String(brand.contact_email).toLowerCase() === user.email.toLowerCase()) ||
      audit ||
      campaign?.profile_id === user.id
    );
  }

  return false;
}
