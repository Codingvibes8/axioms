import { test, expect } from "@playwright/test";

test.describe("Landing Page", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
  });

  test("loads successfully with hero and CLI snippet", async ({ page }) => {
    await expect(page.locator("h1")).toContainText("Secrets Management");
    await expect(page.locator("text=Built for AI Agents")).toBeVisible();
    await expect(page.locator('code:has-text("npx axiom init")')).toBeVisible();
  });

  test("Console Preview has 3 animated tabs", async ({ page }) => {
    await expect(page.locator("button:has-text('AI Agent Harness')")).toBeVisible();
    await expect(page.locator("button:has-text('Env Diff Sync')")).toBeVisible();
    await expect(page.locator("button:has-text('Rollback Vault')")).toBeVisible();
  });

  test("copy CLI button works", async ({ page }) => {
    const copyBtn = page.locator('button:has-text("Copy")').first();
    await copyBtn.click();
    await expect(page.locator("text=Copied")).toBeVisible({ timeout: 2000 });
  });

  test("navigation links work", async ({ page }) => {
    await page.click('a:has-text("Features")');
    await expect(page.locator("#features")).toBeInViewport();
  });

  test("pricing cards render", async ({ page }) => {
    await expect(page.locator("text=Developer")).toBeVisible();
    await expect(page.locator("text=Team")).toBeVisible();
    await expect(page.locator("text=Enterprise")).toBeVisible();
  });
});