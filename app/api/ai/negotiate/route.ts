import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { getOpenAI } from "@/lib/openai/client";
import { negotiatePrompt } from "@/prompts/negotiate";

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user || user.role === "brand") {
    return NextResponse.json({ error: "Negotiation copilot is available only to creators, freelancers, and admins." }, { status: 403 });
  }

  const input = await request.json();
  const offer = Number(input.offer_amount_cents ?? 0);
  const talentType = input.talent_type === "freelancer" ? "freelancer" : "creator";
  const fallback = {
    recommended_counter_cents: Math.round(offer * 1.2),
    minimum_floor_cents: Math.round(offer * 0.9),
    terms_to_push_back_on: ["perpetual usage", "payment after approval", "uncapped revisions"],
    acceptance_likelihood: 0.64,
    message: `Thanks for the offer. Based on the ${talentType === "freelancer" ? "scope, production time, and revision expectations" : "deliverables and usage rights"}, we can move forward at the counter rate with usage capped to 30 days, one revision round, and payment funded before publication.`
  };
  const openai = getOpenAI();
  if (!openai) return NextResponse.json({ ...fallback, source: "rules_fallback" });

  const completion = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    response_format: { type: "json_object" },
    messages: [{ role: "system", content: negotiatePrompt }, { role: "user", content: JSON.stringify(input) }]
  });
  return NextResponse.json(JSON.parse(completion.choices[0]?.message.content ?? JSON.stringify(fallback)));
}
