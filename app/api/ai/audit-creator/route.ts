import { NextResponse } from "next/server";
import { auditCreator, type CreatorAuditInput } from "@/lib/ai/audits";
import { getCurrentUser } from "@/lib/auth/session";
import { getOpenAI } from "@/lib/openai/client";
import { creatorAuditPrompt } from "@/prompts/audits";
import { gateRateLimit } from "@/lib/security/rate-limit-gate";

export async function POST(request: Request) {
  const gate = await gateRateLimit(request, "ai:audit-creator");
  if (gate) return gate;

  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Login required." }, { status: 401 });

  const input = (await request.json()) as CreatorAuditInput;
  const fallback = auditCreator(input);
  const openai = getOpenAI();

  if (!openai) return NextResponse.json({ ...fallback, source: "rules_fallback" });

  const completion = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: creatorAuditPrompt },
      { role: "user", content: JSON.stringify({ input, rules_audit: fallback }) }
    ]
  });

  return NextResponse.json({
    ...JSON.parse(completion.choices[0]?.message.content ?? JSON.stringify(fallback)),
    source: "openai"
  });
}
