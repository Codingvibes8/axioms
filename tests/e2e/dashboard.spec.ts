import { test, expect } from "@playwright/test";

test.describe("Dashboard", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/dashboard");
  });

  test("redirects to sign-in when not authenticated", async ({ page }) => {
    await expect(page).toHaveURL(/sign-in/);
  });

  test.describe("Authenticated (mocked)", () => {
    test.use({ storageState: "tests/fixtures/auth.json" });

    test("shows dashboard overview with stats", async ({ page }) => {
      await expect(page.locator("h1:has-text('Dashboard')")).toBeVisible();
      await expect(page.locator("text=Total Secrets")).toBeVisible();
      await expect(page.locator("text=Active Agents")).toBeVisible();
    });

    test("sidebar navigation works", async ({ page }) => {
      await page.click('a:has-text("Secrets")');
      await expect(page).toHaveURL(/secrets/);
      await expect(page.locator("h1:has-text('Secrets Vault')")).toBeVisible();

      await page.click('a:has-text("Environment Diff")');
      await expect(page).toHaveURL(/diff/);
      await expect(page.locator("h1:has-text('Environment Diff')")).toBeVisible();
    });

    test("command palette opens with ⌘K", async ({ page }) => {
      await page.keyboard.press("Meta+K");
      await expect(page.locator('[role="dialog"]:has-text("Type a command")')).toBeVisible();
      await page.keyboard.press("Escape");
    });

    test("environment switcher in header", async ({ page }) => {
      await expect(page.locator("select")).toBeVisible();
      await page.selectOption("select", "staging");
      await expect(page.locator("select")).toHaveValue("staging");
    });
  });
});