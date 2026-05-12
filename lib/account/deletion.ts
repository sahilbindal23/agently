// Shared helpers for self-service and admin-driven account deletion.
//
// Two callers consume this module:
//   - app/api/account/delete/route.ts (user-initiated)
//   - app/api/admin/deletion-requests/[id]/route.ts (admin approve/reject)
//
// The logic preserves transactional rows (deals, payments, contracts) when
// they exist by anonymizing the parent record rather than hard-deleting it.
// That keeps Stripe/Razorpay history, contract signatures, and dispute
// trails intact for tax/audit/legal reasons.

import type { SupabaseClient } from "@supabase/supabase-js";

export type Row = Record<string, unknown>;
export type Blocker = {
  type: string;
  id: string;
  title: string;
  reason: string;
};

export type AccountBundle = {
  brandIds: string[];
  creatorIds: string[];
  freelancerIds: string[];
  profileId: string;
};

export async function getAccountBundle(admin: SupabaseClient, profileId: string, email: string): Promise<AccountBundle> {
  const [{ data: creators }, { data: freelancers }, { data: directBrands }, { data: auditBrands }, { data: campaignBrands }] = await Promise.all([
    admin.from("creators").select("id").eq("profile_id", profileId),
    admin.from("freelancers").select("id").eq("profile_id", profileId),
    admin.from("brands").select("id").or(`contact_email.eq.${email},profile_id.eq.${profileId}`),
    admin.from("brand_audits").select("brand_id").eq("profile_id", profileId),
    admin.from("campaigns").select("brand_id").eq("profile_id", profileId)
  ]);

  const creatorIds = (creators ?? []).map((row) => String(row.id));
  const freelancerIds = (freelancers ?? []).map((row) => String(row.id));
  const brandIds = unique([
    ...((directBrands ?? []).map((row) => String(row.id))),
    ...((auditBrands ?? []).map((row) => String(row.brand_id)).filter(Boolean)),
    ...((campaignBrands ?? []).map((row) => String(row.brand_id)).filter(Boolean))
  ]);

  return { brandIds, creatorIds, freelancerIds, profileId };
}

export async function getDeletionBlockers(admin: SupabaseClient, bundle: AccountBundle): Promise<Blocker[]> {
  const blockers: Blocker[] = [];

  if (bundle.creatorIds.length) {
    const { data: deals } = await admin.from("deals").select("id, title, offer_status, payment_status, deliverable_status, stage").in("creator_id", bundle.creatorIds);
    blockers.push(...activeWorkItems(deals ?? [], "creator_offer"));
  }

  if (bundle.freelancerIds.length) {
    const { data: projects } = await admin.from("freelancer_projects").select("id, title, status, payment_status, deliverable_status").in("freelancer_id", bundle.freelancerIds);
    blockers.push(...activeWorkItems(projects ?? [], "freelancer_project"));
  }

  if (bundle.brandIds.length) {
    const [{ data: brandDeals }, { data: brandProjects }] = await Promise.all([
      admin.from("deals").select("id, title, offer_status, payment_status, deliverable_status, stage").in("brand_id", bundle.brandIds),
      admin.from("freelancer_projects").select("id, title, status, payment_status, deliverable_status").in("brand_id", bundle.brandIds)
    ]);
    blockers.push(...activeWorkItems(brandDeals ?? [], "brand_creator_offer"));
    blockers.push(...activeWorkItems(brandProjects ?? [], "brand_freelancer_project"));
  }

  const { data: disputes } = await admin
    .from("disputes")
    .select("id, target_type, target_id, status")
    .eq("opened_by_profile_id", bundle.profileId)
    .eq("status", "open");
  for (const dispute of disputes ?? []) {
    blockers.push({
      type: "dispute",
      id: String(dispute.id),
      title: `Open dispute on ${String(dispute.target_type ?? "work item")}`,
      reason: "Open disputes must be resolved before self-service deletion."
    });
  }

  return dedupeBlockers(blockers);
}

function activeWorkItems(rows: Row[], type: string): Blocker[] {
  return rows.filter((row) => !isTerminal(row)).map((row) => ({
    type,
    id: String(row.id),
    title: text(row.title, "Active work item"),
    reason: "This offer, project, payment, deliverable, or dispute workflow is still active."
  }));
}

function isTerminal(row: Row) {
  const offerStatus = String(row.offer_status ?? row.status ?? "").toLowerCase();
  const paymentStatus = String(row.payment_status ?? "").toLowerCase();
  const deliverableStatus = String(row.deliverable_status ?? "").toLowerCase();
  const stage = String(row.stage ?? "").toLowerCase();

  if (["pending", "funded", "release_ready", "disputed"].includes(paymentStatus)) return false;
  if (["accepted", "changes_requested", "submitted", "pending_brand_review"].includes(offerStatus)) return false;
  if (["submitted", "revision_requested"].includes(deliverableStatus)) return false;
  if (["negotiating", "funded", "live", "delivered", "approved", "disputed"].includes(stage)) return false;
  return true;
}

export async function anonymizeOrDeleteAccountData(
  admin: SupabaseClient,
  bundle: AccountBundle,
  profileId: string,
  email: string,
  source: "self_service" | "admin_approved" = "self_service"
) {
  const anonymizedEmail = `deleted-${profileId}@agently.local`;

  await admin.from("connected_social_accounts").delete().eq("profile_id", profileId);
  await admin.from("app_notifications").delete().eq("profile_id", profileId);
  await admin.from("notification_preferences").delete().eq("profile_id", profileId);

  for (const creatorId of bundle.creatorIds) {
    const { count } = await admin.from("deals").select("id", { count: "exact", head: true }).eq("creator_id", creatorId);
    if (count) {
      await admin.from("creator_platforms").delete().eq("creator_id", creatorId);
      await admin.from("creators").update({
        profile_id: null,
        display_name: "Deleted creator",
        bio: null,
        image_url: null,
        verification_status: "unverified",
        verification_tier: "deleted"
      }).eq("id", creatorId);
    } else {
      await admin.from("creators").delete().eq("id", creatorId);
    }
  }

  for (const freelancerId of bundle.freelancerIds) {
    const { count } = await admin.from("freelancer_projects").select("id", { count: "exact", head: true }).eq("freelancer_id", freelancerId);
    if (count) {
      await admin.from("portfolio_items").delete().eq("freelancer_id", freelancerId);
      await admin.from("freelancer_service_rates").delete().eq("freelancer_id", freelancerId);
      await admin.from("freelancers").update({
        profile_id: null,
        display_name: "Deleted freelancer",
        bio: null,
        image_url: null,
        verification_status: "unverified",
        verification_tier: "deleted"
      }).eq("id", freelancerId);
    } else {
      await admin.from("freelancers").delete().eq("id", freelancerId);
    }
  }

  for (const brandId of bundle.brandIds) {
    const [{ count: dealCount }, { count: projectCount }, { count: campaignCount }] = await Promise.all([
      admin.from("deals").select("id", { count: "exact", head: true }).eq("brand_id", brandId),
      admin.from("freelancer_projects").select("id", { count: "exact", head: true }).eq("brand_id", brandId),
      admin.from("campaigns").select("id", { count: "exact", head: true }).eq("brand_id", brandId)
    ]);
    if ((dealCount ?? 0) + (projectCount ?? 0) + (campaignCount ?? 0) > 0) {
      await admin.from("brands").update({
        profile_id: null,
        name: "Deleted brand",
        website: null,
        contact_email: anonymizedEmail,
        image_url: null,
        verification_status: "unverified",
        verification_tier: "deleted"
      }).eq("id", brandId);
    } else {
      await admin.from("brands").delete().eq("id", brandId);
    }
  }

  await admin.from("profiles").update({
    email: anonymizedEmail,
    full_name: "Deleted user",
    deletion_status: "completed",
    deletion_requested_at: new Date().toISOString(),
    phyllo_user_id: null
  }).eq("id", profileId);

  await admin.from("profiles").delete().eq("id", profileId);
  await admin.from("account_deletion_requests").insert({
    profile_id: null,
    email,
    role: null,
    status: "completed",
    reason: source === "admin_approved" ? "Admin approved deletion request." : "Self-service deletion completed.",
    metadata: { source, deleted_profile_id: profileId }
  });
}

function unique(values: string[]) {
  return Array.from(new Set(values.filter(Boolean)));
}

function dedupeBlockers(blockers: Blocker[]) {
  const seen = new Set<string>();
  return blockers.filter((blocker) => {
    const key = `${blocker.type}:${blocker.id}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).slice(0, 12);
}

function text(input: unknown, fallback: string) {
  const value = String(input ?? "").trim();
  return value || fallback;
}
