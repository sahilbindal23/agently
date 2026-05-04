import type { SupabaseClient } from "@supabase/supabase-js";
import type { CampaignRecommendation } from "@/lib/campaigns/recommendations";

type EntityType = "creator" | "freelancer";

type RecommendationLedgerInput = {
  campaignId: string;
  entityType: EntityType;
  item: CampaignRecommendation;
  originalRank: number;
  finalRank: number;
  shortlisted?: boolean;
};

type LedgerEventInput = {
  campaignId?: string | null;
  entityType: EntityType;
  entityId: string;
  eventName: string;
  offerId?: string | null;
  freelancerProjectId?: string | null;
  amountCents?: number | null;
  responseStatus?: string | null;
  counterAmountCents?: number | null;
  paymentStatus?: string | null;
  deliverableStatus?: string | null;
  outcomeLabel?: string | null;
  notes?: string | null;
};

export async function upsertRecommendationLedgerRows(admin: SupabaseClient | null, rows: RecommendationLedgerInput[]) {
  if (!admin || rows.length === 0) return;

  try {
    await admin
      .from("recommendation_outcome_ledger")
      .upsert(rows.map(toLedgerRow), { onConflict: "campaign_id,entity_type,entity_id" });
  } catch {
    // Ledger writes are training-data enrichment. They should not block discovery.
  }
}

export async function applyLedgerEvent(admin: SupabaseClient | null, input: LedgerEventInput) {
  if (!admin || !input.campaignId) return;

  const update = buildLedgerEventUpdate(input);
  try {
    await admin
      .from("recommendation_outcome_ledger")
      .update(update)
      .eq("campaign_id", input.campaignId)
      .eq("entity_type", input.entityType)
      .eq("entity_id", input.entityId);
  } catch {
    // Workflow should keep moving even if training data cannot be updated.
  }
}

function toLedgerRow({ campaignId, entityType, finalRank, item, originalRank, shortlisted = false }: RecommendationLedgerInput) {
  const marketplaceSignals = item.marketplace_signals ?? [];
  const baseScore = baseScoreFromBreakdown(item.score_breakdown);

  return {
    campaign_id: campaignId,
    entity_type: entityType,
    entity_id: item.id,
    input_snapshot: {
      name: item.name,
      subtitle: item.subtitle,
      trust_source: item.trust_source,
      proof_points: item.proof_points,
      watchouts: item.watchouts
    },
    score_breakdown: item.score_breakdown,
    roi_estimate: item.roi_estimate,
    prediction: {
      reason: item.reason,
      match_type: item.match_type,
      best_use_case: item.best_use_case,
      expected_outcome: item.expected_outcome,
      risk_level: item.risk_level
    },
    original_rank: originalRank,
    final_rank: finalRank,
    base_fit_score: baseScore,
    final_fit_score: item.score,
    marketplace_signals: marketplaceSignals,
    shortlisted,
    outcome_label: shortlisted ? "brand_interest" : null,
    updated_at: new Date().toISOString()
  };
}

function buildLedgerEventUpdate(input: LedgerEventInput) {
  const now = new Date().toISOString();
  const update: Record<string, unknown> = {
    last_event_name: input.eventName,
    last_event_at: now,
    updated_at: now
  };

  if (input.eventName === "talent_shortlisted") {
    update.shortlisted = true;
    update.outcome_label = "brand_interest";
  }
  if (input.eventName === "talent_unshortlisted") {
    update.shortlisted = false;
    update.outcome_label = "weak_interest";
  }
  if (input.offerId) update.offer_id = input.offerId;
  if (input.freelancerProjectId) update.freelancer_project_id = input.freelancerProjectId;
  if (input.eventName === "offer_sent" || input.eventName === "freelancer_project_sent") {
    update.offer_sent = true;
    update.outcome_label = "offer_sent";
  }
  if (input.amountCents !== undefined) update.offer_amount_cents = input.amountCents;
  if (input.responseStatus) update.response_status = input.responseStatus;
  if (input.counterAmountCents !== undefined) update.counter_amount_cents = input.counterAmountCents;
  if (input.paymentStatus) update.payment_status = input.paymentStatus;
  if (input.deliverableStatus) update.deliverable_status = input.deliverableStatus;
  if (input.outcomeLabel) update.outcome_label = input.outcomeLabel;
  if (input.notes) update.outcome_notes = input.notes;

  if (input.responseStatus === "accepted") update.final_agreed_amount_cents = input.counterAmountCents ?? input.amountCents ?? null;
  if (input.responseStatus === "declined") update.outcome_label = input.outcomeLabel ?? "declined";
  if (input.responseStatus === "changes_requested") update.outcome_label = input.outcomeLabel ?? "countered";
  if (input.paymentStatus === "funded") update.outcome_label = "funded";
  if (input.paymentStatus === "released") update.outcome_label = "paid_successfully";
  if (input.deliverableStatus === "approved") update.outcome_label = "delivery_approved";
  if (input.deliverableStatus === "revision_requested") update.outcome_label = "delivery_issue";

  return update;
}

function baseScoreFromBreakdown(score: CampaignRecommendation["score_breakdown"]) {
  return Math.max(35, Math.min(96, Math.round(
    score.category_fit * 0.22 +
    score.audience_fit * 0.18 +
    score.platform_fit * 0.12 +
    score.city_fit * 0.16 +
    score.language_fit * 0.1 +
    score.budget_fit * 0.14 +
    score.data_confidence * 0.08
  )));
}
