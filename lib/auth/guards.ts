import { redirect } from "next/navigation";
import { getCurrentUser, type CurrentUser } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";

// Server-side authorization guards. These are the authoritative access checks
// — they read the role from the profiles table (via getCurrentUser, which uses
// the service-role client) and resolve resource ownership server-side. Never
// trust the client, the URL, or auth user_metadata for authorization: a logged-
// in user can rewrite their own user_metadata, so role MUST come from profiles.

export type Role = "admin" | "creator" | "brand" | "freelancer";

export function homeForRole(role: string): string {
  if (role === "creator") return "/creator-home";
  if (role === "brand") return "/brand-home";
  if (role === "freelancer") return "/freelancer-home";
  if (role === "admin") return "/dashboard";
  return "/login";
}

/** Require a logged-in user; redirect to /login otherwise. */
export async function requireUser(): Promise<NonNullable<CurrentUser>> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

/**
 * Require one of the given roles. Redirects an authenticated user who lacks the
 * role to their own home (not an error page) and an anonymous user to /login.
 * Use at the top of every role-restricted page so access never depends on the
 * middleware alone.
 */
export async function requireRole(...roles: Role[]): Promise<NonNullable<CurrentUser>> {
  const user = await requireUser();
  if (!roles.includes(user.role)) redirect(homeForRole(user.role));
  return user;
}

/**
 * True if the user is a commercial party on the deal (the creator, the brand,
 * or the campaign owner) or an admin. Mirrors the can_access_deal() RLS helper
 * so service-role page reads enforce the same boundary RLS would.
 */
export async function canAccessDeal(user: CurrentUser, dealId: string): Promise<boolean> {
  if (!user || !dealId) return false;
  if (user.role === "admin") return true;
  const admin = createAdminClient();
  if (!admin) return false;

  const { data: deal } = await admin
    .from("deals")
    .select("creator_id, brand_id, campaign_id")
    .eq("id", dealId)
    .maybeSingle();
  if (!deal) return false;

  if (deal.creator_id) {
    const { data: creator } = await admin.from("creators").select("profile_id").eq("id", deal.creator_id).maybeSingle();
    if (creator?.profile_id && creator.profile_id === user.id) return true;
  }
  if (deal.brand_id && (await userOwnsBrand(admin, deal.brand_id, user))) return true;
  if (deal.campaign_id) {
    const { data: campaign } = await admin.from("campaigns").select("profile_id").eq("id", deal.campaign_id).maybeSingle();
    if (campaign?.profile_id && campaign.profile_id === user.id) return true;
  }
  return false;
}

/**
 * True if the user owns the campaign (created it, or owns the brand it belongs
 * to) or is an admin. Campaigns are brand-side, so only owners and admins see
 * the brief, budget, shortlist, and roster.
 */
export async function canAccessCampaign(user: CurrentUser, campaignId: string): Promise<boolean> {
  if (!user || !campaignId) return false;
  if (user.role === "admin") return true;
  const admin = createAdminClient();
  if (!admin) return false;

  const { data: campaign } = await admin
    .from("campaigns")
    .select("profile_id, brand_id")
    .eq("id", campaignId)
    .maybeSingle();
  if (!campaign) return false;

  if (campaign.profile_id && campaign.profile_id === user.id) return true;
  if (campaign.brand_id && (await userOwnsBrand(admin, campaign.brand_id, user))) return true;
  return false;
}

async function userOwnsBrand(
  admin: NonNullable<ReturnType<typeof createAdminClient>>,
  brandId: string,
  user: NonNullable<CurrentUser>
): Promise<boolean> {
  const { data: brand } = await admin.from("brands").select("contact_email, profile_id").eq("id", brandId).maybeSingle();
  if (!brand) return false;
  if (brand.profile_id && brand.profile_id === user.id) return true;
  return Boolean(brand.contact_email) && String(brand.contact_email).toLowerCase() === user.email.toLowerCase();
}
