import { expect, test } from "@playwright/test";

test.describe("Theme Toggle (/test/settings)", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/test/settings");
  });

  test.describe("Theme Radio Buttons", () => {
    test("shows light, dark, and system options", async ({ page }) => {
      await expect(page.getByRole("radio", { name: "light" })).toBeVisible();
      await expect(page.getByRole("radio", { name: "dark" })).toBeVisible();
      await expect(page.getByRole("radio", { name: "system" })).toBeVisible();
    });

    test("light is selected by default", async ({ page }) => {
      await expect(page.getByRole("radio", { name: "light" })).toBeChecked();
    });

    test("selecting dark theme adds .dark class to html element", async ({
      page,
    }) => {
      // Mock the settings API
      await page.route("**/api/settings", (route) =>
        route.fulfill({ status: 200, body: "{}" })
      );

      await page.getByRole("radio", { name: "dark" }).click();

      // next-themes applies the .dark class to the html element
      await expect(page.locator("html")).toHaveClass(/dark/);
    });

    test("selecting light theme removes .dark class from html element", async ({
      page,
    }) => {
      await page.route("**/api/settings", (route) =>
        route.fulfill({ status: 200, body: "{}" })
      );

      // Switch to dark first
      await page.getByRole("radio", { name: "dark" }).click();
      await expect(page.locator("html")).toHaveClass(/dark/);

      // Switch back to light
      await page.getByRole("radio", { name: "light" }).click();
      await expect(page.locator("html")).not.toHaveClass(/dark/);
    });

    test("dark mode changes page background color", async ({ page }) => {
      await page.route("**/api/settings", (route) =>
        route.fulfill({ status: 200, body: "{}" })
      );

      // Get initial background color
      const lightBg = await page.evaluate(
        () => getComputedStyle(document.body).backgroundColor
      );

      // Switch to dark
      await page.getByRole("radio", { name: "dark" }).click();
      await page.waitForTimeout(100); // Wait for theme transition

      const darkBg = await page.evaluate(
        () => getComputedStyle(document.body).backgroundColor
      );

      // Background should be different in dark mode
      expect(lightBg).not.toBe(darkBg);
    });
  });

  test.describe("Theme Persistence", () => {
    test("theme selection persists across page reload", async ({ page }) => {
      await page.route("**/api/settings", (route) =>
        route.fulfill({ status: 200, body: "{}" })
      );

      // Switch to dark
      await page.getByRole("radio", { name: "dark" }).click();
      await expect(page.locator("html")).toHaveClass(/dark/);

      // Reload page
      await page.reload();

      // Theme should persist (next-themes uses localStorage)
      await expect(page.locator("html")).toHaveClass(/dark/);
    });
  });

  test.describe("Accessibility", () => {
    test("theme radio buttons are keyboard navigable", async ({ page }) => {
      const lightRadio = page.getByRole("radio", { name: "light" });
      await lightRadio.focus();

      // Tab through radio options
      await page.keyboard.press("ArrowRight");
      await expect(page.getByRole("radio", { name: "dark" })).toBeFocused();
    });

    test("theme radio group has proper fieldset structure", async ({
      page,
    }) => {
      // Check fieldset/legend pattern for accessibility
      await expect(
        page.locator("legend").filter({ hasText: "Theme" })
      ).toBeVisible();
    });
  });
});
