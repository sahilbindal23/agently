// Server-side helpers for managing deal_agreements lifecycle.
// Used by the offer-respond hook (auto-generate on accept) and the
// /api/contracts/sign endpoint.

import type { SupabaseClient } from "@supabase/supabase-js";
import { renderAgreement, type AgreementTerms } from "@/lib/contracts/template";

type Row = Record<string, unknown>;

export async function ensureAgreementForDeal(admin: SupabaseClient, dealId: string) {
  // Idempotent: returns existing active agreement if any, otherwise generates
  const { data: existing } = await admin
    .from("deal_agreements")
    .select("*")
    .eq("deal_id", dealId)
    .neq("status", "voided")
    .maybeSingle();
  if (existing) return existing;

  const { data: deal } = await admin.from("deals").select("*").eq("id", dealId).maybeSingle();
  if (!deal) throw new Error(`Deal ${dealId} not found`);

  const [{ data: brand }, { data: creator }] = await Promise.all([
    admin.from("brands").select("name, contact_email, website").eq("id", deal.brand_id).maybeSingle(),
    admin.from("creators").select("display_name, profile_id").eq("id", deal.creator_id).maybeSingle()
  ]);
  if (!brand || !creator) throw new Error(`Missing brand or creator for deal ${dealId}`);

  // If there's an accepted counter, the agreed terms are the counter values, not the original
  const useCounter = String(deal.counter_status ?? "") === "accepted";
  const terms: AgreementTerms = {
    title: String(deal.title ?? "Creator engagement"),
    deliverables: useCounter && deal.counter_deliverables
      ? String(deal.counter_deliverables)
      : String(deal.deliverables ?? ""),
    amount_inr: Math.round(Number(useCounter && deal.counter_amount_cents ? deal.counter_amount_cents : deal.amount_cents ?? 0) / 100),
    currency: String(deal.currency ?? "inr"),
    due_date: useCounter && deal.counter_due_date ? String(deal.counter_due_date) : (deal.due_date ? String(deal.due_date) : null),
    usage_rights: useCounter && deal.counter_usage_rights ? String(deal.counter_usage_rights) : null,
    approval_terms: useCounter && deal.counter_approval_terms ? String(deal.counter_approval_terms) : null,
    source_kind: "deal",
    source_id: dealId,
    campaign_id: deal.campaign_id ? String(deal.campaign_id) : null,
    generated_at: new Date().toISOString()
  };
  const rendered = renderAgreement({
    brand_name: String(brand.name ?? "Brand"),
    brand_contact_email: brand.contact_email ? String(brand.contact_email) : null,
    brand_website: brand.website ? String(brand.website) : null,
    talent_name: String(creator.display_name ?? "Creator"),
    talent_role: "creator"
  }, terms);

  const { data: inserted, error } = await admin.from("deal_agreements").insert({
    deal_id: dealId,
    template_version: rendered.version,
    rendered_terms: rendered.terms,
    rendered_html: rendered.html,
    status: "pending_signatures"
  }).select("*").single();
  if (error) throw new Error(`Failed to insert agreement: ${error.message}`);

  await admin.from("deals").update({ agreement_status: "pending_signatures" }).eq("id", dealId);
  return inserted as Row;
}

export async function ensureAgreementForFreelancerProject(admin: SupabaseClient, projectId: string) {
  const { data: existing } = await admin
    .from("deal_agreements")
    .select("*")
    .eq("freelancer_project_id", projectId)
    .neq("status", "voided")
    .maybeSingle();
  if (existing) return existing;

  const { data: project } = await admin.from("freelancer_projects").select("*").eq("id", projectId).maybeSingle();
  if (!project) throw new Error(`Project ${projectId} not found`);

  const [{ data: brand }, { data: freelancer }] = await Promise.all([
    admin.from("brands").select("name, contact_email, website").eq("id", project.brand_id).maybeSingle(),
    admin.from("freelancers").select("display_name, profile_id").eq("id", project.freelancer_id).maybeSingle()
  ]);
  if (!brand || !freelancer) throw new Error(`Missing brand or freelancer for project ${projectId}`);

  const useCounter = String(project.counter_status ?? "") === "accepted";
  const terms: AgreementTerms = {
    title: String(project.title ?? "Freelancer engagement"),
    deliverables: useCounter && project.counter_scope
      ? String(project.counter_scope)
      : String(project.scope ?? ""),
    amount_inr: Math.round(Number(useCounter && project.counter_amount_cents ? project.counter_amount_cents : project.amount_cents ?? 0) / 100),
    currency: String(project.currency ?? "inr"),
    due_date: useCounter && project.counter_due_date ? String(project.counter_due_date) : (project.due_date ? String(project.due_date) : null),
    usage_rights: useCounter && project.counter_usage_rights ? String(project.counter_usage_rights) : (project.usage_context ? String(project.usage_context) : null),
    approval_terms: useCounter && project.counter_approval_terms ? String(project.counter_approval_terms) : (project.approval_terms ? String(project.approval_terms) : null),
    source_kind: "freelancer_project",
    source_id: projectId,
    campaign_id: project.campaign_id ? String(project.campaign_id) : null,
    generated_at: new Date().toISOString()
  };
  const rendered = renderAgreement({
    brand_name: String(brand.name ?? "Brand"),
    brand_contact_email: brand.contact_email ? String(brand.contact_email) : null,
    brand_website: brand.website ? String(brand.website) : null,
    talent_name: String(freelancer.display_name ?? "Freelancer"),
    talent_role: "freelancer"
  }, terms);

  const { data: inserted, error } = await admin.from("deal_agreements").insert({
    freelancer_project_id: projectId,
    template_version: rendered.version,
    rendered_terms: rendered.terms,
    rendered_html: rendered.html,
    status: "pending_signatures"
  }).select("*").single();
  if (error) throw new Error(`Failed to insert agreement: ${error.message}`);

  await admin.from("freelancer_projects").update({ agreement_status: "pending_signatures" }).eq("id", projectId);
  return inserted as Row;
}

export async function getAgreementForDeal(admin: SupabaseClient, dealId: string) {
  const { data } = await admin
    .from("deal_agreements")
    .select("*")
    .eq("deal_id", dealId)
    .neq("status", "voided")
    .maybeSingle();
  return data as Row | null;
}

export async function getAgreementForFreelancerProject(admin: SupabaseClient, projectId: string) {
  const { data } = await admin
    .from("deal_agreements")
    .select("*")
    .eq("freelancer_project_id", projectId)
    .neq("status", "voided")
    .maybeSingle();
  return data as Row | null;
}

export function isAgreementFullySigned(agreement: Row | null | undefined): boolean {
  return !!agreement && String(agreement.status) === "fully_signed";
}
