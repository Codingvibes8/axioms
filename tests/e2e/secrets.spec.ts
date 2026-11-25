import { test, expect } from "@playwright/test";

test.describe("Secrets Vault", () => {
  test.use({ storageState: "tests/fixtures/auth.json" });

  test.beforeEach(async ({ page }) => {
    await page.goto("/dashboard/secrets");
  });

  test("shows stat cards", async ({ page }) => {
    await expect(page.locator("text=Total Secrets")).toBeVisible();
    await expect(page.locator("text=Production")).toBeVisible();
    await expect(page.locator("text=Staging")).toBeVisible();
    await expect(page.locator("text=Development")).toBeVisible();
  });

  test("search filters secrets", async ({ page }) => {
    await page.fill('input[placeholder*="Search"]', "OPENAI");
    await expect(page.locator('text=OPENAI_API_KEY')).toBeVisible();
    await expect(page.locator('text=DATABASE_URL')).not.toBeVisible();
  });

  test("category filter works", async ({ page }) => {
    await page.selectOption('select:has(option:has-text("All categories"))', "API Key");
    await expect(page.locator('text=OPENAI_API_KEY')).toBeVisible();
  });

  test("environment filter works", async ({ page }) => {
    await page.selectOption('select:has(option:has-text("All environments"))', "production");
    await expect(page.locator('text=OPENAI_API_KEY')).toBeVisible();
  });

  test("table view shows secret details", async ({ page }) => {
    await expect(page.locator("table")).toBeVisible();
    await expect(page.locator("th:has-text('Secret')")).toBeVisible();
    await expect(page.locator("th:has-text('Environment')")).toBeVisible();
    await expect(page.locator("th:has-text('Category')")).toBeVisible();
  });

  test("card view toggle works", async ({ page }) => {
    await page.click('button:has-text("Card View")');
    await expect(page.locator(".grid > .border")).toBeVisible();
    await page.click('button:has-text("Table View")');
    await expect(page.locator("table")).toBeVisible();
  });

  test("reveal/copy value works", async ({ page }) => {
    const row = page.locator("tbody tr").first();
    await row.locator('button[aria-label="Reveal"]').click();
    await expect(row.locator("text=••••••••••••••••")).not.toBeVisible();
    await row.locator('button[aria-label="Copy"]').click();
    await expect(page.locator("text=Copied")).toBeVisible({ timeout: 2000 });
  });

  test("add secret dialog opens", async ({ page }) => {
    await page.click('button:has-text("Add Secret")');
    await expect(page.locator('[role="dialog"]:has-text("Create New Secret")')).toBeVisible();
    await page.keyboard.press("Escape");
  });

  test("export .env button exists", async ({ page }) => {
    await expect(page.locator('button:has-text("Export .env")')).toBeVisible();
  });

  test("bulk import dialog opens", async ({ page }) => {
    await page.click('button:has-text("Bulk Import")');
    await expect(page.locator('[role="dialog"]:has-text("Bulk Import Secrets")')).toBeVisible();
  });
});