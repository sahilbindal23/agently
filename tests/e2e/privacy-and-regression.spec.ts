import { expect, test } from "@playwright/test";
import { checkNoAppError, loginAs } from "./helpers";

test.describe("privacy and regression checks", () => {
  test("public brand profiles do not expose offer or project amounts", async ({ page }) => {
    await loginAs(page, "creator");
    await page.goto("/creator-home");
    await page.waitForLoadState("networkidle");
    await checkNoAppError(page);

    const brandProfileLink = page.locator('a[href^="/brands/"]').first();
    test.skip((await brandProfileLink.count()) === 0, "No brand cards are visible for this test account.");

    await brandProfileLink.click();
    await page.waitForLoadState("networkidle");
    await checkNoAppError(page);

    await expect(page.getByText(/Brand profile|Brand Snapshot/i).first()).toBeVisible();
    await expect(page.getByRole("columnheader", { name: /amount/i })).toHaveCount(0);
    await expect(page.getByText(/₹|INR/i)).toHaveCount(0);
  });

  test("brand activity center does not show duplicate campaign nudges", async ({ page }) => {
    await loginAs(page, "brand");
    await page.goto("/activity");
    await page.waitForLoadState("networkidle");
    await checkNoAppError(page);

    const titles = await page.locator("h3").allTextContents();
    const normalized = titles.map((title) => title.trim()).filter(Boolean);
    const duplicates = normalized.filter((title, index) => normalized.indexOf(title) !== index);
    expect(duplicates, `Duplicate activity rows found: ${duplicates.join(", ")}`).toEqual([]);
  });

  test("profile visibility copy is user-facing, not internal decision logic", async ({ page }) => {
    await loginAs(page, "creator");
    await page.goto("/creator-home");
    await page.waitForLoadState("networkidle");
    await checkNoAppError(page);

    await expect(page.getByText(/Profile visibility/i).first()).toBeVisible();
    await expect(page.getByText(/decision logic|auto-routes|internal rule|automation decision/i)).toHaveCount(0);
  });
});
