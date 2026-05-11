import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { createPhylloUser, createSdkToken, getPhylloFrontendEnvironment, getPhylloUserByExternalId, isPhylloConfigured, PHYLLO_PRODUCTS_DEFAULT } from "@/lib/social/phyllo-client";
import { createAdminClient } from "@/lib/supabase/admin";

// Combined endpoint: ensures a Phyllo user exists for the current Agently
// profile, then mints a fresh SDK token. Frontend calls this once per
// Connect-button click, gets back { user_id, sdk_token, environment }, and
// hands those to the Phyllo Connect SDK.

export async function POST() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Login required." }, { status: 401 });
  if (!isPhylloConfigured()) {
    return NextResponse.json({ error: "Phyllo credentials are not configured on the server." }, { status: 500 });
  }

  const admin = createAdminClient();
  if (!admin) return NextResponse.json({ error: "Service role not configured." }, { status: 500 });

  // Reuse the existing Phyllo user_id if we have one, otherwise create
  const { data: profile } = await admin.from("profiles").select("phyllo_user_id, full_name, email").eq("id", user.id).maybeSingle();
  let phylloUserId = profile?.phyllo_user_id ? String(profile.phyllo_user_id) : null;

  if (!phylloUserId) {
    const externalId = user.id;
    const existing = await getPhylloUserByExternalId(externalId);
    if (existing.ok && existing.data.id) {
      phylloUserId = existing.data.id;
      await admin.from("profiles").update({
        phyllo_user_id: phylloUserId,
        phyllo_user_created_at: new Date().toISOString()
      }).eq("id", user.id);
    }
  }

  if (!phylloUserId) {
    const created = await createPhylloUser({
      name: String(profile?.full_name ?? user.full_name ?? "Agently user"),
      external_id: user.id
    });
    if (!created.ok) {
      return NextResponse.json({ error: `Phyllo user creation failed: ${created.error}` }, { status: 502 });
    }
    phylloUserId = created.data.id;
    await admin.from("profiles").update({
      phyllo_user_id: phylloUserId,
      phyllo_user_created_at: new Date().toISOString()
    }).eq("id", user.id);
  }

  const token = await createSdkToken({ user_id: phylloUserId, products: PHYLLO_PRODUCTS_DEFAULT });
  if (!token.ok) {
    return NextResponse.json({ error: `Phyllo SDK token failed: ${token.error}` }, { status: 502 });
  }

  return NextResponse.json({
    user_id: phylloUserId,
    sdk_token: token.data.sdk_token,
    expires_at: token.data.expires_at,
    environment: getPhylloFrontendEnvironment()
  });
}
