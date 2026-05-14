import { NextResponse } from "next/server";
import { z } from "zod";
import { CLAUDE_MODELS, extractText, getAnthropic } from "@/lib/anthropic/client";
import { getCurrentUser } from "@/lib/auth/session";
import { buildNegotiateContext } from "@/lib/benchmarks/negotiate-context";
import { negotiateAskPrompt, negotiatePrompt } from "@/prompts/negotiate";
import { gateRateLimit } from "@/lib/security/rate-limit-gate";
import { createAdminClient } from "@/lib/supabase/admin";

const counterSchema = z.object({
  mode: z.literal("counter").optional().default("counter"),
  talent_type: z.enum(["creator", "freelancer"]).optional().default("creator"),
  offer_amount_cents: z.coerce.number().int().min(0).optional().default(0),
  deliverables: z.string().trim().max(4000).optional().default(""),
  contract_terms: z.string().trim().max(4000).optional().default(""),
  brand: z.string().trim().max(200).optional().default(""),
  valuation_context: z.string().trim().max(4000).optional().default(""),
  follower_count: z.coerce.number().int().min(0).optional(),
  niche_hint: z.string().trim().max(80).optional(),
  platform_hint: z.string().trim().max(80).optional()
});

const askSchema = z.object({
  mode: z.literal("ask"),
  talent_type: z.enum(["creator", "freelancer"]).optional().default("creator"),
  question: z.string().trim().min(5).max(2000),
  offer_amount_cents: z.coerce.number().int().min(0).optional().default(0),
  deliverables: z.string().trim().max(4000).optional().default(""),
  contract_terms: z.string().trim().max(4000).optional().default(""),
  brand: z.string().trim().max(200).optional().default(""),
  follower_count: z.coerce.number().int().min(0).optional(),
  niche_hint: z.string().trim().max(80).optional(),
  platform_hint: z.string().trim().max(80).optional()
});

export async function POST(request: Request) {
  const gate = await gateRateLimit(request, "ai:negotiate");
  if (gate) return gate;

  const user = await getCurrentUser();
  if (!user || user.role === "brand") {
    return NextResponse.json({ error: "Negotiation copilot is available only to creators, freelancers, and admins." }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const mode = body?.mode === "ask" ? "ask" : "counter";

  const admin = createAdminClient();
  // Negotiation is quality-critical — use SMART (Sonnet 4.6).
  // The reasoning behind counter strategies and "what to push back on"
  // genuinely benefits from a stronger model than valuation does.
  const anthropic = getAnthropic();

  if (mode === "ask") {
    const parsed = askSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid request." }, { status: 400 });
    }
    const input = parsed.data;
    const benchmarkContext = admin
      ? await buildNegotiateContext(admin, {
          offer_amount_cents: input.offer_amount_cents,
          deliverables: input.deliverables,
          contract_terms: input.contract_terms,
          brand: input.brand,
          talent_type: input.talent_type,
          follower_count: input.follower_count,
          niche_hint: input.niche_hint,
          platform_hint: input.platform_hint
        })
      : null;

    const fallback = {
      answer: "I can give better guidance once Agently has more market data for this segment. Generally, splitting into more deliverables (e.g. 1 reel + 3 stories instead of 2 reels) helps when the brand wants spread, but reduces per-asset visibility. Bundle pricing (5-15% discount) is reasonable when total scope grows.",
      suggested_alternatives: ["2 reels at offered rate", "1 reel + 5 stories bundled at -10% per asset", "3 reels with usage capped to 30 days organic only"],
      market_context: benchmarkContext?.summary ?? "No market data available yet.",
      confidence: 0.3,
      followup_questions: ["What is the planned ad spend behind these posts?", "Is usage capped to 30 days or perpetual?", "Will the brand fund the deliverable before delivery?"]
    };

    if (!anthropic) {
      return NextResponse.json({ ...fallback, source: "rules_fallback", benchmark_context: benchmarkContext });
    }

    const response = await anthropic.messages.create({
      model: CLAUDE_MODELS.SMART,
      max_tokens: 2048,
      system: [{ type: "text", text: negotiateAskPrompt, cache_control: { type: "ephemeral" } }],
      messages: [
        {
          role: "user",
          content: JSON.stringify({
            question: input.question,
            talent_type: input.talent_type,
            offer_context: {
              amount_cents: input.offer_amount_cents,
              deliverables: input.deliverables,
              contract_terms: input.contract_terms,
              brand: input.brand
            },
            benchmark_context: benchmarkContext
          })
        }
      ]
    });
    const raw = extractText(response) ?? JSON.stringify(fallback);
    let parsedResp: Record<string, unknown> = fallback;
    try { parsedResp = JSON.parse(raw); } catch { /* keep fallback */ }
    return NextResponse.json({ ...parsedResp, source: "claude_plus_benchmarks", benchmark_context: benchmarkContext });
  }

  // counter mode
  const parsed = counterSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid request." }, { status: 400 });
  }
  const input = parsed.data;
  const offer = Number(input.offer_amount_cents ?? 0);

  const benchmarkContext = admin
    ? await buildNegotiateContext(admin, {
        offer_amount_cents: offer,
        deliverables: input.deliverables,
        contract_terms: input.contract_terms,
        brand: input.brand,
        valuation_context: input.valuation_context,
        talent_type: input.talent_type,
        follower_count: input.follower_count,
        niche_hint: input.niche_hint,
        platform_hint: input.platform_hint
      })
    : null;

  // Rules fallback: use benchmark median as the counter anchor if available, else 1.2x offer
  const benchmarkMedian = benchmarkContext?.rate_matches[0]?.median_inr;
  const benchmarkP75 = benchmarkContext?.rate_matches[0]?.p75_inr;
  const benchmarkP25 = benchmarkContext?.rate_matches[0]?.p25_inr;
  const counterCents = benchmarkMedian
    ? Math.max(offer, benchmarkMedian * 100)
    : Math.round(offer * 1.2);
  const floorCents = benchmarkP25
    ? Math.round(benchmarkP25 * 100)
    : Math.round(offer * 0.9);
  const fallback = {
    recommended_counter_cents: counterCents,
    minimum_floor_cents: floorCents,
    terms_to_push_back_on: ["perpetual usage", "payment after approval", "uncapped revisions"],
    acceptance_likelihood: 0.64,
    counter_rationale: benchmarkContext?.rate_matches.length
      ? `Counter anchored on Agently observations median (INR ${benchmarkMedian}) and p75 (INR ${benchmarkP75}) for the matched segment.`
      : `The counter is better for the ${input.talent_type} because it prices the work, usage rights, revision time, and payment risk instead of only the base deliverable.`,
    tradeoff_notes: "A higher counter can reduce acceptance likelihood if the brand budget is fixed. Accepting the original offer may still make sense for a strategic brand, guaranteed future work, or very limited usage rights.",
    message: `Thanks for the offer. Based on the ${input.talent_type === "freelancer" ? "scope, production time, and revision expectations" : "deliverables and usage rights"}, we can move forward at INR ${Math.round(counterCents / 100).toLocaleString("en-IN")} with usage capped to 30 days, one revision round, and payment funded before publication.`,
    benchmark_basis: benchmarkContext?.summary ?? "No matching benchmark data; counter based on rules fallback."
  };

  if (!anthropic) {
    return NextResponse.json({ ...fallback, source: "rules_fallback", benchmark_context: benchmarkContext });
  }

  const response = await anthropic.messages.create({
    model: CLAUDE_MODELS.SMART,
    max_tokens: 2048,
    system: [{ type: "text", text: negotiatePrompt, cache_control: { type: "ephemeral" } }],
    messages: [
      { role: "user", content: JSON.stringify({ ...input, benchmark_context: benchmarkContext }) }
    ]
  });
  const raw = extractText(response) ?? JSON.stringify(fallback);
  let parsedResp: Record<string, unknown> = fallback;
  try { parsedResp = JSON.parse(raw); } catch { /* keep fallback */ }
  return NextResponse.json({ ...parsedResp, source: "claude_plus_benchmarks", benchmark_context: benchmarkContext });
}
