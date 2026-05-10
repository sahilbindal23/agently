import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth/session";
import { fetchFacebookPublicMetrics, normalizeFacebookHandle } from "@/lib/social/facebook-public-scraper";
import { fetchInstagramPublicMetrics, normalizeHandle as normalizeInstagramHandle } from "@/lib/social/instagram-public-scraper";

// Admin-only diagnostic: takes a handle + platform, returns the raw fetch
// outcome so you can see exactly why a scrape succeeded or failed for a
// specific profile. Useful when debugging why someone's "Verify from public
// profile" doesn't return real numbers.

const schema = z.object({
  platform: z.enum(["instagram", "facebook"]),
  handle: z.string().trim().min(1).max(200)
});

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user || user.role !== "admin") {
    return NextResponse.json({ error: "Admin only." }, { status: 403 });
  }

  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid request." }, { status: 400 });

  if (parsed.data.platform === "instagram") {
    const normalized = normalizeInstagramHandle(parsed.data.handle);
    if (!normalized) return NextResponse.json({ error: "Could not parse Instagram handle." }, { status: 400 });
    const result = await fetchInstagramPublicMetrics(normalized);
    return NextResponse.json({ platform: "instagram", normalized_handle: normalized, result });
  }

  const normalized = normalizeFacebookHandle(parsed.data.handle);
  if (!normalized) return NextResponse.json({ error: "Could not parse Facebook handle." }, { status: 400 });
  const result = await fetchFacebookPublicMetrics(normalized);
  return NextResponse.json({ platform: "facebook", normalized_handle: normalized, result });
}
