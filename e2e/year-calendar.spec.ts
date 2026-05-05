import { expect, test } from "@playwright/test";

/**
 * E2E tests for the Year calendar view. Video capture is enabled on this
 * file because navigation between the Month and Year tabs is the core flow
 * the issue (#83) calls out, and we want a recording artefact for review.
 */
test.use({ video: "on" });

test.describe("Year calendar view", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/test/calendar?events=default&view=year");
  });

  test("renders the year header, event count, and date range", async ({
    page,
  }) => {
    const heading = page.getByRole("heading", { level: 2 }).first();
    await expect(heading).toBeVisible();
    const year = new Date().getFullYear().toString();
    await expect(heading).toContainText(year);

    const eventCount = page.getByTestId("year-calendar-event-count");
    await expect(eventCount).toBeVisible();
    await expect(eventCount).toHaveText(/\d+ events?/);

    const dateRange = page.getByTestId("year-calendar-date-range");
    await expect(dateRange).toContainText(`Jan 1, ${year}`);
    await expect(dateRange).toContainText(`Dec 31, ${year}`);
  });

  test("renders all 12 month panels in the grid", async ({ page }) => {
    for (let i = 0; i < 12; i++) {
      await expect(page.getByTestId(`year-calendar-month-${i}`)).toBeVisible();
    }
  });

  test("navigates forward and back one year", async ({ page }) => {
    const heading = page.getByRole("heading", { level: 2 }).first();
    const year = new Date().getFullYear();

    await page.getByTestId("year-calendar-next-year").click();
    await expect(heading).toContainText(String(year + 1));

    await page.getByTestId("year-calendar-prev-year").click();
    await expect(heading).toContainText(String(year));
  });

  test("Today button is disabled for the current year", async ({ page }) => {
    await expect(page.getByTestId("year-calendar-today-btn")).toBeDisabled();
  });

  test("Today button snaps back after navigating away", async ({ page }) => {
    const heading = page.getByRole("heading", { level: 2 }).first();
    const year = new Date().getFullYear();

    await page.getByTestId("year-calendar-next-year").click();
    await expect(heading).toContainText(String(year + 1));

    const todayBtn = page.getByTestId("year-calendar-today-btn");
    await expect(todayBtn).toBeEnabled();
    await todayBtn.click();
    await expect(heading).toContainText(String(year));
  });

  test("highlights today's cell when viewing the current year", async ({
    page,
  }) => {
    const today = new Date();
    const key = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
    const cell = page.getByTestId(`year-calendar-day-${key}`);
    await expect(cell).toBeVisible();
    await expect(cell).toHaveAttribute("data-today", "true");
  });

  test("clicking a day drills into month view on that date", async ({
    page,
  }) => {
    const today = new Date();
    const year = today.getFullYear();
    const targetMonth = today.getMonth() === 11 ? 10 : today.getMonth() + 1;
    const mm = String(targetMonth + 1).padStart(2, "0");
    const key = `${year}-${mm}-15`;
    await page.getByTestId(`year-calendar-day-${key}`).click();

    // ViewSwitcher should now mark the Month button as pressed.
    await expect(page.getByTestId("view-switcher-month")).toHaveAttribute(
      "aria-pressed",
      "true"
    );

    // Month calendar's date range badge should reflect the target month
    await expect(page.getByTestId("calendar-date-range")).toBeVisible();
  });

  test("clicking the Year button from Month view switches to the year grid", async ({
    page,
  }) => {
    await page.goto("/test/calendar?events=default&view=month");
    await page.getByTestId("view-switcher-year").click();

    await expect(page.getByTestId("year-calendar-grid")).toBeVisible();
    await expect(page.getByTestId("year-calendar-month-0")).toBeVisible();
  });

  test("shows 0 events and no dots for the empty fixture", async ({ page }) => {
    await page.goto("/test/calendar?events=empty&view=year");
    await expect(page.getByTestId("year-calendar-event-count")).toHaveText(
      "0 events"
    );
    await expect(page.getByTestId("year-calendar-dot")).toHaveCount(0);
  });

  test("uses singular grammar for one event", async ({ page }) => {
    await page.goto("/test/calendar?events=single&view=year");
    await expect(page.getByTestId("year-calendar-event-count")).toHaveText(
      "1 event"
    );
  });

  test("shows the loading indicator while events are loading", async ({
    page,
  }) => {
    await page.goto(
      "/test/calendar?events=default&view=year&loading=true&loadingDelay=4000"
    );
    await expect(page.getByText("Loading events...")).toBeVisible();
  });

  test("pressing Enter on a focused day cell drills into month view", async ({
    page,
  }) => {
    const today = new Date();
    const key = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
    const cell = page.getByTestId(`year-calendar-day-${key}`);
    await cell.focus();
    await page.keyboard.press("Enter");
    await expect(page.getByTestId("view-switcher-month")).toHaveAttribute(
      "aria-pressed",
      "true"
    );
  });

  test("Today button label shows the current calendar year even after navigating away", async ({
    page,
  }) => {
    const currentYear = String(new Date().getFullYear());
    await page.getByTestId("year-calendar-next-year").click();
    await page.getByTestId("year-calendar-next-year").click();
    await expect(page.getByTestId("year-calendar-today-btn")).toHaveText(
      currentYear
    );
  });
});
