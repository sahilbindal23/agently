// Shared keyword extraction for converting free-text deal/offer descriptions
// into the platform / deliverable / niche taxonomy used by the observations layer.
// Used by internal-deals.ts (closed deal → observation) and the negotiation
// copilot (free-text offer → benchmark lookup).

const PLATFORM_KEYWORDS: Array<{ pattern: RegExp; platform: string }> = [
  { pattern: /\binstagram|insta|ig\b|reel|story|stories\b/i, platform: "Instagram" },
  { pattern: /\byoutube|yt\b|vlog/i, platform: "YouTube" },
  { pattern: /\btwitter|x\.com|tweet|thread\b/i, platform: "Twitter" },
  { pattern: /\blinkedin|li post\b/i, platform: "LinkedIn" },
  { pattern: /\btiktok|tt\b/i, platform: "TikTok" },
  { pattern: /\bmoj|josh|sharechat\b/i, platform: "Regional" }
];

const DELIVERABLE_KEYWORDS: Array<{ pattern: RegExp; deliverable: string }> = [
  { pattern: /\breel(s)?\b/i, deliverable: "reel" },
  { pattern: /\bshort(s)?\b/i, deliverable: "short" },
  { pattern: /\bstory|stories\b/i, deliverable: "story" },
  { pattern: /\bstatic|carousel|post\b/i, deliverable: "static_post" },
  { pattern: /\blong[- ]?form|dedicated|integration\b/i, deliverable: "long_form" },
  { pattern: /\bthread|tweet\b/i, deliverable: "thread" },
  { pattern: /\bpodcast\b/i, deliverable: "podcast" }
];

const NICHE_KEYWORDS: Array<{ pattern: RegExp; niche: string }> = [
  { pattern: /\bfashion|apparel|clothing|outfit\b/i, niche: "fashion" },
  { pattern: /\bbeauty|skincare|cosmetic|makeup\b/i, niche: "beauty" },
  { pattern: /\bfood|restaurant|cafe|recipe|cooking\b/i, niche: "food" },
  { pattern: /\btech|gadget|review|smartphone|laptop\b/i, niche: "tech" },
  { pattern: /\bfitness|gym|workout|wellness\b/i, niche: "fitness" },
  { pattern: /\bfinance|stock|invest|sip|mutual fund|fintech\b/i, niche: "finance" },
  { pattern: /\bgaming|esport|stream\b/i, niche: "gaming" },
  { pattern: /\btravel|hotel|trip|destination\b/i, niche: "travel" },
  { pattern: /\bparenting|baby|kids|family\b/i, niche: "parenting" },
  { pattern: /\bcomedy|funny|prank|skit\b/i, niche: "comedy" },
  { pattern: /\beducation|edtech|tutorial|learn\b/i, niche: "education" },
  { pattern: /\blifestyle|vlog|day in\b/i, niche: "lifestyle" }
];

export type ExtractedTaxonomy = {
  platform: string;
  deliverable: string;
  niche: string;
  /** Each deliverable found, with naive count (e.g. "2 reels and 3 stories") */
  deliverable_breakdown: Array<{ deliverable: string; count: number }>;
};

export function extractFromText(text: string): ExtractedTaxonomy {
  const platform = PLATFORM_KEYWORDS.find((entry) => entry.pattern.test(text))?.platform ?? "unknown";
  const deliverable = DELIVERABLE_KEYWORDS.find((entry) => entry.pattern.test(text))?.deliverable ?? "unknown";
  const niche = NICHE_KEYWORDS.find((entry) => entry.pattern.test(text))?.niche ?? "unknown";

  // Naive count extraction: "2 reels", "3 stories", "1 reel + 5 stories"
  const deliverableBreakdown: Array<{ deliverable: string; count: number }> = [];
  for (const { pattern, deliverable: d } of DELIVERABLE_KEYWORDS) {
    const countPattern = new RegExp(`(\\d+)\\s*${pattern.source}`, "i");
    const match = text.match(countPattern);
    if (match) {
      deliverableBreakdown.push({ deliverable: d, count: Number(match[1]) });
    } else if (pattern.test(text)) {
      // Mentioned without explicit count → assume 1
      deliverableBreakdown.push({ deliverable: d, count: 1 });
    }
  }

  return { platform, deliverable, niche, deliverable_breakdown: deliverableBreakdown };
}
