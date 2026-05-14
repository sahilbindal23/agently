import { NextResponse } from "next/server";
import { auditBrand, type BrandAuditInput } from "@/lib/ai/audits";
import { CLAUDE_MODELS, extractText, getAnthropic } from "@/lib/anthropic/client";
import { getCurrentUser } from "@/lib/auth/session";
import { brandAuditPrompt } from "@/prompts/audits";
import { gateRateLimit } from "@/lib/security/rate-limit-gate";

export async function POST(request: Request) {
  const gate = await gateRateLimit(request, "ai:audit-brand");
  if (gate) return gate;

  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Login required." }, { status: 401 });

  const input = (await request.json()) as BrandAuditInput;
  const fallback = auditBrand(input);
  const anthropic = getAnthropic();

  if (!anthropic) return NextResponse.json({ ...fallback, source: "rules_fallback" });

  // Brand audit fires once at intake. FAST is fine.
  const response = await anthropic.messages.create({
    model: CLAUDE_MODELS.FAST,
    max_tokens: 2048,
    system: [{ type: "text", text: brandAuditPrompt, cache_control: { type: "ephemeral" } }],
    messages: [{ role: "user", content: JSON.stringify({ input, rules_audit: fallback }) }]
  });
  const raw = extractText(response) ?? JSON.stringify(fallback);
  let parsed: unknown = fallback;
  try { parsed = JSON.parse(raw); } catch { /* keep fallback */ }
  return NextResponse.json({ ...(parsed as Record<string, unknown>), source: "claude" });
}
