import { expect, test } from "@playwright/test";
import { checkNoAppError, expectPageReady, loginAs } from "./helpers";

test.describe("synthetic tester agents", () => {
  test("logged-out visitor can reach homepage, login, and signup", async ({ page }) => {
    await expectPageReady(page, "/", /Agently|creator|brand|freelancer/i);
    await expect(page.getByRole("link", { name: /create account|start intake|login|sign in/i }).first()).toBeVisible();
    await expectPageReady(page, "/login", /sign in/i);
    await expectPageReady(page, "/signup", /create account|sign up|intake/i);
  });

  test("brand can inspect discovery, campaigns, offers, messages, activity, and insights", async ({ page }) => {
    await loginAs(page, "brand");
    await expect(page.getByText(/campaign workspace|marketplace talent/i).first()).toBeVisible();
    await expect(page.getByText(/Marketplace Talent/i)).toBeVisible();

    await expectPageReady(page, "/campaigns", /Campaigns|Campaign brief engine/i);
    await expect(page.getByText(/Recommended Creators|Recent Campaigns|Create Campaign Brief/i).first()).toBeVisible();

    const firstCampaign = page.locator('a[href^="/campaigns/"]').first();
    if (await firstCampaign.count()) {
      await firstCampaign.click();
      await page.waitForLoadState("networkidle");
      await checkNoAppError(page);
      await expect(page.getByText(/Projected Performance Signals|Recommended Creators|Shortlist/i).first()).toBeVisible();
    }

    await expectPageReady(page, "/deals", /Sent offers and projects|Creator Offers Sent/i);
    await expectPageReady(page, "/messages", /Campaign conversations|Inbox/i);
    await expectPageReady(page, "/activity", /Activity Center|Operating center/i);
    await expectPageReady(page, "/brand-insights", /Campaign Insights|Projected ROI Signals/i);
  });

  test("creator can review marketplace, offers, AI tools, payments, and own profile without self-message", async ({ page }) => {
    await loginAs(page, "creator");
    await expect(page.getByText(/Creator home|Marketplace Network|Welcome/i).first()).toBeVisible();

    const fullProfileLink = page.getByRole("link", { name: /view full profile/i }).first();
    await expect(fullProfileLink).toBeVisible();
    await fullProfileLink.click();
    await page.waitForLoadState("networkidle");
    await checkNoAppError(page);
    await expect(page.getByText(/Creator profile|Talent Snapshot/i).first()).toBeVisible();
    await expect(page.getByRole("button", { name: /message creator/i })).toHaveCount(0);

    await expectPageReady(page, "/offers", /Offers|Talent offer inbox/i);
    await expect(page.getByText(/Negotiate this offer|No offers yet|Offer workflow/i).first()).toBeVisible();
    await expectPageReady(page, "/ai-insights", /Sponsor Growth Calculator|AI Insights|Negotiation/i);
    await expectPageReady(page, "/payments", /Payments|payment/i);
  });

  test("freelancer can review service profile, offers, messages, and payments", async ({ page }) => {
    await loginAs(page, "freelancer");
    await expect(page.getByText(/Freelancer home|Marketplace Network|Production talent/i).first()).toBeVisible();

    await expectPageReady(page, "/offers", /Offers|Talent offer inbox/i);
    await expect(page.getByText(/Negotiate this project|No offers yet|Offer workflow/i).first()).toBeVisible();
    await expectPageReady(page, "/messages", /Campaign conversations|Inbox/i);
    await expectPageReady(page, "/activity", /Activity Center|Operating center/i);
    await expectPageReady(page, "/payments", /Payments|payment/i);
  });

  test("admin can reach operating views", async ({ page }) => {
    await loginAs(page, "admin");
    await expect(page.getByText(/Dashboard|pipeline/i).first()).toBeVisible();
    await expectPageReady(page, "/activity", /Activity Center|Operating center/i);
    await expectPageReady(page, "/contracts", /Contracts|contract/i);
    await expectPageReady(page, "/payments", /Payments|payment/i);
  });
});
