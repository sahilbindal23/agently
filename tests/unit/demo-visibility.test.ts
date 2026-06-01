import { describe, expect, it } from "vitest";
import { canSeeDemoData, withoutDemoRows } from "@/lib/db/demo-visibility";
import type { CurrentUser } from "@/lib/auth/session";

// Minimal CurrentUser builder. The real type carries more fields, but
// canSeeDemoData only reads role + email.
function user(partial: { role?: string; email?: string | null }): CurrentUser {
  return { role: partial.role ?? "brand", email: partial.email ?? null } as unknown as CurrentUser;
}

describe("canSeeDemoData", () => {
  it("returns false when there is no logged-in user", () => {
    expect(canSeeDemoData(null as unknown as CurrentUser)).toBe(false);
  });

  it("lets admins see everything regardless of email", () => {
    expect(canSeeDemoData(user({ role: "admin", email: "ops@gmail.com" }))).toBe(true);
  });

  // These two are the exact cases that caused the campaign roster to show
  // 0% committed: a demo brand and demo creator were filtered out of each
  // other's view because their own demo rows were hidden.
  it("treats the 'demo'-prefixed agently address as a demo account", () => {
    expect(canSeeDemoData(user({ role: "brand", email: "demobrand@agently.co.in" }))).toBe(true);
  });

  it("treats a '.demo@' agently address as a demo account", () => {
    expect(canSeeDemoData(user({ role: "creator", email: "brand.demo@agently.co.in" }))).toBe(true);
    expect(canSeeDemoData(user({ role: "creator", email: "creator.demo@agently.in" }))).toBe(true);
  });

  it("does NOT treat a real signup as a demo account", () => {
    expect(canSeeDemoData(user({ role: "brand", email: "founder@realbrand.com" }))).toBe(false);
  });

  it("does NOT leak demo data to a non-demo agently address", () => {
    // On the agently domain but neither demo-prefixed nor containing .demo@
    expect(canSeeDemoData(user({ role: "creator", email: "priya@agently.co.in" }))).toBe(false);
  });

  it("is case-insensitive on the email", () => {
    expect(canSeeDemoData(user({ role: "brand", email: "DemoBrand@Agently.co.in" }))).toBe(true);
  });
});

describe("withoutDemoRows", () => {
  const rows = [
    { id: "real", is_demo: false },
    { id: "demo", is_demo: true },
    { id: "unset" }
  ];

  it("keeps every row (including demo) when includeDemo is true", () => {
    expect(withoutDemoRows(rows, true)).toHaveLength(3);
  });

  it("drops only is_demo:true rows when includeDemo is false", () => {
    const filtered = withoutDemoRows(rows, false);
    expect(filtered.map((r) => r.id)).toEqual(["real", "unset"]);
  });
});
