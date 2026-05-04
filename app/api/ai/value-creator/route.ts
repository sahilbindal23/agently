import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { getOpenAI } from "@/lib/openai/client";
import { rulesBasedValuation, type ValuationInput } from "@/lib/ai/valuation";
import { valuationPrompt } from "@/prompts/valuation";

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Login required." }, { status: 401 });

  const input = (await request.json()) as ValuationInput;
  const fallback = rulesBasedValuation(input);
  const openai = getOpenAI();

  if (!openai) return NextResponse.json({ ...fallback, source: "rules_fallback" });

  const completion = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: valuationPrompt },
      { role: "user", content: JSON.stringify({ input, rules_estimate: fallback }) }
    ]
  });

  return NextResponse.json({
    ...JSON.parse(completion.choices[0]?.message.content ?? JSON.stringify(fallback)),
    source: "openai"
  });
}
