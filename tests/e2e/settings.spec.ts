import { test, expect } from "@playwright/test";

test.describe("Settings & KMS", () => {
  test.use({ storageState: "tests/fixtures/auth.json" });

  test.beforeEach(async ({ page }) => {
    await page.goto("/dashboard/settings");
  });

  test("shows tabs", async ({ page }) => {
    await expect(page.locator('[role="tablist"]')).toBeVisible();
    await expect(page.locator('button:has-text("General")')).toBeVisible();
    await expect(page.locator('button:has-text("KMS & Encryption")')).toBeVisible();
    await expect(page.locator('button:has-text("Security")')).toBeVisible();
    await expect(page.locator('button:has-text("Webhooks")')).toBeVisible();
  });

  test("general tab shows project info", async ({ page }) => {
    await expect(page.locator('input[id="project-name"]')).toBeVisible();
    await expect(page.locator('input[id="project-slug"]')).toBeVisible();
    await expect(page.locator('input[id="project-description"]')).toBeVisible();
  });

  test("KMS tab shows master key fingerprint", async ({ page }) => {
    await page.click('button:has-text("KMS & Encryption")');
    await expect(page.locator("text=Current Master Key Fingerprint")).toBeVisible();
    await expect(page.locator("code")).toContainText("SHA256:");
  });

  test("rotate master key dialog", async ({ page }) => {
    await page.click('button:has-text("KMS & Encryption")');
    await page.click('button:has-text("Rotate Master Key")');
    await expect(page.locator('[role="dialog"]:has-text("Rotate Master Key?")')).toBeVisible();
    await page.keyboard.press("Escape");
  });

  test("security tab shows MFA toggle", async ({ page }) => {
    await page.click('button:has-text("Security")');
    await expect(page.locator('label:has-text("Require MFA for Production")')).toBeVisible();
    await expect(page.locator('label:has-text("Agent Proxy Firewall")')).toBeVisible();
  });

  test("audit retention slider", async ({ page }) => {
    await page.click('button:has-text("Security")');
    await expect(page.locator('input[type="number"][min="30"][max="365"]')).toBeVisible();
  });

  test("webhooks tab shows integrations", async ({ page }) => {
    await page.click('button:has-text("Webhooks")');
    await expect(page.locator("text=Slack")).toBeVisible();
    await expect(page.locator("text=Discord")).toBeVisible();
    await expect(page.locator("text=PagerDuty")).toBeVisible();
  });

  test("event subscriptions checkboxes", async ({ page }) => {
    await page.click('button:has-text("Webhooks")');
    await expect(page.locator('input[type="checkbox"][value="SECRET_CREATED"]')).toBeChecked();
  });

  test("infrastructure status cards", async ({ page }) => {
    await page.click('button:has-text("Security")');
    await expect(page.locator("text=Neon PostgreSQL")).toBeVisible();
    await expect(page.locator("text=Redis Cache")).toBeVisible();
    await expect(page.locator("text=Encryption Service")).toBeVisible();
    await expect(page.locator("text=Audit Log Store")).toBeVisible();
  });

  test("danger zone shows reset project", async ({ page }) => {
    await expect(page.locator("text=Danger Zone")).toBeVisible();
    await expect(page.locator('button:has-text("Reset Project")')).toBeVisible();
  });

  test("reset project confirmation", async ({ page }) => {
    await page.click('button:has-text("Reset Project")');
    await expect(page.locator('[role="dialog"]:has-text("Reset Project?")')).toBeVisible();
    await expect(page.locator('input[placeholder*="RESET"]')).toBeVisible();
    await page.keyboard.press("Escape");
  });

  test("save changes button appears when dirty", async ({ page }) => {
    await page.fill('input[id="project-name"]', "New Name");
    await expect(page.locator('button:has-text("Save Changes")')).toBeVisible();
  });
});