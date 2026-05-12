import type { CurrentUser } from "@/lib/auth/session";

export function canSeeDemoData(user: CurrentUser) {
  return user?.role === "admin";
}

export function withoutDemoRows<T extends { is_demo?: boolean | null }>(rows: T[], includeDemo: boolean) {
  return includeDemo ? rows : rows.filter((row) => !row.is_demo);
}
