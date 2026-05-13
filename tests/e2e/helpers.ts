import { expect, type Page } from "@playwright/test";

export const demoUsers = {
  admin: {
    email: process.env.AGENTLY_ADMIN_EMAIL ?? "admin.demo@agently.co.in",
    password: process.env.AGENTLY_ADMIN_PASSWORD ?? "AgentlyBeta@2026",
    homePath: "/dashboard"
  },
  brand: {
    email: process.env.AGENTLY_BRAND_EMAIL ?? "brand.demo@agently.co.in",
    password: process.env.AGENTLY_BRAND_PASSWORD ?? "AgentlyBeta@2026",
    homePath: "/brand-home"
  },
  creator: {
    email: process.env.AGENTLY_CREATOR_EMAIL ?? "creator.demo@agently.co.in",
    password: process.env.AGENTLY_CREATOR_PASSWORD ?? "AgentlyBeta@2026",
    homePath: "/creator-home"
  },
  freelancer: {
    email: process.env.AGENTLY_FREELANCER_EMAIL ?? "freelancer.demo@agently.co.in",
    password: process.env.AGENTLY_FREELANCER_PASSWORD ?? "AgentlyBeta@2026",
    homePath: "/freelancer-home"
  }
} as const;

export type DemoRole = keyof typeof demoUsers;

export async function loginAs(page: Page, role: DemoRole) {
  const user = demoUsers[role];
  await page.goto("/login");
  await checkNoAppError(page);
  await page.getByPlaceholder("Email").fill(user.email);
  await page.getByPlaceholder("Password").fill(user.password);
  await page.getByRole("button", { name: /continue/i }).click();
  await page.waitForURL((url) => url.pathname === user.homePath || url.pathname === "/intake", { timeout: 20_000 });
  await checkNoAppError(page);
}

export async function checkNoAppError(page: Page) {
  await expect(page.getByText(/runtime error|console error|hydration failed|this won't be patched up/i)).toHaveCount(0);
}

export async function expectPageReady(page: Page, path: string, text: RegExp | string) {
  await page.goto(path);
  await page.waitForLoadState("networkidle");
  await checkNoAppError(page);
  await expect(page.getByText(text).filter({ visible: true }).first()).toBeVisible();
}

export async function clickFirstVisible(page: Page, locatorText: RegExp | string) {
  const target = page.getByText(locatorText).filter({ visible: true }).first();
  await expect(target).toBeVisible();
  await target.click();
  await page.waitForLoadState("networkidle");
  await checkNoAppError(page);
}
