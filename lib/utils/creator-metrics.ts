import type { Creator } from "@/types";

export function getIndiaAudiencePercent(creator: Creator) {
  const syncedPlatform = (creator as Creator & { platforms?: Array<{ india_audience_percent?: number }> }).platforms?.find((platform) => Number(platform.india_audience_percent ?? 0) > 0);
  if (syncedPlatform?.india_audience_percent) return Number(syncedPlatform.india_audience_percent);
  if (creator.india_audience_percent > 0) return creator.india_audience_percent;
  if (creator.us_audience_percent > 0) return creator.us_audience_percent;
  if (creator.country.toLowerCase().includes("in")) return 72;
  return 18;
}

// Generalised city-fit scorer. Takes a target city (typically the campaign's
// city_focus) and returns 20-98 representing how well the creator matches.
//
// Inputs combined:
//   - creator.home_city                (intake)
//   - creator.top_indian_cities[]      (intake — places audience lives)
//   - creator.languages[]              (intake)
//   - creator.india_audience_percent   (Phyllo or intake)
//   - creator.bio / content_style / primary_niche (intake)
//   - creator.country                  (intake)
//   - audienceTopCities                (Phyllo snapshot top_cities)
//
// Scoring logic:
//   +34 if home_city matches the target city directly
//   +24 if top_indian_cities or audience top cities mention the target
//   +14 if creator is in a major Indian metro and target is too
//   +N up to 22 for India audience % overall
//   +10 for relevant Indian languages
//   +8 if target city appears in top_indian_cities
//   +6 for India country code
//   +6 for explicit local/city mentions in bio/style/niche
//   +4 monetization >= 80, +3 valuation >= 85
//
// When targetCity is empty, falls back to a general India fit signal.
// This score stays INTERNAL — it feeds the recommendation engine but is
// not surfaced to creators as a standout metric on the marketplace.
export function getCityFit(
  creator: Creator,
  targetCity?: string | null,
  audienceTopCities: string[] = []
) {
  const target = (targetCity ?? "").toLowerCase().trim();
  const targetTokens = target ? expandCityAliases(target) : [];

  const homeCity = creator.home_city.toLowerCase();
  const cityText = [creator.home_city, ...creator.top_indian_cities, ...audienceTopCities].join(" ").toLowerCase();
  let score = 20;

  // Direct + indirect city match against the campaign's target
  if (target) {
    if (targetTokens.some((t) => homeCity.includes(t))) score += 34;
    else if (targetTokens.some((t) => cityText.includes(t))) score += 24;
    else if (isMajorIndianMetro(cityText) && targetTokens.some(isMajorIndianMetroToken)) score += 14;
    if (creator.top_indian_cities.some((city) => targetTokens.some((t) => city.toLowerCase().includes(t)))) score += 8;
  } else {
    // No specific city target — give generic India relevance
    if (isMajorIndianMetro(cityText)) score += 14;
  }

  const indiaAudience = getIndiaAudiencePercent(creator);
  score += Math.min(22, Math.round(indiaAudience / 5));
  if (creator.languages.some((language) => ["kannada", "hindi", "hinglish", "tamil", "telugu", "marathi", "bengali", "malayalam"].includes(language.toLowerCase()))) score += 10;
  if (creator.country.toLowerCase().includes("in")) score += 6;

  const localContentSignals = [creator.bio, creator.content_style, creator.primary_niche].join(" ").toLowerCase();
  if (target && targetTokens.some((t) => localContentSignals.includes(t))) score += 6;
  else if (localContentSignals.includes("local") || localContentSignals.includes("india")) score += 3;
  if (creator.monetization_score >= 80) score += 4;
  if (creator.valuation_score >= 85) score += 3;

  return Math.max(20, Math.min(98, score));
}

// Backwards-compat shim for any code that still calls the old name.
// New code should use getCityFit(creator, campaign.city_focus).
export function getBangaloreFit(creator: Creator) {
  return getCityFit(creator, "bangalore");
}

const MAJOR_METROS = ["bengaluru", "bangalore", "mumbai", "delhi", "ncr", "hyderabad", "chennai", "pune", "kolkata", "ahmedabad"];

function expandCityAliases(token: string): string[] {
  // Common alias pairs in Indian city names. Lets campaigns target
  // "bangalore" or "bengaluru" interchangeably.
  if (token.includes("bangalore") || token.includes("bengaluru")) return ["bangalore", "bengaluru"];
  if (token.includes("delhi") || token.includes("ncr") || token.includes("gurgaon") || token.includes("noida")) return ["delhi", "ncr", "gurgaon", "noida"];
  if (token.includes("mumbai") || token.includes("bombay")) return ["mumbai", "bombay"];
  if (token.includes("chennai") || token.includes("madras")) return ["chennai", "madras"];
  if (token.includes("kolkata") || token.includes("calcutta")) return ["kolkata", "calcutta"];
  return [token];
}

function isMajorIndianMetro(text: string) {
  return MAJOR_METROS.some((metro) => text.includes(metro));
}

function isMajorIndianMetroToken(token: string) {
  return MAJOR_METROS.includes(token);
}

export function getCreatorLanguages(creator: Creator) {
  return creator.languages.length ? creator.languages.join(", ") : "Not captured";
}
