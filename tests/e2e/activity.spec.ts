import { test, expect } from "@playwright/test";

test.describe("Activity Audit", () => {
  test.use({ storageState: "tests/fixtures/auth.json" });

  test.beforeEach(async ({ page }) => {
    await page.goto("/dashboard/activity");
  });

  test("shows activity header", async ({ page }) => {
    await expect(page.locator("h1:has-text('Activity Audit')")).toBeVisible();
    await expect(page.locator('button:has-text("Export")')).toBeVisible();
  });

  test("search filters activity", async ({ page }) => {
    await page.fill('input[placeholder*="Search"]', "OPENAI");
    const rows = page.locator("tbody tr");
    for (const row of await rows.all()) {
      await expect(row).toContainText("OPENAI");
    }
  });

  test("action filter works", async ({ page }) => {
    await page.selectOption('select:has(option:has-text("All actions"))', "SECRET_CREATED");
    const rows = page.locator("tbody tr");
    for (const row of await rows.all()) {
      await expect(row.locator(".badge")).toContainText("Created");
    }
  });

  test("environment filter works", async ({ page }) => {
    await page.selectOption('select:has(option:has-text("All environments"))', "production");
    const rows = page.locator("tbody tr");
    for (const row of await rows.all()) {
      await expect(row.locator(".badge:has-text('Production')")).toBeVisible();
    }
  });

  test("table shows time, action, resource, user", async ({ page }) => {
    await expect(page.locator("th:has-text('Time')")).toBeVisible();
    await expect(page.locator("th:has-text('Action')")).toBeVisible();
    await expect(page.locator("th:has-text('Resource')")).toBeVisible();
    await expect(page.locator("th:has-text('Environment')")).toBeVisible();
    await expect(page.locator("th:has-text('User')")).toBeVisible();
  });

  test("expand row shows details", async ({ page }) => {
    const row = page.locator("tbody tr").first();
    await row.locator('button[aria-label]').click();
    await expect(page.locator("text=IP Address")).toBeVisible();
    await expect(page.locator("text=Timestamp")).toBeVisible();
    await expect(page.locator("text=Details")).toBeVisible();
  });

  test("export JSON works", async ({ page }) => {
    const downloadPromise = page.waitForEvent("download");
    await page.click('button:has-text("Export JSON")');
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/axiom-audit-log-\d{4}-\d{2}-\d{2}\.json/);
  });

  test("export CSV works", async ({ page }) => {
    await page.selectOption('select:has(option:has-text("JSON"))', "csv");
    const downloadPromise = page.waitForEvent("download");
    await page.click('button:has-text("Export CSV")');
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/axiom-audit-log-\d{4}-\d{2}-\d{2}\.csv/);
  });

  test("clear filters resets view", async ({ page }) => {
    await page.fill('input[placeholder*="Search"]', "test");
    await page.selectOption('select:has(option:has-text("All actions"))', "SECRET_CREATED");
    await page.click('button:has-text("Clear filters")');
    await expect(page.locator('input[placeholder*="Search"]')).toHaveValue("");
    await expect(page.locator('select:has(option:has-text("All actions"))')).toHaveValue("all");
  });
});