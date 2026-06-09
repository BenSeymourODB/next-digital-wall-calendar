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

  test("switching week start to Monday reorders both calendar grids", async ({
    page,
  }) => {
    const miniDow = page.getByTestId("mini-calendar-dow");
    const mainDow = page.getByTestId("calendar-dow");

    // Default Sunday-first ordering in both grids
    await expect(miniDow.first()).toHaveText("S");
    await expect(mainDow.first()).toHaveText("Sun");

    await page.getByTestId("calendar-settings-trigger").click();
    await page
      .getByTestId("calendar-settings-panel")
      .getByTestId("setting-week-start-day-monday")
      .click();

    // Close the popover so the assertion targets the underlying grids.
    await page.keyboard.press("Escape");

    await expect(miniDow.first()).toHaveText("M");
    await expect(miniDow.nth(6)).toHaveText("S");
    await expect(mainDow.first()).toHaveText("Mon");
    await expect(mainDow.nth(6)).toHaveText("Sun");
  });

  test("week view also honours the Monday-first setting (#205)", async ({
    page,
  }) => {
    // Switch to week view first, capture the Sunday-first header order.
    await page.goto("/test/calendar?events=default&view=week&sidebar=true");
    const range = page.getByTestId("week-calendar-range");
    const initialRange = await range.textContent();
    await expect(page.getByText("Sun", { exact: true }).first()).toBeVisible();

    await page.getByTestId("calendar-settings-trigger").click();
    await page
      .getByTestId("calendar-settings-panel")
      .getByTestId("setting-week-start-day-monday")
      .click();
    await page.keyboard.press("Escape");

    // Range should shift by one day (Sun → Mon … Sat → Sun) and the first
    // weekday column header should now be "Mon".
    await expect(range).not.toHaveText(initialRange!);
    await expect(page.getByText("Mon", { exact: true }).first()).toBeVisible();
  });
});
