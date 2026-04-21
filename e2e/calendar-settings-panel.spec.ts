import { expect, test } from "@playwright/test";

/**
 * E2E tests for the CalendarSettingsPanel (#86).
 *
 * Uses the `/test/calendar` route with `sidebar=true` so we can verify
 * the settings popover is wired up and that toggling the week-start-day
 * setting actually reorders the mini calendar's day-of-week headers.
 *
 * localStorage persistence is covered by the CalendarProvider unit tests;
 * this file focuses on the user-visible UI flow.
 */

test.describe("CalendarSettingsPanel", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/test/calendar?events=default&view=month&sidebar=true");
  });

  test("opens the settings panel from the gear trigger and exposes all four controls", async ({
    page,
  }) => {
    await page.getByTestId("calendar-settings-trigger").click();

    const panel = page.getByTestId("calendar-settings-panel");
    await expect(panel).toBeVisible();

    await expect(panel.getByTestId("setting-badge-style")).toBeVisible();
    await expect(panel.getByTestId("setting-24hour")).toBeVisible();
    await expect(panel.getByTestId("setting-agenda-group-by")).toBeVisible();
    await expect(panel.getByTestId("setting-week-start-day")).toBeVisible();
  });

  test("switching week start to Monday reorders the mini-calendar day headers", async ({
    page,
  }) => {
    const dowLabels = page.getByTestId("mini-calendar-dow");

    // Default Sunday-first ordering
    await expect(dowLabels.first()).toHaveText("S");

    await page.getByTestId("calendar-settings-trigger").click();
    await page
      .getByTestId("calendar-settings-panel")
      .getByTestId("setting-week-start-day-monday")
      .click();

    // Close the popover so the assertion targets the underlying grid.
    await page.keyboard.press("Escape");

    await expect(dowLabels.first()).toHaveText("M");
    await expect(dowLabels.nth(6)).toHaveText("S");
  });
});
