// Niche / industry / category graph used by the graded categoryFit
// scorer in rankCreators.
//
// The previous binary `90 or 48` cliff couldn't tell that a tech
// reviewer for an earbuds brief is closer fit than a lifestyle
// reviewer for the same brief — both hit 90 the moment ANY keyword
// overlapped. This graph gives the ranker enough structure to grade:
//
//   direct        creator's primary_niche is in campaign.creator_categories
//                 OR brand industry maps to the creator's niche
//   industry      brand industry directly aligns with creator's niche
//                 (e.g. consumer electronics × tech reviewer)
//   adjacent      neighboring niche in the graph (food ↔ cooking ↔ lifestyle)
//   style         no niche/industry match, but content_style overlaps
//                 the brief's keywords (the previous "any keyword hit"
//                 case, kept as a soft signal not a strong one)
//   cold          nothing aligns
//
// India-first taxonomy. Keep it curated, not exhaustive — every entry
// you add becomes a thing the ranker can pivot on. Better to have 25
// well-chosen entries than 200 noisy ones.

export type CategoryMatchTier = "direct" | "industry" | "adjacent" | "style" | "cold";

export const CATEGORY_FIT_SCORES: Record<CategoryMatchTier, number> = {
  direct: 95,
  industry: 82,
  adjacent: 65,
  style: 50,
  cold: 32
};

type NicheRelations = {
  // Niches that share audience overlap and creative context with this one.
  // Used for the "adjacent" tier.
  related: string[];
  // Brand industries this niche authentically fits. Used for the
  // "industry" tier — typed against brands.industry text values.
  industries: string[];
};

// Canonical niche keys (lowercase, single token preferred). Add new
// niches as creators sign up with novel positioning. Industries follow
// what the brands intake form actually captures today.
const NICHE_GRAPH: Record<string, NicheRelations> = {
  // Tech cluster
  tech: {
    related: ["gadgets", "gaming", "ai", "productivity", "business"],
    industries: ["consumer electronics", "saas", "fintech", "ed-tech", "audio", "gadgets", "smart home", "ai"]
  },
  gadgets: {
    related: ["tech", "gaming", "audio", "smart home"],
    industries: ["consumer electronics", "audio", "gadgets", "smart home", "gaming hardware"]
  },
  gaming: {
    related: ["tech", "gadgets", "esports"],
    industries: ["gaming hardware", "gaming", "esports", "energy drinks", "consumer electronics"]
  },
  ai: {
    related: ["tech", "productivity", "business", "ed-tech"],
    industries: ["saas", "ai", "productivity", "ed-tech", "business services"]
  },
  productivity: {
    related: ["tech", "ai", "business", "education"],
    industries: ["saas", "productivity", "ed-tech", "business services"]
  },

  // Food cluster
  food: {
    related: ["cooking", "restaurant-review", "baking", "nutrition", "lifestyle"],
    industries: ["fmcg", "food and beverage", "restaurants", "kitchenware", "groceries", "snacks", "beverages"]
  },
  cooking: {
    related: ["food", "baking", "nutrition", "lifestyle"],
    industries: ["fmcg", "kitchenware", "food and beverage", "groceries"]
  },
  "restaurant-review": {
    related: ["food", "lifestyle", "travel"],
    industries: ["restaurants", "food and beverage", "hospitality"]
  },
  baking: {
    related: ["food", "cooking", "lifestyle"],
    industries: ["fmcg", "baking supplies", "kitchenware", "food and beverage"]
  },
  nutrition: {
    related: ["food", "fitness", "wellness"],
    industries: ["supplements", "wellness", "fitness", "fmcg", "food and beverage"]
  },

  // Fashion + beauty cluster
  fashion: {
    related: ["streetwear", "sustainable-fashion", "jewelry", "beauty", "lifestyle"],
    industries: ["apparel", "fashion", "footwear", "accessories", "jewelry"]
  },
  streetwear: {
    related: ["fashion", "lifestyle", "gaming"],
    industries: ["apparel", "footwear", "accessories", "fashion"]
  },
  "sustainable-fashion": {
    related: ["fashion", "lifestyle", "wellness"],
    industries: ["apparel", "fashion", "ethical brands", "lifestyle"]
  },
  jewelry: {
    related: ["fashion", "lifestyle"],
    industries: ["jewelry", "fashion", "accessories"]
  },
  beauty: {
    related: ["skincare", "makeup", "haircare", "wellness", "fashion"],
    industries: ["cosmetics", "skincare", "haircare", "beauty", "wellness"]
  },
  skincare: {
    related: ["beauty", "wellness", "lifestyle"],
    industries: ["skincare", "cosmetics", "wellness", "beauty"]
  },
  makeup: {
    related: ["beauty", "fashion"],
    industries: ["cosmetics", "beauty", "makeup"]
  },
  haircare: {
    related: ["beauty", "wellness"],
    industries: ["haircare", "beauty", "cosmetics"]
  },

  // Fitness + wellness cluster
  fitness: {
    related: ["yoga", "wellness", "nutrition", "food"],
    industries: ["sportswear", "supplements", "gyms", "wearables", "fitness", "fitness apps", "sports nutrition"]
  },
  yoga: {
    related: ["fitness", "wellness", "lifestyle"],
    industries: ["wellness", "sportswear", "fitness", "mental health"]
  },
  wellness: {
    related: ["fitness", "yoga", "beauty", "skincare", "lifestyle"],
    industries: ["wellness", "supplements", "mental health", "skincare", "fitness"]
  },

  // Lifestyle + travel + parenting cluster
  lifestyle: {
    related: ["fashion", "beauty", "food", "travel", "wellness", "parenting"],
    industries: ["apparel", "beauty", "food and beverage", "home decor", "travel", "lifestyle", "fmcg"]
  },
  travel: {
    related: ["lifestyle", "restaurant-review", "food"],
    industries: ["travel", "hospitality", "luggage", "travel gear", "tourism"]
  },
  parenting: {
    related: ["lifestyle", "food", "education"],
    industries: ["baby products", "kids", "education", "family services", "fmcg"]
  },

  // Finance / business / education cluster
  finance: {
    related: ["business", "productivity", "education"],
    industries: ["fintech", "banking", "insurance", "investing", "wealth management"]
  },
  business: {
    related: ["finance", "productivity", "tech", "education"],
    industries: ["saas", "business services", "productivity", "fintech"]
  },
  education: {
    related: ["productivity", "parenting", "ai"],
    industries: ["ed-tech", "education", "books", "courses"]
  },

  // Catch-all entertainment
  comedy: {
    related: ["entertainment", "lifestyle"],
    industries: ["entertainment", "fmcg", "media", "streaming"]
  },
  entertainment: {
    related: ["comedy", "gaming", "lifestyle"],
    industries: ["entertainment", "media", "streaming", "fmcg"]
  }
};

// Strip whitespace, lowercase, collapse common synonyms so "Tech Reviews"
// "tech-reviews" and "TECH" all resolve to "tech". Not exhaustive — we
// only collapse the cases we've actually seen in creator profiles.
const SYNONYMS: Record<string, string> = {
  "tech reviews": "tech",
  "tech review": "tech",
  "technology": "tech",
  "consumer tech": "tech",
  "consumer electronics": "tech",
  "mobile gaming": "gaming",
  "pc gaming": "gaming",
  "video games": "gaming",
  "food and lifestyle": "food",
  "bengaluru food": "food",
  "indian food": "food",
  "home cooking": "cooking",
  "baker": "baking",
  "fashion and lifestyle": "fashion",
  "men's fashion": "fashion",
  "women's fashion": "fashion",
  "skincare and beauty": "skincare",
  "personal finance": "finance",
  "investing": "finance",
  "stocks": "finance",
  "ai and tech": "ai",
  "machine learning": "ai",
  "productivity tools": "productivity",
  "long-form reviews": "tech",
  "yoga and wellness": "yoga",
  "fitness and wellness": "fitness",
  "moms": "parenting",
  "kids": "parenting"
};

export function normalizeNiche(input: string | null | undefined): string {
  const cleaned = String(input ?? "")
    .toLowerCase()
    .replace(/[_/]/g, "-")
    .replace(/[^a-z0-9 -]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  if (!cleaned) return "";
  if (SYNONYMS[cleaned]) return SYNONYMS[cleaned];
  // Try the first significant token as a fallback (e.g. "tech reviewer" → "tech")
  const firstToken = cleaned.split(" ")[0];
  if (NICHE_GRAPH[firstToken]) return firstToken;
  return cleaned;
}

export function nicheRelations(niche: string): NicheRelations {
  const normalized = normalizeNiche(niche);
  return NICHE_GRAPH[normalized] ?? { related: [], industries: [] };
}

// Graded category fit. Returns a score (0-100) and the tier that scored
// it. The tier doubles as a UI label so brands see WHY a creator ranked
// where they did — "Direct match" vs. "Industry adjacent" vs. "Lifestyle
// crossover" reads more honest than a single number.
export function gradedCategoryFit({
  creatorNiche,
  creatorContentStyle,
  campaignCategories,
  brandIndustry
}: {
  creatorNiche: string | null | undefined;
  creatorContentStyle: string | null | undefined;
  campaignCategories: string[];
  brandIndustry: string | null | undefined;
}): { score: number; tier: CategoryMatchTier } {
  const creatorKey = normalizeNiche(creatorNiche);
  const creatorRelations = nicheRelations(creatorKey);
  const styleText = String(creatorContentStyle ?? "").toLowerCase();
  const campaignKeys = campaignCategories
    .map(normalizeNiche)
    .filter((value) => value.length > 0);
  const brandIndustryNormalized = String(brandIndustry ?? "").toLowerCase().trim();

  // Tier 1: direct match — creator's niche is explicitly in the campaign's
  // requested categories. Strongest possible signal.
  if (creatorKey && campaignKeys.includes(creatorKey)) {
    return { score: CATEGORY_FIT_SCORES.direct, tier: "direct" };
  }

  // Tier 2: industry alignment — brand industry maps to creator's niche.
  // Captures the "tech reviewer × consumer electronics campaign" case
  // even if the brief's free-text categories didn't literally say "tech".
  if (creatorRelations.industries.length && brandIndustryNormalized) {
    const industryHit = creatorRelations.industries.some((industry) =>
      brandIndustryNormalized.includes(industry) || industry.includes(brandIndustryNormalized)
    );
    if (industryHit) return { score: CATEGORY_FIT_SCORES.industry, tier: "industry" };
  }

  // Tier 3: adjacent niche — creator's niche neighbors one of the
  // campaign's categories in the graph (food creator × cookware brief
  // when category is "cooking", lifestyle × fashion brief, etc.).
  if (creatorRelations.related.length && campaignKeys.length) {
    const adjacentHit = creatorRelations.related.some((related) =>
      campaignKeys.includes(related)
    );
    if (adjacentHit) return { score: CATEGORY_FIT_SCORES.adjacent, tier: "adjacent" };
  }

  // Tier 4: style overlap only — the old binary-90 fallback case.
  // Demoted to a soft signal so it doesn't dominate genuine niche fit.
  if (styleText && campaignKeys.length) {
    const styleHit = campaignKeys.some((key) => styleText.includes(key));
    if (styleHit) return { score: CATEGORY_FIT_SCORES.style, tier: "style" };
  }

  return { score: CATEGORY_FIT_SCORES.cold, tier: "cold" };
}

// Human-readable label for the match tier. Used by the recommendation
// card so brands understand the source of the ranking, not just the
// number.
export function categoryTierLabel(tier: CategoryMatchTier): string {
  if (tier === "direct") return "Direct category fit";
  if (tier === "industry") return "Industry alignment";
  if (tier === "adjacent") return "Adjacent niche";
  if (tier === "style") return "Style crossover";
  return "Pilot test fit";
}
