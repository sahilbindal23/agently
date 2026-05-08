// Lightweight verification helper: does the user's email domain match the
// website domain they provided?
// e.g. email "marketing@nykaa.com" + website "https://www.nykaa.com" -> true
// This is a cheap proxy for "this person works at the brand they claim",
// covers most legit India D2C brands without requiring Meta App Review or
// other heavy KYC. Intentionally permissive on www/subdomains.

const PUBLIC_EMAIL_DOMAINS = new Set([
  "gmail.com", "googlemail.com", "yahoo.com", "yahoo.co.in", "yahoo.in",
  "hotmail.com", "outlook.com", "live.com", "protonmail.com", "proton.me",
  "icloud.com", "me.com", "mac.com", "rediffmail.com", "rediff.com",
  "aol.com", "zoho.com", "zoho.in", "fastmail.com"
]);

function extractEmailDomain(email: string): string | null {
  const trimmed = String(email ?? "").trim().toLowerCase();
  const at = trimmed.lastIndexOf("@");
  if (at < 0) return null;
  const domain = trimmed.slice(at + 1);
  if (!domain || domain.includes(" ")) return null;
  return domain;
}

function extractWebsiteDomain(website: string): string | null {
  let raw = String(website ?? "").trim().toLowerCase();
  if (!raw) return null;
  // Add scheme so URL parser works on bare "nykaa.com"
  if (!/^https?:\/\//i.test(raw)) raw = `https://${raw}`;
  try {
    const url = new URL(raw);
    return url.hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}

/**
 * Returns one of:
 *   "match" - email domain matches website domain (or is a subdomain of it)
 *   "public_inbox" - email is on a public mail provider (gmail, yahoo, etc.)
 *                   and so cannot be matched to any specific brand
 *   "mismatch" - both inputs are valid but they're different domains
 *   "missing_data" - one or both inputs are empty/unparseable
 */
export function classifyEmailWebsiteMatch(email: string, website: string):
  "match" | "public_inbox" | "mismatch" | "missing_data" {
  const emailDomain = extractEmailDomain(email);
  const websiteDomain = extractWebsiteDomain(website);

  if (!emailDomain) return "missing_data";
  if (PUBLIC_EMAIL_DOMAINS.has(emailDomain)) return "public_inbox";
  if (!websiteDomain) return "missing_data";

  // Match if exact, or if email domain is a subdomain of website domain
  // (e.g. mail.nykaa.com vs nykaa.com)
  if (emailDomain === websiteDomain) return "match";
  if (emailDomain.endsWith(`.${websiteDomain}`)) return "match";
  if (websiteDomain.endsWith(`.${emailDomain}`)) return "match";

  return "mismatch";
}

export function shouldAutoVerifyBrand(email: string, website: string): boolean {
  return classifyEmailWebsiteMatch(email, website) === "match";
}
