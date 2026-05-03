import { expect, test } from "@playwright/test";

/**
 * E2E coverage for the mini-calendar sidebar visibility rule (issue #146).
 *
 * The sidebar is redundant next to the main month grid (two overlapping month
 * views), so it's hidden on month view and visible on day / week / agenda /
 * year. Visibility updates live as the user switches views via the
 * ViewSwitcher — no reload required.
 *
 * The /test/calendar route mirrors the production layout when `sidebar=true`,
 * so these tests exercise the same conditional that ships to users.
 */

// Video-on to capture the live view-switch transition that hides/shows the sidebar.
test.use({ video: "on" });

test.describe("MiniCalendarSidebar layout rule", () => {
  test("is hidden on month view", async ({ page }) => {
    await page.goto("/test/calendar?events=default&view=month&sidebar=true");

    // Wait for the calendar to mount so the hide decision has been applied.
    await expect(page.getByTestId("calendar-display")).toBeVisible();
    await expect(page.getByTestId("mini-calendar-sidebar")).toHaveCount(0);
  });

  test("is visible on agenda view", async ({ page }) => {
    await page.goto("/test/calendar?events=default&view=agenda&sidebar=true");

    await expect(page.getByTestId("calendar-display")).toBeVisible();
    await expect(page.getByTestId("mini-calendar-sidebar")).toBeVisible();
  });

  test("is visible on day view", async ({ page }) => {
    await page.goto("/test/calendar?events=default&view=day&sidebar=true");

    await expect(page.getByTestId("calendar-display")).toBeVisible();
    await expect(page.getByTestId("mini-calendar-sidebar")).toBeVisible();
  });

  test("is visible on week view", async ({ page }) => {
    await page.goto("/test/calendar?events=default&view=week&sidebar=true");

    await expect(page.getByTestId("calendar-display")).toBeVisible();
    await expect(page.getByTestId("mini-calendar-sidebar")).toBeVisible();
  });

  test("toggles live when switching between month and day views (#150)", async ({
    page,
  }) => {
    // Start on month — sidebar hidden.
    await page.goto("/test/calendar?events=default&view=month&sidebar=true");
    await expect(page.getByTestId("calendar-display")).toBeVisible();
    await expect(page.getByTestId("mini-calendar-sidebar")).toHaveCount(0);

    // Switch to Day-agenda via the new dropdown — sidebar appears
    // (sidebar rule keys on view ∈ {day, week}).
    await page.getByTestId("view-switcher-day").click();
    await page.getByRole("menuitemradio", { name: /agenda/i }).click();
    await expect(page.getByTestId("mini-calendar-sidebar")).toBeVisible();

    // Switch back to month — sidebar disappears again.
    await page.getByTestId("view-switcher-month").click();
    await expect(page.getByTestId("mini-calendar-sidebar")).toHaveCount(0);
  });

  test("is not rendered when sidebar param is omitted (independent of view)", async ({
    page,
  }) => {
    // Sanity check: the `sidebar=true` switch still gates opt-in on the
    // test-page layout. Without it, the sidebar never renders regardless of
    // view — confirms the hide-on-month rule only applies when the slot is
    // enabled.
    await page.goto("/test/calendar?events=default&view=agenda");
    await expect(page.getByTestId("calendar-display")).toBeVisible();
    await expect(page.getByTestId("mini-calendar-sidebar")).toHaveCount(0);
  });
});
