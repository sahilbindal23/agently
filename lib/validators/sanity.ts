// Lightweight sanity checks for free-text input fields. Goal: catch obvious
// trolling and gibberish at the API layer so it never reaches the engine
// or the public marketplace. Not a heavy profanity filter (those have
// false-positive nightmares with cultural terms); deliberately permissive
// on content, strict on structure.
//
// Used at signup (full_name, brand_name) and at intake (bio, audience_notes,
// target_audience, campaign_goal, brand_notes).

// Curated minimal English profanity list. Keep this short and obvious -
// false positives are worse than false negatives because it forces real
// users into support loops. We're catching the "fuck", "shit", "asshole"
// level of trolling, not policing strong opinions.
const PROFANITY_TERMS = [
  "fuck", "fucker", "shit", "asshole", "bitch", "cunt", "dick", "pussy",
  "bastard", "slut", "whore", "motherfucker", "retard", "faggot",
  // Hindi/Hinglish slurs that also commonly appear in troll signups
  "chutiya", "behenchod", "madarchod", "bhosdike", "randi", "gandu"
];

const LOW_QUALITY_PHRASES = [
  "none of your business",
  "fuck off",
  "test test",
  "asdf",
  "qwerty",
  "lorem ipsum",
  "your mom",
  "your mum",
  "spam"
];

export type SanityVerdict = {
  ok: boolean;
  reason?: "too_short" | "profanity" | "low_quality" | "repetitive" | "all_caps_long" | "url_only" | "missing";
  cleaned: string;
};

/**
 * Validate a free-text field. Returns { ok, reason } - if !ok, the caller
 * should reject the request with a clear user-facing error.
 *
 * Tunable thresholds: pass options to adjust per-field strictness.
 */
export function checkFreeText(input: unknown, options: {
  fieldLabel: string;
  /** Minimum trimmed character count. 0 means optional. */
  minLength?: number;
  /** Maximum length - we still accept up to here, just trims for storage. */
  maxLength?: number;
  /** When true, fully missing input is fine; we just return ok=true with empty cleaned. */
  optional?: boolean;
} = { fieldLabel: "field" }): SanityVerdict {
  const raw = String(input ?? "").trim();
  const minLength = options.minLength ?? 3;
  const maxLength = options.maxLength ?? 4000;

  if (!raw) {
    return options.optional
      ? { ok: true, cleaned: "" }
      : { ok: false, reason: "missing", cleaned: "" };
  }

  const truncated = raw.slice(0, maxLength);
  const lower = truncated.toLowerCase();

  if (truncated.length < minLength) {
    return { ok: false, reason: "too_short", cleaned: truncated };
  }

  // URL-only: someone pasted just a link with no actual content
  if (/^https?:\/\/\S+\s*$/i.test(truncated) && !options.optional && minLength > 10) {
    return { ok: false, reason: "url_only", cleaned: truncated };
  }

  // Repetitive: same character or short pattern repeated 6+ times
  // ("aaaaaa", "asdasdasd", "lol lol lol")
  if (/(.)\1{5,}/i.test(truncated)) {
    return { ok: false, reason: "repetitive", cleaned: truncated };
  }
  if (/^(.{1,4})\1{3,}$/i.test(truncated.replace(/\s+/g, ""))) {
    return { ok: false, reason: "repetitive", cleaned: truncated };
  }

  // All caps shouts longer than 30 chars - usually trolls or pasted YELLING
  if (truncated.length > 30 && truncated === truncated.toUpperCase() && /[A-Z]/.test(truncated)) {
    return { ok: false, reason: "all_caps_long", cleaned: truncated };
  }

  // Word-boundary profanity check (avoids false positives like "scunthorpe"
  // or "classic" matching shorter terms inside longer words)
  for (const term of PROFANITY_TERMS) {
    const re = new RegExp(`\\b${escapeRegex(term)}\\b`, "i");
    if (re.test(lower)) {
      return { ok: false, reason: "profanity", cleaned: truncated };
    }
  }

  // Phrase-based low-quality detection
  for (const phrase of LOW_QUALITY_PHRASES) {
    if (lower.includes(phrase)) {
      return { ok: false, reason: "low_quality", cleaned: truncated };
    }
  }

  return { ok: true, cleaned: truncated };
}

/**
 * User-facing error message for a sanity verdict. Keep them firm but not
 * preachy.
 */
export function sanityErrorMessage(verdict: SanityVerdict, fieldLabel: string): string {
  switch (verdict.reason) {
    case "missing":         return `${fieldLabel} is required.`;
    case "too_short":       return `${fieldLabel} is too short. Add a bit more detail so brands and creators can understand who you are.`;
    case "profanity":       return `${fieldLabel} contains language we can't accept on a brand-facing platform. Please rewrite professionally.`;
    case "low_quality":     return `${fieldLabel} looks like placeholder or test text. Please write a real description.`;
    case "repetitive":      return `${fieldLabel} contains repeated characters or words. Please write a real description.`;
    case "all_caps_long":   return `${fieldLabel} is in all caps. Use normal capitalisation so it reads cleanly on profile cards.`;
    case "url_only":        return `${fieldLabel} should describe you, not just link to another page.`;
    default:                return `${fieldLabel} could not be validated. Please rewrite it.`;
  }
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
