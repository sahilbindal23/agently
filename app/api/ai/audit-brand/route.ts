import { NextResponse } from "next/server";
import { auditBrand, type BrandAuditInput } from "@/lib/ai/audits";
import { getCurrentUser } from "@/lib/auth/session";
import { getOpenAI } from "@/lib/openai/client";
import { brandAuditPrompt } from "@/prompts/audits";

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Login required." }, { status: 401 });

  const input = (await request.json()) as BrandAuditInput;
  const fallback = auditBrand(input);
  const openai = getOpenAI();

  if (!openai) return NextResponse.json({ ...fallback, source: "rules_fallback" });

  const completion = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: brandAuditPrompt },
      { role: "user", content: JSON.stringify({ input, rules_audit: fallback }) }
    ]
  });

  return NextResponse.json({
    ...JSON.parse(completion.choices[0]?.message.content ?? JSON.stringify(fallback)),
    source: "openai"
  });
}
