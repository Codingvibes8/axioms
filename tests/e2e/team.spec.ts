import { test, expect } from "@playwright/test";

test.describe("Team & RBAC", () => {
  test.use({ storageState: "tests/fixtures/auth.json" });

  test.beforeEach(async ({ page }) => {
    await page.goto("/dashboard/team");
  });

  test("shows team stats", async ({ page }) => {
    await expect(page.locator("text=Total Members")).toBeVisible();
    await expect(page.locator("text=Owners")).toBeVisible();
    await expect(page.locator("text=Service Accounts")).toBeVisible();
  });

  test("member table displays", async ({ page }) => {
    await expect(page.locator("table")).toBeVisible();
    await expect(page.locator("th:has-text('Member')")).toBeVisible();
    await expect(page.locator("th:has-text('Role')")).toBeVisible();
    await expect(page.locator("th:has-text('Environments')")).toBeVisible();
  });

  test("role selector updates inline", async ({ page }) => {
    const row = page.locator("tbody tr").first();
    await row.locator("select").selectOption("admin");
    await expect(row.locator("select")).toHaveValue("admin");
  });

  test("cannot demote last owner", async ({ page }) => {
    const ownerRow = page.locator("tbody tr").filter({ hasText: "Owner" });
    await ownerRow.locator("select").selectOption("developer");
    await expect(page.locator('[role="dialog"]:has-text("Change Role?")')).toBeVisible();
    await page.keyboard.press("Escape");
  });

  test("remove member button exists", async ({ page }) => {
    const row = page.locator("tbody tr").first();
    await expect(row.locator('button[aria-label="Remove member"]')).toBeVisible();
  });

  test("cannot remove self", async ({ page }) => {
    const selfRow = page.locator("tbody tr").filter({ hasText: "(You)" });
    await expect(selfRow.locator('button[aria-label="Remove member"]')).not.toBeVisible();
  });

  test("invite member dialog", async ({ page }) => {
    await page.click('button:has-text("Invite Member")');
    await expect(page.locator('[role="dialog"]:has-text("Invite Team Member")')).toBeVisible();
    await page.keyboard.press("Escape");
  });

  test("service accounts section shows", async ({ page }) => {
    await expect(page.locator("text=Service Accounts")).toBeVisible();
    await expect(page.locator("text=GitHub Actions")).toBeVisible();
  });

  test("create service account dialog", async ({ page }) => {
    await page.click('button:has-text("Create Service Account")');
    await expect(page.locator('[role="dialog"]:has-text("Create Service Account")')).toBeVisible();
    await page.keyboard.press("Escape");
  });

  test("permission matrix renders", async ({ page }) => {
    await expect(page.locator("text=Permission Matrix")).toBeVisible();
    await expect(page.locator("th:has-text('Permission')")).toBeVisible();
    await expect(page.locator("th:has-text('Owner')")).toBeVisible();
    await expect(page.locator("th:has-text('Admin')")).toBeVisible();
  });
});