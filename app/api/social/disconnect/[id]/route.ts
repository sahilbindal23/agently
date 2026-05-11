import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { disconnectAccount as phylloDisconnect } from "@/lib/social/phyllo-client";
import { createAdminClient } from "@/lib/supabase/admin";

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Login required." }, { status: 401 });

  const admin = createAdminClient();
  if (!admin) return NextResponse.json({ error: "Service role not configured." }, { status: 500 });

  // Look up the row and verify the current user owns it
  const { data: row } = await admin
    .from("connected_social_accounts")
    .select("id, profile_id, creator_id, brand_id, freelancer_id, provider, handle, phyllo_account_id")
    .eq("id", id)
    .maybeSingle();
  if (!row) return NextResponse.json({ error: "Connection not found." }, { status: 404 });

  // Admin can disconnect anyone; otherwise the owning profile must match
  if (user.role !== "admin" && row.profile_id !== user.id) {
    return NextResponse.json({ error: "You can only disconnect accounts you connected." }, { status: 403 });
  }

  // If this is a Phyllo-managed account, revoke on Phyllo first (best-effort
  // - if Phyllo errors we still delete the local row so the user isn't stuck)
  if (row.phyllo_account_id) {
    try { await phylloDisconnect(String(row.phyllo_account_id)); } catch (err) { console.error("[phyllo] disconnect failed", err); }
  }

  // Drop the connected_social_accounts row
  const { error: delErr } = await admin.from("connected_social_accounts").delete().eq("id", id);
  if (delErr) return NextResponse.json({ error: delErr.message }, { status: 500 });

  // If this was a creator's platform, also drop the matching creator_platforms
  // row so the metrics disappear from marketplace cards and the engine.
  if (row.creator_id) {
    const platformLabel = row.provider === "instagram" ? "Instagram"
      : row.provider === "youtube" ? "YouTube"
      : row.provider === "facebook" ? "Facebook"
      : row.provider === "twitter" ? "Twitter"
      : String(row.provider);
    await admin
      .from("creator_platforms")
      .delete()
      .eq("creator_id", row.creator_id)
      .eq("platform", platformLabel)
      .eq("handle", row.handle);
  }

  return NextResponse.json({ ok: true });
}
