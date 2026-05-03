/**
 * E2E coverage for the agenda toggle inside Day and Week views (issues #150 +
 * #235).
 *
 * Day and Week are split buttons after #235:
 *   - The primary `view-switcher-day` / `view-switcher-week` button switches
 *     view (preserving the global agenda mode).
 *   - A separate caret `view-switcher-day-mode` / `view-switcher-week-mode`
 *     opens the Grid/Agenda menu.
 *
 * Video is captured for the full Day → Day+Agenda → Week+Agenda → Week →
 * Month round-trip so the grid ↔ agenda fade and the new split-button UX
 * can be reviewed as part of the PR.
 */
import { expect, test } from "@playwright/test";

test.use({ video: "on", viewport: { width: 1280, height: 720 } });

test.describe("Agenda toggle inside Day and Week views (#150 + #235)", () => {
  test("Day → Day+Agenda → Week+Agenda → Week → Month round-trip", async ({
    page,
  }) => {
    // Start in Day view (grid).
    await page.goto("/test/calendar?events=default&view=day");
    await expect(page.getByTestId("day-calendar-grid")).toBeVisible();
    await expect(page.getByTestId("agenda-list")).toHaveCount(0);

    // Day → Day+Agenda via the Day caret.
    await page.getByTestId("view-switcher-day-mode").click();
    await page.getByRole("menuitemradio", { name: /agenda/i }).click();

    // The grid is gone, AgendaList is in. Day header is still visible.
    await expect(page.getByTestId("day-calendar-grid")).toHaveCount(0);
    await expect(page.getByTestId("agenda-list")).toBeVisible();
    await expect(page.getByTestId("day-calendar-heading")).toBeVisible();

    // Switching to Week + Agenda from Day+Agenda commits both a view change
    // and keeps agenda mode on via the Week caret's Agenda sub-option.
    await page.getByTestId("view-switcher-week-mode").click();
    await page.getByRole("menuitemradio", { name: /agenda/i }).click();

    // Week range header replaces Day header; AgendaList stays.
    await expect(page.getByTestId("agenda-list")).toBeVisible();
    await expect(page.getByTestId("week-calendar-range")).toBeVisible();

    // Week+Agenda → Week (grid) via the Grid sub-option.
    await page.getByTestId("view-switcher-week-mode").click();
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

  test("primary Day button switches view directly (no menu) — #235", async ({
    page,
  }) => {
    // Start in Month so the primary Day click is a real view change.
    await page.goto("/test/calendar?events=default&view=month");

    // Click the primary Day button — should land in Day grid view, no menu.
    await page.getByTestId("view-switcher-day").click();

    await expect(page.getByTestId("day-calendar-grid")).toBeVisible();
    await expect(page.getByRole("menuitemradio")).toHaveCount(0);
  });

  test("primary Week button preserves agenda mode — #235", async ({ page }) => {
    // Pre-toggle Day+Agenda via the Day caret.
    await page.goto("/test/calendar?events=default&view=day");
    await page.getByTestId("view-switcher-day-mode").click();
    await page.getByRole("menuitemradio", { name: /agenda/i }).click();
    await expect(page.getByTestId("agenda-list")).toBeVisible();

    // Clicking the primary Week button should switch view AND keep agenda
    // mode on (so AgendaList stays rendered, not the week grid).
    await page.getByTestId("view-switcher-week").click();
    await expect(page.getByTestId("agenda-list")).toBeVisible();
    await expect(page.getByTestId("week-calendar-range")).toBeVisible();
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

    // Toggle into agenda mode via the caret — the date must not reset.
    await page.getByTestId("view-switcher-day-mode").click();
    await page.getByRole("menuitemradio", { name: /agenda/i }).click();
    await expect(page.getByTestId("agenda-list")).toBeVisible();

    expect(await heading.textContent()).toBe(navigatedHeading);
  });

  test("primary Day label reflects the current sub-mode", async ({ page }) => {
    await page.goto("/test/calendar?events=default&view=day");
    const dayBtn = page.getByTestId("view-switcher-day");

    // Initially in grid mode — the primary reads just "Day".
    await expect(dayBtn).toHaveText(/^Day$/);

    // Switch to agenda via the caret — primary now shows "Day · Agenda".
    await page.getByTestId("view-switcher-day-mode").click();
    await page.getByRole("menuitemradio", { name: /agenda/i }).click();
    await expect(dayBtn).toHaveText(/Day · Agenda/);
  });

  test("Year click after Week-caret menu dismissal is not intercepted — #235", async ({
    page,
  }) => {
    // Regression: previously the Radix modal overlay blocked subsequent
    // clicks on sibling buttons after the dropdown closed. With
    // `modal={false}` the overlay is gone and Year click should land
    // immediately.
    await page.goto("/test/calendar?events=default&view=month");

    // Open the Week caret menu, then dismiss without picking anything.
    await page.getByTestId("view-switcher-week-mode").click();
    await expect(
      page.getByRole("menuitemradio", { name: /grid/i })
    ).toBeVisible();
    await page.keyboard.press("Escape");

    // Year click must reach the button (no pointer-event interception).
    await page.getByTestId("view-switcher-year").click();
    await expect(page.getByTestId("view-switcher-year")).toHaveAttribute(
      "aria-pressed",
      "true"
    );
  });

  test("Month is unaffected by the agenda mode setting", async ({ page }) => {
    // Pre-toggle agenda mode via the Day caret.
    await page.goto("/test/calendar?events=default&view=day");
    await page.getByTestId("view-switcher-day-mode").click();
    await page.getByRole("menuitemradio", { name: /agenda/i }).click();
    await expect(page.getByTestId("agenda-list")).toBeVisible();

    // Switch to Month — the agenda renderer must be gone, the month grid
    // (Sun…Sat header row) must be back.
    await page.getByTestId("view-switcher-month").click();
    await expect(page.getByTestId("agenda-list")).toHaveCount(0);
    await expect(page.getByText("Sun", { exact: true }).first()).toBeVisible();
  });
});
