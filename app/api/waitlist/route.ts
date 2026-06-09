import { NextResponse } from "next/server";
import { sendEmail, waitlistConfirmationEmail } from "@/lib/email/send";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkFreeText, sanityErrorMessage } from "@/lib/validators/sanity";

type Role = "creator" | "brand" | "freelancer";

// Trim + cap a free-form optional string, returning null when empty so we
// don't store empty strings.
function optional(value: unknown, max = 200): string | null {
  const text = String(value ?? "").trim().slice(0, max);
  return text.length > 0 ? text : null;
}

// Max successful waitlist submissions per IP per hour. Generous enough for
// shared/NAT'd networks and legitimate retries, tight enough to stop a bot
// using the endpoint to blast confirmation emails at arbitrary addresses
// (which would damage the sending domain's reputation).
const MAX_PER_IP_PER_HOUR = 8;

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));

  // Honeypot: this hidden field is invisible to humans but eagerly filled by
  // dumb form bots. If it's populated, pretend success and do nothing — no
  // insert, no email — so the bot gets no signal that it was caught.
  if (optional(body.homepage)) {
    return NextResponse.json({ ok: true });
  }

  const role = String(body.role ?? "creator") as Role;
  const email = String(body.email ?? "").trim().toLowerCase();
  const fullName = String(body.full_name ?? "").trim();

  if (role !== "creator" && role !== "brand" && role !== "freelancer") {
    return NextResponse.json({ error: "Invalid role." }, { status: 400 });
  }

  if (!email || !fullName) {
    return NextResponse.json({ error: "Name and email are required." }, { status: 400 });
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: "Please enter a valid email address." }, { status: 400 });
  }

  // Same gibberish/troll guard used at signup so the founder isn't reviewing
  // "asdf" and "test test" waitlist rows.
  const nameCheck = checkFreeText(fullName, { fieldLabel: "Name", minLength: 2, maxLength: 120 });
  if (!nameCheck.ok) {
    return NextResponse.json({ error: sanityErrorMessage(nameCheck, "Name") }, { status: 400 });
  }

  // Brands must give a company name; sanity-check it the same way.
  let company: string | null = null;
  if (role === "brand") {
    const rawCompany = String(body.company ?? "").trim();
    if (!rawCompany) {
      return NextResponse.json({ error: "Company / brand name is required." }, { status: 400 });
    }
    const companyCheck = checkFreeText(rawCompany, { fieldLabel: "Company", minLength: 2, maxLength: 120 });
    if (!companyCheck.ok) {
      return NextResponse.json({ error: sanityErrorMessage(companyCheck, "Company") }, { status: 400 });
    }
    company = companyCheck.cleaned;
  }

  // Optional note gets a light sanity pass too, but never blocks the request
  // on length — people may leave it blank.
  const rawNote = optional(body.note, 1000);
  let note: string | null = null;
  if (rawNote) {
    const noteCheck = checkFreeText(rawNote, { fieldLabel: "Note", optional: true, maxLength: 1000 });
    if (!noteCheck.ok && noteCheck.reason === "profanity") {
      return NextResponse.json({ error: "Please remove inappropriate language from your note." }, { status: 400 });
    }
    note = noteCheck.cleaned || rawNote;
  }

  const supabase = createAdminClient();
  if (!supabase) {
    return NextResponse.json({ error: "Server is not configured. Please try again later." }, { status: 500 });
  }

  const ipAddress =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    request.headers.get("x-real-ip") ??
    null;

  // Per-IP throttle. Counts this IP's submissions in the last hour before
  // accepting another. Fails open (allows) if the count query itself errors,
  // so a transient DB issue never blocks a genuine signup.
  if (ipAddress) {
    const sinceIso = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { count, error: countError } = await supabase
      .from("waitlist")
      .select("id", { count: "exact", head: true })
      .eq("ip_address", ipAddress)
      .gte("created_at", sinceIso);
    if (!countError && (count ?? 0) >= MAX_PER_IP_PER_HOUR) {
      return NextResponse.json(
        { error: "Too many requests from your network. Please try again later." },
        { status: 429, headers: { "Retry-After": "3600" } }
      );
    }
  }

  const row = {
    role,
    full_name: nameCheck.cleaned,
    email,
    primary_platform: optional(body.primary_platform, 40),
    handle: optional(body.handle, 120),
    primary_niche: optional(body.primary_niche, 40),
    follower_band: optional(body.follower_band, 40),
    city: optional(body.city, 60),
    company,
    website: optional(body.website, 200),
    industry: optional(body.industry, 60),
    budget_band: optional(body.budget_band, 40),
    note,
    source: optional(body.source, 60),
    consent_at: new Date().toISOString(),
    ip_address: ipAddress,
    user_agent: request.headers.get("user-agent") ?? null
  };

  const { error } = await supabase.from("waitlist").insert(row);

  if (error) {
    // 23505 = unique_violation on (lower(email), role). Treat a repeat
    // submission as success so users don't get a scary error for being keen.
    if (error.code === "23505") {
      return NextResponse.json({ ok: true, already: true });
    }
    return NextResponse.json({ error: "Could not save your request. Please try again." }, { status: 500 });
  }

  // Confirmation email is best-effort: a delivery failure must not fail the
  // request (unlike signup, there's no account to roll back here).
  const template = waitlistConfirmationEmail({ fullName: nameCheck.cleaned, role });
  await sendEmail({
    to: email,
    subject: "You're on the Agently early-access list",
    html: template.html,
    text: template.text
  }).catch(() => null);

  return NextResponse.json({ ok: true });
}
