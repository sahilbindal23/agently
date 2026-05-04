import type { Creator } from "@/types";

export function getIndiaAudiencePercent(creator: Creator) {
  const syncedPlatform = (creator as Creator & { platforms?: Array<{ india_audience_percent?: number }> }).platforms?.find((platform) => Number(platform.india_audience_percent ?? 0) > 0);
  if (syncedPlatform?.india_audience_percent) return Number(syncedPlatform.india_audience_percent);
  if (creator.india_audience_percent > 0) return creator.india_audience_percent;
  if (creator.us_audience_percent > 0) return creator.us_audience_percent;
  if (creator.country.toLowerCase().includes("in")) return 72;
  return 18;
}

export function getBangaloreFit(creator: Creator) {
  const cityText = [creator.home_city, ...creator.top_indian_cities].join(" ").toLowerCase();
  let score = 20;

  if (creator.home_city.toLowerCase().includes("bengaluru") || creator.home_city.toLowerCase().includes("bangalore")) score += 34;
  else if (cityText.includes("bengaluru") || cityText.includes("bangalore")) score += 24;
  else if (cityText.includes("mumbai") || cityText.includes("delhi") || cityText.includes("hyderabad") || cityText.includes("chennai") || cityText.includes("pune")) score += 14;

  const indiaAudience = getIndiaAudiencePercent(creator);
  score += Math.min(22, Math.round(indiaAudience / 5));
  if (creator.languages.some((language) => ["kannada", "hindi", "hinglish"].includes(language.toLowerCase()))) score += 10;
  if (creator.top_indian_cities.some((city) => ["bengaluru", "bangalore"].includes(city.toLowerCase()))) score += 8;
  if (creator.country.toLowerCase().includes("in")) score += 6;

  const localContentSignals = [creator.bio, creator.content_style, creator.primary_niche].join(" ").toLowerCase();
  if (localContentSignals.includes("bengaluru") || localContentSignals.includes("bangalore") || localContentSignals.includes("local")) score += 6;
  if (creator.monetization_score >= 80) score += 4;
  if (creator.valuation_score >= 85) score += 3;

  return Math.max(20, Math.min(98, score));
}

export function getCreatorLanguages(creator: Creator) {
  return creator.languages.length ? creator.languages.join(", ") : "Not captured";
}
