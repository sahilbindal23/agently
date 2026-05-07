import { redirect } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/layout/page-header";
import { PayoutReadinessCard } from "@/components/profile/payout-readiness-card";
import { ProfileEditForm } from "@/components/profile/profile-edit-form";
import { ProfileImageUpload } from "@/components/profile/profile-image-upload";
import { ConnectedAccountsPanel, type ConnectedAccountRow, type SocialSnapshotRow } from "@/components/social/connected-accounts-panel";
import { ScoreTransparencyCard } from "@/components/social/score-transparency-card";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { VerificationBadge } from "@/components/verification/verification-badge";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export default async function ProfilePage() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect("/login");

  const admin = createAdminClient();
  if (!admin) redirect("/app");

  const { data: profile } = await admin.from("profiles").select("*").eq("id", data.user.id).single();
  const role = String(profile?.role ?? data.user.user_metadata?.role ?? "creator");
  const bundle = await getProfileBundle(role, data.user.id, data.user.email ?? "");

  if (!bundle.profile) {
    redirect("/intake");
  }

  return (
    <AppShell>
      <PageHeader
        eyebrow="Profile settings"
        title="Edit your Agently profile"
        description="Update the data used for marketplace cards, readiness checklists, AI matching, valuation, campaign recommendations, and payment workflow context."
      />
      <Card>
        <CardHeader>
          <div>
            <CardTitle>{roleLabel(role)} profile</CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">Changes save to Supabase and update your dashboard immediately.</p>
          </div>
          <div className="flex flex-col items-end gap-2">
            <Badge tone="blue">{role}</Badge>
            <VerificationBadge status={bundle.profile.verification_status} tier={bundle.profile.verification_tier} />
          </div>
        </CardHeader>
        <div className="mb-5 rounded-md border bg-muted p-4">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold">Profile image</p>
              <p className="mt-1 text-xs text-muted-foreground">Shown on marketplace cards, recommendations, and profile pages.</p>
            </div>
            {bundle.profile.image_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img alt="Profile" className="h-14 w-14 rounded-md object-cover" src={String(bundle.profile.image_url)} />
            ) : null}
          </div>
        <ProfileImageUpload entityId={String(bundle.profile.id)} entityType={role as "creator" | "brand" | "freelancer"} />
        </div>
        {role === "creator" ? (
          <>
            <ConnectedAccountsPanel
              accounts={bundle.connectedAccounts as ConnectedAccountRow[]}
              oauthReadyProviders={oauthReadyProviders()}
              snapshots={bundle.socialSnapshots as SocialSnapshotRow[]}
            />
            <ScoreTransparencyCard
              accounts={bundle.connectedAccounts as ConnectedAccountRow[]}
              profile={bundle.profile}
              snapshots={bundle.socialSnapshots as SocialSnapshotRow[]}
            />
          </>
        ) : null}
        <PayoutReadinessCard role={role as "creator" | "brand" | "freelancer"} />
        <ProfileEditForm
          audit={bundle.audit}
          platforms={bundle.platforms}
          portfolio={bundle.portfolio}
          profile={bundle.profile}
          role={role as "creator" | "brand" | "freelancer"}
          serviceRates={bundle.serviceRates}
        />
      </Card>
    </AppShell>
  );
}

async function getProfileBundle(role: string, userId: string, email: string) {
  const admin = createAdminClient();
  if (!admin) return emptyBundle();

  if (role === "creator") {
    const { data: creator } = await admin.from("creators").select("*").eq("profile_id", userId).maybeSingle();
    if (!creator) return emptyBundle();
    const [{ data: platforms }, { data: audits }] = await Promise.all([
      admin.from("creator_platforms").select("*").eq("creator_id", creator.id).order("created_at", { ascending: true }),
      admin.from("creator_audits").select("*").eq("creator_id", creator.id).order("created_at", { ascending: false }).limit(1)
    ]);
    const { data: connectedAccounts } = await admin.from("connected_social_accounts").select("*").eq("creator_id", creator.id).order("created_at", { ascending: true });
    const accountIds = (connectedAccounts ?? []).map((account) => String(account.id));
    const { data: socialSnapshots } = accountIds.length
      ? await admin.from("social_metric_snapshots").select("*").in("connected_account_id", accountIds).order("synced_at", { ascending: false })
      : { data: [] };
    return { profile: creator, platforms: platforms ?? [], audit: audits?.[0] ?? null, serviceRates: [], portfolio: [], connectedAccounts: connectedAccounts ?? [], socialSnapshots: latestSnapshotsByProvider(socialSnapshots ?? []) };
  }

  if (role === "freelancer") {
    const { data: freelancer } = await admin.from("freelancers").select("*").eq("profile_id", userId).maybeSingle();
    if (!freelancer) return emptyBundle();
    const [{ data: serviceRates }, { data: portfolio }] = await Promise.all([
      admin.from("freelancer_service_rates").select("*").eq("freelancer_id", freelancer.id).order("created_at", { ascending: true }),
      admin.from("portfolio_items").select("*").eq("freelancer_id", freelancer.id).order("created_at", { ascending: true })
    ]);
    return { profile: freelancer, platforms: [], audit: null, serviceRates: serviceRates ?? [], portfolio: portfolio ?? [], connectedAccounts: [], socialSnapshots: [] };
  }

  if (role === "brand") {
    const { data: brand } = await admin.from("brands").select("*").eq("contact_email", email).maybeSingle();
    if (!brand) return emptyBundle();
    const { data: audits } = await admin.from("brand_audits").select("*").eq("brand_id", brand.id).order("created_at", { ascending: false }).limit(1);
    return { profile: brand, platforms: [], audit: audits?.[0] ?? null, serviceRates: [], portfolio: [], connectedAccounts: [], socialSnapshots: [] };
  }

  return emptyBundle();
}

function emptyBundle() {
  return { profile: null, platforms: [], audit: null, serviceRates: [], portfolio: [], connectedAccounts: [], socialSnapshots: [] };
}

function latestSnapshotsByProvider(rows: Array<Record<string, unknown>>) {
  const seen = new Set<string>();
  return rows.filter((row) => {
    const provider = String(row.provider ?? "");
    if (seen.has(provider)) return false;
    seen.add(provider);
    return true;
  });
}

function roleLabel(role: string) {
  if (role === "brand") return "Brand";
  if (role === "freelancer") return "Freelancer";
  return "Creator";
}

function oauthReadyProviders() {
  return {
    instagram: Boolean(process.env.META_APP_ID && process.env.META_APP_SECRET),
    facebook: Boolean(process.env.META_APP_ID && process.env.META_APP_SECRET),
    youtube: Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET)
  };
}
