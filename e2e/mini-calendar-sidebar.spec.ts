import { expect, test } from "@playwright/test";

/**
 * E2E tests for the MiniCalendarSidebar component.
 *
 * Uses the `/test/calendar` route with `sidebar=true` to render the sidebar
 * alongside a mock-powered calendar so we can assert on deterministic data.
 */

// Video-on for this file to capture the navigation interactions.
test.use({ video: "on" });

test.describe("MiniCalendarSidebar", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/test/calendar?events=default&view=agenda&sidebar=true");
  });

  test("renders the sidebar with a month header and day grid", async ({
    page,
  }) => {
    await expect(page.getByTestId("mini-calendar-sidebar")).toBeVisible();

    const header = page.getByTestId("mini-calendar-header");
    await expect(header).toBeVisible();
    // Header should contain a month name followed by a 4-digit year
    await expect(header).toHaveText(/\w+ \d{4}/);

    // Seven day-of-week labels (S M T W T F S)
    const dowLabels = page.getByTestId("mini-calendar-dow");
    await expect(dowLabels).toHaveCount(7);
  });

  test("highlights today's date and lists events for it", async ({ page }) => {
    // The default mock event set has events scheduled for today.
    // The sidebar's events list should render them.
    const list = page.getByTestId("mini-calendar-events-list");
    await expect(list).toBeVisible();
    await expect(list.getByText("Morning Standup")).toBeVisible();
    await expect(list.getByText("Team Lunch")).toBeVisible();

    // Today's cell carries data-today="true"
    const todayCell = page
      .getByTestId("mini-calendar-sidebar")
      .locator("[data-today='true']")
      .first();
    await expect(todayCell).toBeVisible();
  });

  test("navigating the mini-calendar view month does not change the main calendar", async ({
    page,
  }) => {
    const mainHeader = page.locator("h2").first();
    const initialMainHeader = await mainHeader.textContent();

    const miniHeader = page.getByTestId("mini-calendar-header");
    const initialMiniHeader = await miniHeader.textContent();

    await page.getByTestId("mini-calendar-next-month").click();

    // Mini-calendar header changes
    await expect(miniHeader).not.toHaveText(initialMiniHeader ?? "");

    // Main calendar header is unchanged — the sidebar is an independent viewer
    await expect(mainHeader).toHaveText(initialMainHeader ?? "");
  });

  test("clicking a different day updates the events list and main calendar state", async ({
    page,
  }) => {
    // Find an in-month day that is NOT today so the click is meaningful.
    const miniGrid = page.getByTestId("mini-calendar-grid");
    const nonTodayInMonth = miniGrid
      .locator("[data-in-month='true'][data-today='false']")
      .first();

    await expect(nonTodayInMonth).toBeVisible();
    const dayTestId = await nonTodayInMonth.getAttribute("data-testid");
    const ariaLabel = await nonTodayInMonth.getAttribute("aria-label");
    expect(dayTestId).toBeTruthy();
    expect(ariaLabel).toBeTruthy();

    await nonTodayInMonth.click();

    // The clicked day should now carry data-selected="true"
    await expect(nonTodayInMonth).toHaveAttribute("data-selected", "true");

    // Events list re-renders with the heading above it reflecting the new day.
    // aria-label is "EEEE, MMMM d, yyyy"; the heading uses "EEE, MMM d".
    const [dayOfWeek, monthDay] = (ariaLabel ?? "").split(", ");
    const expectedHeading = `${dayOfWeek.slice(0, 3)}, ${monthDay
      .split(" ")
      .map((part, idx) => (idx === 0 ? part.slice(0, 3) : part))
      .join(" ")}`;
    await expect(page.getByTestId("mini-calendar-sidebar")).toContainText(
      expectedHeading
    );
    await expect(page.getByTestId("mini-calendar-events-list")).toBeVisible();
  });

  test("shows an empty state when the selected day has no events", async ({
    page,
  }) => {
    await page.goto("/test/calendar?events=empty&view=agenda&sidebar=true");

    const list = page.getByTestId("mini-calendar-events-list");
    await expect(list).toBeVisible();
    await expect(list).toContainText(/no events/i);
  });
});
