import type { CurrentUser } from "@/lib/auth/session";

// Demo data visibility gate.
//
// We mark seeded test rows with is_demo:true so they don't pollute the
// experience for real signups (a brand creating their first campaign
// shouldn't see "Demo Creator" mixed in with real talent).
//
// But demo accounts (the seeded brand/creator/freelancer/admin emails
// used for synthetic testing) need to see demo data — they ARE demo
// data, and their own deals reference other demo entities. Otherwise
// a demo brand sends an offer to a demo creator, the creator accepts
// it, and the brand's campaign roster shows 0% committed because both
// the brand row and the creator row were filtered out of view.
//
// Admins always see everything. Demo emails (anything in the
// agently.in / agently.co.in test domains that starts with "demo" or
// contains ".demo@") also see everything. Real users see only
// non-demo rows.
export function canSeeDemoData(user: CurrentUser) {
  if (!user) return false;
  if (user.role === "admin") return true;
  return isAgentlyDemoEmail(user.email ?? "");
}

function isAgentlyDemoEmail(email: string) {
  const lower = email.toLowerCase();
  const onAgentlyDomain = lower.endsWith("@agently.in") || lower.endsWith("@agently.co.in");
  if (!onAgentlyDomain) return false;
  return lower.startsWith("demo") || lower.includes(".demo@");
}

export function withoutDemoRows<T extends { is_demo?: boolean | null }>(rows: T[], includeDemo: boolean) {
  return includeDemo ? rows : rows.filter((row) => !row.is_demo);
}
