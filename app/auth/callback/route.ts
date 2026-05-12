import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Supabase auth callback.
//
// Supabase recovery (and OAuth) flows redirect users here after they click
// the action link in their email. The URL carries a one-time `code` query
// param that we exchange for a session via @supabase/ssr. Once exchanged,
// Supabase cookies are set on the response and the user is redirected to
// the `next` URL (defaulting to /reset-password for recovery).
//
// Why this route exists separately from /api/auth: this is a GET handler
// the browser navigates to, not a fetch call. Keeping it at /auth/callback
// matches Supabase docs and lets us reuse it for OAuth providers later.

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const next = url.searchParams.get("next") || "/dashboard";

  // Whitelist the redirect to avoid open-redirect vulnerabilities. Only
  // allow relative paths starting with a single slash and not double slash
  // (which browsers treat as protocol-relative).
  const safeNext = next.startsWith("/") && !next.startsWith("//") ? next : "/dashboard";

  if (!code) {
    return NextResponse.redirect(new URL(`/login?error=missing_code`, url));
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    return NextResponse.redirect(new URL(`/login?error=${encodeURIComponent("Link expired or already used. Request a new password reset.")}`, url));
  }

  return NextResponse.redirect(new URL(safeNext, url));
}
