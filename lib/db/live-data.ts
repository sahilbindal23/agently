import { createAdminClient } from "@/lib/supabase/admin";
import {
  aiValuations as demoAiValuations,
  brandMatches as demoBrandMatches,
  brands as demoBrands,
  contracts as demoContracts,
  creatorPlatforms as demoCreatorPlatforms,
  creators as demoCreators,
  deals as demoDeals,
  payments as demoPayments
} from "@/lib/db/demo-data";
import type { AiValuation, Brand, BrandMatch, Contract, ContractFlag, Creator, CreatorPlatform, Deal, Payment } from "@/types";

export type AgentlyData = {
  creators: Creator[];
  creatorPlatforms: CreatorPlatform[];
  brands: Brand[];
  brandMatches: BrandMatch[];
  deals: Deal[];
  contracts: Contract[];
  payments: Payment[];
  aiValuations: AiValuation[];
  source: "supabase" | "demo";
};

const fallbackData: AgentlyData = {
  creators: demoCreators,
  creatorPlatforms: demoCreatorPlatforms,
  brands: demoBrands,
  brandMatches: demoBrandMatches,
  deals: demoDeals,
  contracts: demoContracts,
  payments: demoPayments,
  aiValuations: demoAiValuations,
  source: "demo"
};

export async function getAgentlyData(): Promise<AgentlyData> {
  const supabase = createAdminClient();
  if (!supabase) return fallbackData;

  try {
    const [
      creatorsResult,
      platformsResult,
      brandsResult,
      matchesResult,
      dealsResult,
      paymentsResult,
      contractsResult,
      flagsResult,
      valuationsResult
    ] = await Promise.all([
      supabase.from("creators").select("*").order("created_at", { ascending: false }),
      supabase.from("creator_platforms").select("*"),
      supabase.from("brands").select("*"),
      supabase.from("brand_matches").select("*"),
      supabase.from("deals").select("*").order("created_at", { ascending: false }),
      supabase.from("payments").select("*").order("created_at", { ascending: false }),
      supabase.from("contracts").select("*").order("created_at", { ascending: false }),
      supabase.from("contract_flags").select("*"),
      supabase.from("ai_valuations").select("*").order("created_at", { ascending: false })
    ]);

    if (creatorsResult.error || platformsResult.error || brandsResult.error || dealsResult.error) {
      return fallbackData;
    }

    const creators = (creatorsResult.data ?? []).map(normalizeCreator);
    if (creators.length === 0) return fallbackData;

    const flags = (flagsResult.data ?? []).map(normalizeContractFlag);
    const contracts = (contractsResult.data ?? []).map((contract) => normalizeContract(contract, flags));

    return {
      creators,
      creatorPlatforms: (platformsResult.data ?? []).map(normalizeCreatorPlatform),
      brands: (brandsResult.data ?? []).map(normalizeBrand),
      brandMatches: (matchesResult.data ?? []).map(normalizeBrandMatch),
      deals: (dealsResult.data ?? []).map(normalizeDeal),
      payments: (paymentsResult.data ?? []).map(normalizePayment),
      contracts,
      aiValuations: (valuationsResult.data ?? []).map(normalizeAiValuation),
      source: "supabase"
    };
  } catch {
    return fallbackData;
  }
}

export async function getCreatorBundle(id: string) {
  const data = await getAgentlyData();
  const creator = data.creators.find((item) => item.id === id);
  return {
    ...data,
    creator,
    platforms: data.creatorPlatforms.filter((item) => item.creator_id === id),
    deals: data.deals.filter((item) => item.creator_id === id),
    matches: data.brandMatches.filter((item) => item.creator_id === id),
    valuations: data.aiValuations.filter((item) => item.creator_id === id)
  };
}

export async function getDealBundle(id: string) {
  const data = await getAgentlyData();
  const deal = data.deals.find((item) => item.id === id);
  return {
    ...data,
    deal,
    creator: data.creators.find((item) => item.id === deal?.creator_id),
    brand: data.brands.find((item) => item.id === deal?.brand_id),
    payment: data.payments.find((item) => item.deal_id === id),
    contract: data.contracts.find((item) => item.deal_id === id)
  };
}

function normalizeCreator(row: Record<string, unknown>): Creator {
  return {
    id: String(row.id),
    display_name: String(row.display_name ?? "Untitled creator"),
    primary_niche: String(row.primary_niche ?? "General creator"),
    bio: String(row.bio ?? ""),
    country: String(row.country ?? ""),
    us_audience_percent: Number(row.us_audience_percent ?? 0),
    india_audience_percent: Number(row.india_audience_percent ?? 0),
    home_city: String(row.home_city ?? ""),
    languages: toStringArray(row.languages),
    top_indian_cities: toStringArray(row.top_indian_cities),
    audience_age_range: String(row.audience_age_range ?? ""),
    content_style: String(row.content_style ?? ""),
    prior_sponsor_categories: toStringArray(row.prior_sponsor_categories),
    monetization_score: Number(row.monetization_score ?? 0),
    valuation_score: Number(row.valuation_score ?? 0),
    image_url: row.image_url ? String(row.image_url) : null,
    verification_status: String(row.verification_status ?? "unverified"),
    verification_tier: String(row.verification_tier ?? "unverified")
  };
}

function toStringArray(value: unknown) {
  if (Array.isArray(value)) return value.map(String);
  if (typeof value === "string" && value.trim()) return value.split(",").map((item) => item.trim()).filter(Boolean);
  return [];
}

function normalizeCreatorPlatform(row: Record<string, unknown>): CreatorPlatform {
  return {
    id: String(row.id),
    creator_id: String(row.creator_id),
    platform: String(row.platform ?? "Platform"),
    handle: String(row.handle ?? ""),
    url: String(row.url ?? ""),
    followers: Number(row.followers ?? 0),
    avg_views: Number(row.avg_views ?? 0),
    engagement_rate: Number(row.engagement_rate ?? 0),
    posting_frequency: String(row.posting_frequency ?? "")
  };
}

function normalizeBrand(row: Record<string, unknown>): Brand {
  return {
    id: String(row.id),
    name: String(row.name ?? "Brand"),
    website: String(row.website ?? ""),
    industry: String(row.industry ?? ""),
    contact_email: String(row.contact_email ?? ""),
    status: String(row.status ?? "target"),
    image_url: row.image_url ? String(row.image_url) : null,
    verification_status: String(row.verification_status ?? "unverified"),
    verification_tier: String(row.verification_tier ?? "unverified")
  };
}

function normalizeBrandMatch(row: Record<string, unknown>): BrandMatch {
  return {
    id: String(row.id),
    creator_id: String(row.creator_id),
    brand_id: String(row.brand_id),
    fit_score: Number(row.fit_score ?? 0),
    match_reason: String(row.match_reason ?? ""),
    outreach_angle: String(row.outreach_angle ?? ""),
    suggested_intro: String(row.suggested_intro ?? ""),
    status: String(row.status ?? "recommended")
  };
}

function normalizeDeal(row: Record<string, unknown>): Deal {
  return {
    id: String(row.id),
    creator_id: String(row.creator_id),
    brand_id: String(row.brand_id),
    title: String(row.title ?? "Untitled deal"),
    deliverables: String(row.deliverables ?? ""),
    amount_cents: Number(row.amount_cents ?? 0),
    currency: String(row.currency ?? "inr"),
    stage: String(row.stage ?? "lead") as Deal["stage"],
    payment_status: String(row.payment_status ?? "unpaid") as Deal["payment_status"],
    deliverable_status: String(row.deliverable_status ?? "not_started"),
    risk_score: Number(row.risk_score ?? 0),
    start_date: String(row.start_date ?? ""),
    due_date: String(row.due_date ?? ""),
    notes: String(row.notes ?? ""),
    offer_status: String(row.offer_status ?? "submitted"),
    talent_response: row.talent_response ? String(row.talent_response) : null,
    responded_at: row.responded_at ? String(row.responded_at) : null
  };
}

function normalizeContract(row: Record<string, unknown>, flags: ContractFlag[]): Contract {
  const id = String(row.id);
  return {
    id,
    deal_id: String(row.deal_id),
    file_path: row.file_path ? String(row.file_path) : null,
    raw_text: String(row.raw_text ?? ""),
    scan_status: String(row.scan_status ?? "pending"),
    risk_level: String(row.risk_level ?? "safe") as Contract["risk_level"],
    summary: String(row.summary ?? ""),
    flags: flags.filter((flag) => flag.contract_id === id)
  };
}

function normalizeContractFlag(row: Record<string, unknown>): ContractFlag {
  return {
    id: String(row.id),
    contract_id: String(row.contract_id),
    flag_type: String(row.flag_type ?? ""),
    severity: String(row.severity ?? "low") as ContractFlag["severity"],
    excerpt: String(row.excerpt ?? ""),
    recommendation: String(row.recommendation ?? "")
  };
}

function normalizePayment(row: Record<string, unknown>): Payment {
  return {
    id: String(row.id),
    deal_id: String(row.deal_id),
    stripe_payment_intent_id: row.stripe_payment_intent_id ? String(row.stripe_payment_intent_id) : null,
    stripe_checkout_session_id: row.stripe_checkout_session_id ? String(row.stripe_checkout_session_id) : null,
    stripe_payment_link_id: row.stripe_payment_link_id ? String(row.stripe_payment_link_id) : null,
    amount_cents: Number(row.amount_cents ?? 0),
    platform_fee_cents: Number(row.platform_fee_cents ?? 0),
    creator_payout_cents: Number(row.creator_payout_cents ?? 0),
    status: String(row.status ?? "unpaid") as Payment["status"],
    funded_at: row.funded_at ? String(row.funded_at) : null,
    released_at: row.released_at ? String(row.released_at) : null
  };
}

function normalizeAiValuation(row: Record<string, unknown>): AiValuation {
  return {
    id: String(row.id),
    creator_id: String(row.creator_id),
    platform: String(row.platform ?? ""),
    low_estimate_cents: Number(row.low_estimate_cents ?? 0),
    base_estimate_cents: Number(row.base_estimate_cents ?? 0),
    high_estimate_cents: Number(row.high_estimate_cents ?? 0),
    confidence_score: Number(row.confidence_score ?? 0),
    rationale: String(row.rationale ?? ""),
    package_recommendation: String(row.package_recommendation ?? "")
  };
}
