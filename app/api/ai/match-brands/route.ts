import { NextResponse } from "next/server";
import { matchBrandsForCreator, matchCreatorsForBrand, type BrandMatchInput, type CreatorBrandMatchInput } from "@/lib/ai/brand-match";
import { CLAUDE_MODELS, extractText, getAnthropic } from "@/lib/anthropic/client";
import { getCurrentUser } from "@/lib/auth/session";
import { canSeeDemoData } from "@/lib/db/demo-visibility";
import { getAgentlyData } from "@/lib/db/live-data";
import { brandMatchPrompt } from "@/prompts/brand-match";
import { gateRateLimit } from "@/lib/security/rate-limit-gate";

export async function POST(request: Request) {
  const gate = await gateRateLimit(request, "ai:brand-match");
  if (gate) return gate;

  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Login required." }, { status: 401 });

  const input = (await request.json()) as BrandMatchInput | CreatorBrandMatchInput;
  const { brands, creators, creatorPlatforms } = await getAgentlyData({ includeDemo: canSeeDemoData(user) });
  const fallback = input.direction === "creator_to_brands"
    ? matchBrandsForCreator(input, creators, creatorPlatforms, brands)
    : matchCreatorsForBrand(input as BrandMatchInput, creators, creatorPlatforms);
  // High-volume route on the recommendations surface — use FAST (Haiku 4.5)
  const anthropic = getAnthropic();
  if (!anthropic) return NextResponse.json({ ...fallback, source: "rules_fallback" });

  const response = await anthropic.messages.create({
    model: CLAUDE_MODELS.FAST,
    max_tokens: 2048,
    system: [{ type: "text", text: brandMatchPrompt, cache_control: { type: "ephemeral" } }],
    messages: [
      {
        role: "user",
        content: JSON.stringify({
          direction: input.direction ?? "brand_to_creators",
          brief: input,
          rules_ranked_matches: fallback
        })
      }
    ]
  });
  const raw = extractText(response) ?? JSON.stringify(fallback);
  let parsed: unknown = fallback;
  try { parsed = JSON.parse(raw); } catch { /* keep fallback */ }
  return NextResponse.json({
    ...(parsed as Record<string, unknown>),
    source: "claude"
  });
}
