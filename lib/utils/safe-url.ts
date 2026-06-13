// Guards against javascript:/data:/vbscript: URLs that a user can submit and
// that would execute in another user's session when rendered as a link and
// clicked (stored XSS-on-click). Any user-submitted value used as an <a href>
// — deliverable links, social/portfolio/website URLs, dispute evidence — MUST
// pass through here.
//
// Returns the URL only if it is an absolute http(s) URL; otherwise undefined,
// so callers render a non-link fallback instead of an executable href.

export function safeExternalHref(url: unknown): string | undefined {
  const raw = String(url ?? "").trim();
  if (!raw) return undefined;
  try {
    const parsed = new URL(raw);
    if (parsed.protocol === "http:" || parsed.protocol === "https:") {
      return parsed.toString();
    }
    return undefined;
  } catch {
    // Relative URLs, mailto:, javascript:, malformed strings, etc.
    return undefined;
  }
}

/** True when the value is a safe absolute http(s) URL. Handy for zod refines. */
export function isHttpUrl(url: unknown): boolean {
  return safeExternalHref(url) !== undefined;
}
