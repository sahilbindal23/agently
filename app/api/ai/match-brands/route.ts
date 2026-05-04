import { NextResponse } from "next/server";
import { matchBrandsForCreator, matchCreatorsForBrand, type BrandMatchInput, type CreatorBrandMatchInput } from "@/lib/ai/brand-match";
import { getCurrentUser } from "@/lib/auth/session";
import { getAgentlyData } from "@/lib/db/live-data";
import { getOpenAI } from "@/lib/openai/client";
import { brandMatchPrompt } from "@/prompts/brand-match";

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Login required." }, { status: 401 });

  const input = (await request.json()) as BrandMatchInput | CreatorBrandMatchInput;
  const { brands, creators, creatorPlatforms } = await getAgentlyData();
  const fallback = input.direction === "creator_to_brands"
    ? matchBrandsForCreator(input, creators, creatorPlatforms, brands)
    : matchCreatorsForBrand(input as BrandMatchInput, creators, creatorPlatforms);
  const openai = getOpenAI();
  if (!openai) return NextResponse.json({ ...fallback, source: "rules_fallback" });

  const completion = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: brandMatchPrompt },
      { role: "user", content: JSON.stringify({ direction: input.direction ?? "brand_to_creators", brief: input, rules_ranked_matches: fallback }) }
    ]
  });
  return NextResponse.json({
    ...JSON.parse(completion.choices[0]?.message.content ?? JSON.stringify(fallback)),
    source: "openai"
  });
}
