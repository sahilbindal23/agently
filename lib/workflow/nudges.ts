import type { CurrentUser } from "@/lib/auth/session";
import type { createAdminClient } from "@/lib/supabase/admin";

export type WorkflowNudge = {
  id: string;
  title: string;
  description: string;
  href: string;
  cta: string;
  severity: "high" | "medium" | "low" | "info";
  group: string;
};

type AdminClient = NonNullable<ReturnType<typeof createAdminClient>>;
type Row = Record<string, unknown>;

const dayMs = 24 * 60 * 60 * 1000;

export async function getWorkflowNudges(admin: AdminClient, user: NonNullable<CurrentUser>) {
  if (user.role === "brand") return getBrandNudges(admin, user);
  if (user.role === "creator") return getCreatorNudges(admin, user);
  if (user.role === "freelancer") return getFreelancerNudges(admin, user);
  return getAdminNudges(admin);
}

async function getBrandNudges(admin: AdminClient, user: NonNullable<CurrentUser>) {
  const nudges: WorkflowNudge[] = [];
  const { data: brands } = await admin.from("brands").select("*").eq("contact_email", user.email);
  const { data: campaigns } = await admin.from("campaigns").select("*").eq("profile_id", user.id).order("created_at", { ascending: false });
  const brandIds = unique([
    ...(brands ?? []).map((brand) => String(brand.id)),
    ...(campaigns ?? []).map((campaign) => String(campaign.brand_id ?? "")).filter(Boolean)
  ]);
  const [deals, projects, shortlists] = await Promise.all([
    brandIds.length ? selectIn(admin, "deals", "*", "brand_id", brandIds) : [],
    brandIds.length ? selectIn(admin, "freelancer_projects", "*", "brand_id", brandIds) : [],
    campaigns?.length ? selectIn(admin, "campaign_shortlists", "*", "campaign_id", campaigns.map((campaign) => String(campaign.id))) : []
  ]);
  const deliverables = await getDeliverables(admin, deals, projects);

  for (const campaign of campaigns ?? []) {
    const campaignDeals = deals.filter((deal) => deal.campaign_id === campaign.id);
    const campaignProjects = projects.filter((project) => project.campaign_id === campaign.id);
    const campaignShortlists = shortlists.filter((shortlist) => shortlist.campaign_id === campaign.id);
    if (campaignShortlists.length && campaignDeals.length + campaignProjects.length === 0) {
      nudges.push(nudge(`brand-shortlist-${campaign.id}`, "Campaign has shortlist but no offers", `${text(campaign.title, "This campaign")} has shortlisted talent. Send offers while the brief is still warm.`, `/campaigns/${campaign.id}`, "Send offers", "medium", "Campaign momentum"));
    }
    if (campaignDeals.length + campaignProjects.length > 0 && !hasAcceptedTalent(campaignDeals, campaignProjects)) {
      nudges.push(nudge(`brand-no-accepted-${campaign.id}`, "No accepted talent yet", `${text(campaign.title, "This campaign")} has offers sent but nobody accepted yet. Recheck amount, scope, and fit.`, `/campaigns/${campaign.id}`, "Review campaign", "medium", "Campaign momentum"));
    }
  }

  for (const item of [...deals, ...projects].filter((row) => isPending(row) && ageDays(row.created_at) >= 2).slice(0, 4)) {
    nudges.push(nudge(`brand-pending-${item.id}`, "Offer pending for 2+ days", `${text(item.title, "An offer")} has not been accepted or declined. Message the talent or adjust terms.`, "/deals", "Open offers", "medium", "Offer follow-up"));
  }

  for (const item of deliverables.filter((row) => row.status === "submitted").slice(0, 4)) {
    nudges.push(nudge(`brand-review-${item.id}`, "Deliverable waiting for review", `${text(item.title, "A deliverable")} is submitted. Review it to keep payout release moving.`, "/payments", "Review delivery", "high", "Delivery workflow"));
  }

  for (const item of [...deals, ...projects].filter((row) => isAccepted(row) && ["unpaid", "pending"].includes(String(row.payment_status ?? ""))).slice(0, 4)) {
    nudges.push(nudge(`brand-fund-${item.id}`, "Accepted work is not funded", `${text(item.title, "Accepted work")} needs funding before delivery should start.`, "/payments", "Open payments", "high", "Payment workflow"));
  }

  return sortNudges(nudges);
}

async function getCreatorNudges(admin: AdminClient, user: NonNullable<CurrentUser>) {
  const { data: creator } = await admin.from("creators").select("*").eq("profile_id", user.id).maybeSingle();
  if (!creator) return [nudge("creator-intake", "Complete creator intake", "Finish intake so Agently can make your profile discoverable and start matching you with brands.", "/intake", "Start intake", "high", "Profile readiness")];

  const deals = await selectEq(admin, "deals", "*", "creator_id", String(creator.id));
  const deliverables = await getDeliverables(admin, deals, []);
  const nudges = talentNudges({ items: deals, deliverables, offerHref: "/offers", paymentHref: "/payments", noun: "creator offer" });

  return sortNudges(nudges);
}

async function getFreelancerNudges(admin: AdminClient, user: NonNullable<CurrentUser>) {
  const { data: freelancer } = await admin.from("freelancers").select("*").eq("profile_id", user.id).maybeSingle();
  if (!freelancer) return [nudge("freelancer-intake", "Complete freelancer intake", "Finish intake so brands can discover your services, rates, and portfolio.", "/intake", "Start intake", "high", "Profile readiness")];

  const projects = await selectEq(admin, "freelancer_projects", "*", "freelancer_id", String(freelancer.id));
  const deliverables = await getDeliverables(admin, [], projects);
  const nudges = talentNudges({ items: projects, deliverables, offerHref: "/offers", paymentHref: "/payments", noun: "freelancer project" });

  return sortNudges(nudges);
}

async function getAdminNudges(admin: AdminClient) {
  const nudges: WorkflowNudge[] = [];
  const [deals, projects, campaigns, shortlists, deliverables, contracts] = await Promise.all([
    selectAll(admin, "deals", "*"),
    selectAll(admin, "freelancer_projects", "*"),
    selectAll(admin, "campaigns", "*"),
    selectAll(admin, "campaign_shortlists", "*"),
    selectAll(admin, "deliverables", "*"),
    selectAll(admin, "contracts", "*")
  ]);

  for (const contract of contracts.filter((row) => ["high_risk", "caution"].includes(String(row.risk_level ?? ""))).slice(0, 5)) {
    nudges.push(nudge(`admin-contract-${contract.id}`, "Contract scan needs review", text(contract.summary, "A contract scan has risk flags."), "/contracts", "Review contract", String(contract.risk_level) === "high_risk" ? "high" : "medium", "Risk routing"));
  }
  for (const deliverable of deliverables.filter((row) => row.status === "submitted").slice(0, 5)) {
    nudges.push(nudge(`admin-deliverable-${deliverable.id}`, "Deliverable awaiting review", `${text(deliverable.title, "A deliverable")} is waiting for approval or revision.`, "/payments", "Review delivery", "high", "Delivery workflow"));
  }
  for (const campaign of campaigns) {
    const campaignDeals = deals.filter((deal) => deal.campaign_id === campaign.id);
    const campaignProjects = projects.filter((project) => project.campaign_id === campaign.id);
    const campaignShortlists = shortlists.filter((shortlist) => shortlist.campaign_id === campaign.id);
    if (campaignShortlists.length && campaignDeals.length + campaignProjects.length === 0) {
      nudges.push(nudge(`admin-shortlist-${campaign.id}`, "Shortlist has no offers", `${text(campaign.title, "A campaign")} has shortlisted talent but no offers sent.`, `/campaigns/${campaign.id}`, "Open campaign", "medium", "Campaign momentum"));
    }
  }
  for (const item of [...deals, ...projects].filter((row) => isPending(row) && ageDays(row.created_at) >= 3).slice(0, 5)) {
    nudges.push(nudge(`admin-pending-${item.id}`, "Offer pending for 3+ days", `${text(item.title, "An offer")} has been pending too long.`, "/activity", "Open activity", "medium", "Offer follow-up"));
  }

  return sortNudges(nudges);
}

function talentNudges({ items, deliverables, offerHref, paymentHref, noun }: { items: Row[]; deliverables: Row[]; offerHref: string; paymentHref: string; noun: string }) {
  const nudges: WorkflowNudge[] = [];
  for (const item of items.filter((row) => isPending(row))) {
    nudges.push(nudge(`talent-offer-${item.id}`, `Respond to new ${noun}`, `${text(item.title, "An offer")} needs your accept, decline, or negotiation response.`, offerHref, "Review offer", "high", "Offers needing response"));
  }
  for (const item of items.filter((row) => isAccepted(row) && ["unpaid", "pending"].includes(String(row.payment_status ?? ""))).slice(0, 3)) {
    nudges.push(nudge(`talent-unfunded-${item.id}`, "Accepted work is not funded yet", `${text(item.title, "Accepted work")} is accepted but not funded. Wait for funding before delivery.`, paymentHref, "View payment", "medium", "Payment workflow"));
  }
  for (const item of items.filter((row) => isAccepted(row) && ["funded", "release_ready"].includes(String(row.payment_status ?? "")) && !hasDeliverable(row, deliverables)).slice(0, 4)) {
    const severity = dueSoon(item.due_date) ? "high" : "medium";
    nudges.push(nudge(`talent-deliver-${item.id}`, dueSoon(item.due_date) ? "Deliverable due soon" : "Funded work needs submission", `${text(item.title, "Funded work")} is ready for deliverable submission.`, offerHref, "Submit work", severity, "Delivery workflow"));
  }
  for (const item of deliverables.filter((row) => row.status === "revision_requested").slice(0, 4)) {
    nudges.push(nudge(`talent-revision-${item.id}`, "Revision requested", `${text(item.title, "A deliverable")} has requested changes. Upload the updated link when ready.`, offerHref, "Open revision", "high", "Delivery workflow"));
  }
  return nudges;
}

async function getDeliverables(admin: AdminClient, deals: Row[], projects: Row[]) {
  const dealIds = deals.map((row) => String(row.id)).filter(Boolean);
  const projectIds = projects.map((row) => String(row.id)).filter(Boolean);
  const [dealDeliverables, projectDeliverables] = await Promise.all([
    dealIds.length ? selectIn(admin, "deliverables", "*", "deal_id", dealIds) : [],
    projectIds.length ? selectIn(admin, "deliverables", "*", "freelancer_project_id", projectIds) : []
  ]);
  return [...dealDeliverables, ...projectDeliverables];
}

async function selectAll(admin: AdminClient, table: string, columns: string) {
  const { data } = await admin.from(table).select(columns).order("created_at", { ascending: false });
  return rows(data);
}

async function selectEq(admin: AdminClient, table: string, columns: string, column: string, value: string) {
  const { data } = await admin.from(table).select(columns).eq(column, value).order("created_at", { ascending: false });
  return rows(data);
}

async function selectIn(admin: AdminClient, table: string, columns: string, column: string, values: string[]) {
  const { data } = await admin.from(table).select(columns).in(column, values).order("created_at", { ascending: false });
  return rows(data);
}

function rows(data: unknown): Row[] {
  return Array.isArray(data) ? data.filter((item): item is Row => Boolean(item) && typeof item === "object" && !Array.isArray(item)) : [];
}

function nudge(id: string, title: string, description: string, href: string, cta: string, severity: WorkflowNudge["severity"], group: string): WorkflowNudge {
  return { id, title, description, href, cta, severity, group };
}

function sortNudges(nudges: WorkflowNudge[]) {
  const rank: Record<WorkflowNudge["severity"], number> = { high: 0, medium: 1, low: 2, info: 3 };
  return nudges.sort((a, b) => rank[a.severity] - rank[b.severity] || a.group.localeCompare(b.group));
}

function isPending(row: Row) {
  const status = String(row.offer_status ?? row.status ?? "");
  return !["accepted", "declined", "closed", "released"].includes(status);
}

function isAccepted(row: Row) {
  return String(row.offer_status ?? row.status ?? "") === "accepted" || String(row.talent_response ?? "") === "accepted";
}

function hasAcceptedTalent(deals: Row[], projects: Row[]) {
  return [...deals, ...projects].some(isAccepted);
}

function hasDeliverable(item: Row, deliverables: Row[]) {
  return deliverables.some((deliverable) => deliverable.deal_id === item.id || deliverable.freelancer_project_id === item.id);
}

function dueSoon(value: unknown) {
  if (typeof value !== "string" || !value) return false;
  const due = new Date(`${value}T23:59:59`).getTime();
  return Number.isFinite(due) && due >= Date.now() && due - Date.now() <= 3 * dayMs;
}

function ageDays(value: unknown) {
  if (typeof value !== "string" || !value) return 0;
  const created = new Date(value).getTime();
  return Number.isFinite(created) ? Math.floor((Date.now() - created) / dayMs) : 0;
}

function text(value: unknown, fallback: string) {
  return typeof value === "string" && value.trim() ? value : fallback;
}

function unique(values: string[]) {
  return Array.from(new Set(values));
}
