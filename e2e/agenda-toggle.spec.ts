/**
 * E2E coverage for the agenda toggle inside Day and Week views (issue #150).
 *
 * Video is captured for the full Day → Day+Agenda → Week+Agenda → Week →
 * Month round-trip so the grid ↔ agenda fade and the dropdown UX can be
 * reviewed as part of the PR. Animation behavior is shared with #87 — the
 * composite swap key (`day:agenda` / `week:agenda`) drives the same
 * AnimatedSwap wrapper as a primary-view change.
 */
import { expect, test } from "@playwright/test";

test.use({ video: "on", viewport: { width: 1280, height: 720 } });

test.describe("Agenda toggle inside Day and Week views (#150)", () => {
  test("Day → Day+Agenda → Week+Agenda → Week → Month round-trip", async ({
    page,
  }) => {
    // Start in Day view (grid). The Day dropdown trigger reflects "Day".
    await page.goto("/test/calendar?events=default&view=day");
    await expect(page.getByTestId("day-calendar-grid")).toBeVisible();
    await expect(page.getByTestId("agenda-list")).toHaveCount(0);

    // Day → Day+Agenda via the Day dropdown.
    await page.getByTestId("view-switcher-day").click();
    await page.getByRole("menuitemradio", { name: /agenda/i }).click();

    // The grid is gone, AgendaList is in. Day header is still visible.
    await expect(page.getByTestId("day-calendar-grid")).toHaveCount(0);
    await expect(page.getByTestId("agenda-list")).toBeVisible();
    await expect(page.getByTestId("day-calendar-heading")).toBeVisible();

    // Switching to Week + Agenda from Day+Agenda should commit both a
    // view change and keep agenda mode on. The Week trigger is also a
    // dropdown — Agenda sub-option drives the transition.
    await page.getByTestId("view-switcher-week").click();
    await page.getByRole("menuitemradio", { name: /agenda/i }).click();

    // Week range header replaces Day header; AgendaList stays.
    await expect(page.getByTestId("agenda-list")).toBeVisible();
    await expect(page.getByTestId("week-calendar-range")).toBeVisible();

    // Week+Agenda → Week (grid) via the Grid sub-option.
    await page.getByTestId("view-switcher-week").click();
    await page.getByRole("menuitemradio", { name: /grid/i }).click();

    // Week time-grid is back, AgendaList is gone.
    await expect(page.getByTestId("agenda-list")).toHaveCount(0);
    await expect(page.getByRole("grid", { name: /week of/i })).toBeVisible();

    // Week → Month via the plain Month button.
    await page.getByTestId("view-switcher-month").click();
    await expect(page.getByTestId("calendar-display")).toBeVisible();
    // Month grid renders the weekday-header row "Sun…Sat".
    await expect(page.getByText("Sun", { exact: true }).first()).toBeVisible();
  });

  test("agenda mode preserves the selected date when toggled", async ({
    page,
  }) => {
    await page.goto("/test/calendar?events=default&view=day");
    const heading = page.getByTestId("day-calendar-heading");
    const startingHeading = await heading.textContent();

    // Navigate forward two days in the grid.
    await page.getByTestId("day-calendar-next").click();
    await page.getByTestId("day-calendar-next").click();
    const navigatedHeading = await heading.textContent();
    expect(navigatedHeading).not.toBe(startingHeading);

    // Toggle into agenda mode — the date must not reset.
    await page.getByTestId("view-switcher-day").click();
    await page.getByRole("menuitemradio", { name: /agenda/i }).click();
    await expect(page.getByTestId("agenda-list")).toBeVisible();

    expect(await heading.textContent()).toBe(navigatedHeading);
  });

  test("Day dropdown shows the current sub-mode in its label", async ({
    page,
  }) => {
    await page.goto("/test/calendar?events=default&view=day");
    const dayBtn = page.getByTestId("view-switcher-day");

    // Initially in grid mode — the trigger reads just "Day".
    await expect(dayBtn).toHaveText(/^Day$/);

    // Switch to agenda — trigger now shows "Day · Agenda".
    await dayBtn.click();
    await page.getByRole("menuitemradio", { name: /agenda/i }).click();
    await expect(dayBtn).toHaveText(/Day · Agenda/);
  });

  test("Month is unaffected by the agenda mode setting", async ({ page }) => {
    // Pre-toggle agenda mode via the Day dropdown.
    await page.goto("/test/calendar?events=default&view=day");
    await page.getByTestId("view-switcher-day").click();
    await page.getByRole("menuitemradio", { name: /agenda/i }).click();
    await expect(page.getByTestId("agenda-list")).toBeVisible();

    // Switch to Month — the agenda renderer must be gone, the month grid
    // (Sun…Sat header row) must be back.
    await page.getByTestId("view-switcher-month").click();
    await expect(page.getByTestId("agenda-list")).toHaveCount(0);
    await expect(page.getByText("Sun", { exact: true }).first()).toBeVisible();
  });
});
