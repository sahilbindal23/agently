export type CreatorAuditInput = {
  creator_name?: string;
  instagram_url?: string;
  youtube_url?: string;
  tiktok_url?: string;
  sample_posts?: string;
  audience_notes?: string;
  city_focus?: string;
};

export type BrandAuditInput = {
  brand_name?: string;
  website_url?: string;
  instagram_url?: string;
  category?: string;
  product_price_point?: string;
  campaign_goal?: string;
  target_audience?: string;
  city_focus?: string;
  budget_inr?: number;
  brand_notes?: string;
};

const bangaloreSignals = [
  "bangalore",
  "bengaluru",
  "blr",
  "indiranagar",
  "koramangala",
  "hsr",
  "whitefield",
  "church street",
  "mg road",
  "jayanagar",
  "jp nagar",
  "brigade road",
  "cubbon",
  "college",
  "christ university",
  "manipal",
  "pes",
  "rv college"
];

const languageSignals = ["kannada", "hinglish", "hindi", "english", "tamil", "telugu", "malayalam"];

const categories = {
  fashion: ["fashion", "style", "streetwear", "outfit", "thrift", "sneaker", "apparel"],
  food: ["food", "cafe", "coffee", "restaurant", "brunch", "bar", "brewery"],
  gaming: ["gaming", "gamer", "esports", "valorant", "bgmi", "pc", "console", "twitch"],
  tech: ["tech", "gadget", "app", "saas", "creator tools", "ai", "phone", "laptop"],
  fitness: ["fitness", "gym", "wellness", "yoga", "running", "workout"],
  beauty: ["beauty", "skincare", "makeup", "salon", "hair"],
  events: ["event", "concert", "fest", "popup", "launch", "community"]
};

export function auditCreator(input: CreatorAuditInput) {
  const text = `${input.creator_name} ${input.instagram_url} ${input.youtube_url} ${input.tiktok_url} ${input.sample_posts} ${input.audience_notes} ${input.city_focus}`.toLowerCase();
  const cityHits = bangaloreSignals.filter((signal) => text.includes(signal));
  const languages = languageSignals.filter((signal) => text.includes(signal));
  const categoryTags = detectCategories(text);
  const bangaloreScore = Math.min(96, 34 + cityHits.length * 12 + (text.includes("bengaluru") || text.includes("bangalore") ? 18 : 0));
  const indiaScore = Math.min(95, 45 + (text.includes("india") || text.includes("indian") ? 18 : 0) + languages.length * 5 + categoryTags.length * 3);
  const sponsorScore = Math.min(92, 48 + categoryTags.length * 8 + (text.includes("brand") || text.includes("collab") || text.includes("sponsored") ? 12 : 0));
  const riskFlags = detectRiskFlags(text);

  return {
    audit_type: "creator_social_audit",
    bangalore_relevance_score: bangaloreScore,
    india_relevance_score: indiaScore,
    sponsor_readiness_score: sponsorScore,
    detected_categories: categoryTags,
    detected_languages: languages.length ? languages : ["needs_validation"],
    local_signals: cityHits.slice(0, 8),
    content_style_summary: summarizeCreatorStyle(categoryTags, cityHits),
    brand_fit_categories: recommendBrandCategories(categoryTags),
    risk_flags: riskFlags,
    recommended_profile_updates: [
      "Ask creator to upload audience city screenshot from Instagram/YouTube analytics.",
      "Capture top Indian cities, language split, average views, and recent sponsor conflicts.",
      "Store 10-20 recent post URLs for better style and brand-safety analysis."
    ],
    confidence: cityHits.length || categoryTags.length ? 0.72 : 0.46
  };
}

export function auditBrand(input: BrandAuditInput) {
  const budget = Number(input.budget_inr ?? 0);
  const text = `${input.brand_name} ${input.website_url} ${input.instagram_url} ${input.category} ${input.product_price_point} ${input.campaign_goal} ${input.target_audience} ${input.city_focus} ${input.brand_notes}`.toLowerCase();
  const cityHits = bangaloreSignals.filter((signal) => text.includes(signal));
  const categoryTags = detectCategories(text);
  const languages = languageSignals.filter((signal) => text.includes(signal));
  const launchScore = Math.min(96, 42 + cityHits.length * 10 + (text.includes("bengaluru") || text.includes("bangalore") ? 18 : 0));

  return {
    audit_type: "brand_campaign_audit",
    bangalore_launch_fit_score: launchScore,
    detected_category: input.category || categoryTags[0] || "needs_classification",
    ideal_creator_archetypes: buildCreatorArchetypes(categoryTags, text),
    recommended_platforms: recommendPlatforms(text),
    creator_size_band: recommendSizeBand(budget),
    campaign_package: recommendCampaignPackage(budget, categoryTags),
    estimated_budget_fit: budget ? budgetFit(budget) : "Add a budget to estimate realistic creator mix.",
    content_angles: buildContentAngles(input, categoryTags),
    creators_to_avoid: [
      "Creators with mostly non-India audiences for local Bangalore activations.",
      "Creators with recent conflicts in the same category.",
      "Creators whose audience is too broad for the campaign goal."
    ],
    outreach_brief: `${input.brand_name || "The brand"} should pitch a Bangalore-first campaign around ${input.campaign_goal || "a clear product or launch moment"} for ${input.target_audience || "a defined Indian audience"}.`,
    risk_flags: brandRiskFlags(text, budget),
    detected_languages: languages.length ? languages : ["English/Hinglish likely, validate during briefing"],
    confidence: cityHits.length || categoryTags.length || budget ? 0.74 : 0.48
  };
}

function detectCategories(text: string) {
  return Object.entries(categories)
    .filter(([, signals]) => signals.some((signal) => text.includes(signal)))
    .map(([category]) => category);
}

function detectRiskFlags(text: string) {
  const risks = [];
  if (text.includes("betting") || text.includes("gambling")) risks.push("Potential gambling/betting adjacency.");
  if (text.includes("politics") || text.includes("controversy")) risks.push("Review political or controversy risk before pitching premium brands.");
  if (!text.includes("bangalore") && !text.includes("bengaluru")) risks.push("Bangalore relevance is inferred weakly; request analytics screenshot.");
  return risks.length ? risks : ["No obvious risk flags from provided text."];
}

function summarizeCreatorStyle(categoriesFound: string[], cityHits: string[]) {
  const categoryText = categoriesFound.length ? categoriesFound.join(", ") : "general lifestyle";
  const cityText = cityHits.length ? ` with local signals around ${cityHits.slice(0, 3).join(", ")}` : "";
  return `Creator appears oriented around ${categoryText}${cityText}. Validate with recent post URLs and audience analytics.`;
}

function recommendBrandCategories(categoriesFound: string[]) {
  const map: Record<string, string[]> = {
    fashion: ["streetwear", "beauty", "campus fashion", "cafes/events"],
    gaming: ["audio", "gaming hardware", "energy drinks", "streetwear bridge campaigns"],
    food: ["cafes", "restaurants", "delivery apps", "local events"],
    fitness: ["wellness", "wearables", "athleisure", "healthy food"],
    tech: ["apps", "gadgets", "creator tools", "education"],
    beauty: ["skincare", "salons", "fashion", "wellness"]
  };
  return categoriesFound.flatMap((category) => map[category] ?? []).slice(0, 8);
}

function buildCreatorArchetypes(categoriesFound: string[], text: string) {
  if (text.includes("gaming")) return ["gaming-native creators", "campus lifestyle creators", "tech reviewers", "fashion bridge creators"];
  if (categoriesFound.includes("fashion")) return ["Bangalore streetwear creators", "campus lifestyle creators", "beauty/fashion micro creators", "events creators"];
  if (categoriesFound.includes("food")) return ["Bangalore food reviewers", "cafe-hopping lifestyle creators", "student creators", "local events creators"];
  return ["Bangalore micro creators", "category specialists", "local lifestyle creators", "bridge-audience creators"];
}

function recommendPlatforms(text: string) {
  if (text.includes("youtube")) return ["YouTube", "Instagram Reels", "Instagram Stories"];
  if (text.includes("gaming")) return ["Instagram Reels", "YouTube Shorts", "Twitch/YouTube Live"];
  return ["Instagram Reels", "Instagram Stories", "YouTube Shorts"];
}

function recommendSizeBand(budget: number) {
  if (!budget) return "micro creators first; add budget for sharper planning";
  if (budget < 50000) return "nano to small micro creators";
  if (budget < 200000) return "micro creators with one mid-tier anchor";
  return "mid-tier creators plus micro creator support";
}

function recommendCampaignPackage(budget: number, categoriesFound: string[]) {
  if (!budget) return "Start with 2-3 creator pilots and compare response quality.";
  if (budget < 50000) return "1-2 nano/micro creators, Reels plus story frames, no paid usage.";
  if (budget < 200000) return "3-5 micro creators, mixed Reels/stories, one bridge-audience creator.";
  const category = categoriesFound[0] || "category";
  return `One ${category} anchor creator plus 4-6 micro creators across Reels, stories, and event/store activation.`;
}

function budgetFit(budget: number) {
  if (budget < 25000) return "Tight budget: use nano creators or UGC-only briefs.";
  if (budget < 100000) return "Good for a small Bangalore pilot with micro creators.";
  if (budget < 300000) return "Strong for a city launch with several creators and one anchor.";
  return "Enough for a structured Bangalore campaign with testing and paid usage add-ons.";
}

function buildContentAngles(input: BrandAuditInput, categoriesFound: string[]) {
  const category = input.category || categoriesFound[0] || "brand";
  return [
    `${category} through a Bangalore day-in-the-life format.`,
    `Creator-led comparison: why this product fits ${input.target_audience || "the target audience"}.`,
    `Local activation around ${input.city_focus || "Bengaluru"} with Reels plus story proof.`,
    "Bridge-audience angle that makes the brand credible outside its obvious niche."
  ];
}

function brandRiskFlags(text: string, budget: number) {
  const risks = [];
  if (!budget) risks.push("Budget missing; creator recommendations will be less realistic.");
  if (!text.includes("bangalore") && !text.includes("bengaluru")) risks.push("City focus is unclear for a Bangalore-first launch.");
  if (!text.includes("goal") && text.length < 120) risks.push("Campaign brief is thin; ask brand for a clearer success metric.");
  return risks.length ? risks : ["No obvious campaign risk from provided brief."];
}
