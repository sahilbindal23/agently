import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { getBenchmarkBlend, getBenchmarkBlendV2 } from "@/lib/benchmarks/rates";
import { getOpenAI } from "@/lib/openai/client";
import { rulesBasedValuation, type ValuationInput } from "@/lib/ai/valuation";
import { gateRateLimit } from "@/lib/security/rate-limit-gate";
import { createAdminClient } from "@/lib/supabase/admin";
import { valuationPrompt } from "@/prompts/valuation";

export async function POST(request: Request) {
  const gate = await gateRateLimit(request, "ai:value-creator");
  if (gate) return gate;

  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Login required." }, { status: 401 });

  const input = (await request.json()) as ValuationInput;
  const fallback = rulesBasedValuation(input);
  const admin = createAdminClient();
  const benchmarkBlend = (await getBenchmarkBlendV2(admin, input, fallback)) ?? (await getBenchmarkBlend(admin, input, fallback));
  const openai = getOpenAI();

  if (!openai) {
    return NextResponse.json({
      ...withBenchmarkBlend(fallback, benchmarkBlend),
      source: benchmarkBlend ? "rules_plus_benchmarks" : "rules_fallback"
    });
  }

  const completion = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: valuationPrompt },
      { role: "user", content: JSON.stringify({ input, rules_estimate: fallback, benchmark_blend: benchmarkBlend }) }
    ]
  });

  const raw = completion.choices[0]?.message.content ?? JSON.stringify(fallback);
  const parsed = safeJsonParse(raw, fallback);

  return NextResponse.json({
    ...withBenchmarkBlend(parsed, benchmarkBlend),
    source: benchmarkBlend ? "openai_plus_benchmarks" : "openai"
  });
}

function withBenchmarkBlend<T extends Record<string, unknown>>(estimate: T, benchmarkBlend: Awaited<ReturnType<typeof getBenchmarkBlend>>) {
  if (!benchmarkBlend) return estimate;
  return {
    ...estimate,
    blended_low_estimate_cents: benchmarkBlend.blended_low_estimate_cents,
    blended_base_estimate_cents: benchmarkBlend.blended_base_estimate_cents,
    blended_high_estimate_cents: benchmarkBlend.blended_high_estimate_cents,
    benchmark_confidence_score: benchmarkBlend.benchmark_confidence_score,
    benchmark_match_count: benchmarkBlend.benchmark_match_count,
    benchmark_summary: benchmarkBlend.benchmark_summary,
    matched_benchmarks: benchmarkBlend.matched_benchmarks,
    rationale: `${String(estimate.rationale ?? "")} Benchmark calibration: ${benchmarkBlend.benchmark_summary}`
  };
}

function safeJsonParse<T extends Record<string, unknown>>(value: string, fallback: T) {
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" ? parsed as Record<string, unknown> : fallback;
  } catch {
    return fallback;
  }
}
