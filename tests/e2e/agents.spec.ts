import { test, expect } from "@playwright/test";

test.describe("AI Agent Harness", () => {
  test.use({ storageState: "tests/fixtures/auth.json" });

  test.beforeEach(async ({ page }) => {
    await page.goto("/dashboard/agents");
  });

  test("shows agent stats", async ({ page }) => {
    await expect(page.locator("text=Total Agents")).toBeVisible();
    await expect(page.locator("text=Active")).toBeVisible();
    await expect(page.locator("text=Total Tokens/hr")).toBeVisible();
    await expect(page.locator("text=Sandboxed")).toBeVisible();
  });

  test("agent cards display correctly", async ({ page }) => {
    await expect(page.locator("text=code-review-bot")).toBeVisible();
    await expect(page.locator("text=ci-pipeline-agent")).toBeVisible();
    await expect(page.locator("text=data-extractor")).toBeVisible();
  });

  test("agent status badges show", async ({ page }) => {
    await expect(page.locator(".badge:has-text('Active')")).toHaveCount(2);
    await expect(page.locator(".badge:has-text('Sandboxed')")).toHaveCount(1);
  });

  test("TTL countdown visible", async ({ page }) => {
    await expect(page.locator("text=TTL:")).toBeVisible();
  });

  test("quota bar displays", async ({ page }) => {
    await expect(page.locator('text=Quota:')).toBeVisible();
  });

  test("copy token alias works", async ({ page }) => {
    await page.locator('button[aria-label="Copy token alias"]').first().click();
    await expect(page.locator("text=Copied")).toBeVisible({ timeout: 2000 });
  });

  test("rotate token button exists", async ({ page }) => {
    await expect(page.locator('button[aria-label="Rotate token"]')).toBeVisible();
  });

  test("extend TTL button exists", async ({ page }) => {
    await expect(page.locator('button[aria-label="Extend TTL"]')).toBeVisible();
  });

  test("kill switch in dropdown", async ({ page }) => {
    await page.locator('button[aria-label="More options"]').first().click();
    await expect(page.locator('[role="menuitem"]:has-text("Trigger Kill Switch")')).toBeVisible();
  });

  test("create agent dialog opens", async ({ page }) => {
    await page.click('button:has-text("Create Agent")');
    await expect(page.locator('[role="dialog"]:has-text("Create New Agent Harness")')).toBeVisible();
    await page.keyboard.press("Escape");
  });

  test("live proxy simulator shows terminal output", async ({ page }) => {
    await expect(page.locator("text=STREAMING")).toBeVisible();
    await expect(page.locator(".font-mono")).toBeVisible();
  });
});