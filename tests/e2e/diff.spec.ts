import { test, expect } from "@playwright/test";

test.describe("Environment Diff", () => {
  test.use({ storageState: "tests/fixtures/auth.json" });

  test.beforeEach(async ({ page }) => {
    await page.goto("/dashboard/diff");
  });

  test("shows diff stats", async ({ page }) => {
    await expect(page.locator("text=Total Compared")).toBeVisible();
    await expect(page.locator("text=Synced")).toBeVisible();
    await expect(page.locator("text=Mismatched")).toBeVisible();
    await expect(page.locator("text=Missing")).toBeVisible();
  });

  test("source/target environment selectors work", async ({ page }) => {
    await page.selectOption('select[aria-label="Source"]', "staging");
    await page.selectOption('select[aria-label="Target"]', "production");
    await expect(page.locator('select[aria-label="Source"]')).toHaveValue("staging");
    await expect(page.locator('select[aria-label="Target"]')).toHaveValue("production");
  });

  test("swap button exchanges environments", async ({ page }) => {
    const sourceBefore = await page.locator('select[aria-label="Source"]').inputValue();
    const targetBefore = await page.locator('select[aria-label="Target"]').inputValue();
    
    await page.click('button[aria-label="Swap environments"]');
    
    await expect(page.locator('select[aria-label="Source"]')).toHaveValue(targetBefore);
    await expect(page.locator('select[aria-label="Target"]')).toHaveValue(sourceBefore);
  });

  test("status filter works", async ({ page }) => {
    await page.selectOption('select:has(option:has-text("All statuses"))', "mismatch");
    const rows = page.locator("tbody tr");
    for (const row of await rows.all()) {
      await expect(row.locator(".badge")).toContainText("Mismatch");
    }
  });

  test("diff table shows source/target values", async ({ page }) => {
    await expect(page.locator("table")).toBeVisible();
    const firstRow = page.locator("tbody tr").first();
    await expect(firstRow.locator("td").nth(1)).toBeVisible(); // Source
    await expect(firstRow.locator("td").nth(2)).toBeVisible(); // Target
    await expect(firstRow.locator(".badge")).toBeVisible(); // Status
  });

  test("bulk sync missing button appears when missing secrets", async ({ page }) => {
    await expect(page.locator('button:has-text("Sync Missing")')).toBeVisible();
  });

  test("bulk fix mismatches button appears when mismatched", async ({ page }) => {
    await expect(page.locator('button:has-text("Fix Mismatches")')).toBeVisible();
  });

  test("sync confirmation dialog opens", async ({ page }) => {
    await page.click('button:has-text("Sync Missing")');
    await expect(page.locator('[role="dialog"]:has-text("Sync Missing Secrets")')).toBeVisible();
    await page.keyboard.press("Escape");
  });
});