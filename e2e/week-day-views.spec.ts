import { expect, test } from "@playwright/test";

// Keep video only when a test fails so CI doesn't accumulate artifacts for
// every green run. Artifacts land under `test-results/` which is gitignored.
test.use({ video: "retain-on-failure" });

test.describe("Week Calendar", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/test/calendar?events=default&view=week");
  });

  test("renders all seven weekday headers", async ({ page }) => {
    for (const label of ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]) {
      await expect(
        page.getByText(label, { exact: true }).first()
      ).toBeVisible();
    }
  });

  test("shows a week range heading", async ({ page }) => {
    const range = page.getByTestId("week-calendar-range");
    await expect(range).toBeVisible();
    await expect(range).toHaveText(/\w+ \d+, \d{4}\s+[–-]\s+\w+ \d+, \d{4}/);
  });

  test("advances one week with the next button", async ({ page }) => {
    const range = page.getByTestId("week-calendar-range");
    const initial = await range.textContent();
    await page.getByTestId("week-calendar-next").click();
    await expect(range).not.toHaveText(initial!);
  });

  test("renders events on the correct day", async ({ page }) => {
    await expect(page.getByText("Morning Standup")).toBeVisible();
    await expect(page.getByText("Client Call")).toBeVisible();
  });

  test("renders all events on a busy day in side-by-side columns", async ({
    page,
  }) => {
    // The time-grid layout positions overlapping events in adjacent
    // sub-columns rather than truncating with "+X more".
    await page.goto("/test/calendar?events=overflow&view=week");
    await expect(page.getByTestId("week-calendar-event").first()).toBeVisible();
    const count = await page.getByTestId("week-calendar-event").count();
    expect(count).toBeGreaterThanOrEqual(5);
  });

  test("renders multi-day events as a single spanning bar", async ({
    page,
  }) => {
    await page.goto("/test/calendar?events=multiDay&view=week");
    const bars = page.getByTestId("week-calendar-multi-day-bar");
    await expect(bars.filter({ hasText: "Family Trip" })).toHaveCount(1);
  });

  test("shows the now-line indicator on today", async ({ page }) => {
    await page.goto("/test/calendar?events=default&view=week");
    await expect(page.getByTestId("week-calendar-now-line")).toBeVisible();
  });
});

test.describe("Day Calendar", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/test/calendar?events=default&view=day");
  });

  test("renders the heading and event count", async ({ page }) => {
    const heading = page.getByTestId("day-calendar-heading");
    await expect(heading).toBeVisible();
    await expect(heading).toHaveText(/\w+, \w+ \d+, \d{4}/);

    const count = page.getByTestId("day-calendar-event-count");
    await expect(count).toHaveText(/\d+ events?/);
  });

  test("navigates to previous and next day", async ({ page }) => {
    const heading = page.getByTestId("day-calendar-heading");
    const initial = await heading.textContent();

    await page.getByTestId("day-calendar-next").click();
    await expect(heading).not.toHaveText(initial!);

    await page.getByTestId("day-calendar-prev").click();
    await expect(heading).toHaveText(initial!);
  });

  test("shows empty state when the day has no events", async ({ page }) => {
    await page.goto("/test/calendar?events=empty&view=day");
    await expect(
      page.getByText("No events scheduled for this day")
    ).toBeVisible();
  });

  test("renders today's events on the day view by default", async ({
    page,
  }) => {
    await expect(page.getByText("Morning Standup")).toBeVisible();
  });

  test("positions a timed event in the time grid", async ({ page }) => {
    await page.goto("/test/calendar?events=default&view=day");
    await expect(page.getByTestId("day-calendar-event").first()).toBeVisible();
  });

  test("shows the now-line on today", async ({ page }) => {
    await page.goto("/test/calendar?events=default&view=day");
    await expect(page.getByTestId("day-calendar-now-line")).toBeVisible();
  });

  test("does not show the now-line on a non-today day", async ({ page }) => {
    await page.goto("/test/calendar?events=default&view=day");
    // Navigate forward 2 days
    await page.getByTestId("day-calendar-next").click();
    await page.getByTestId("day-calendar-next").click();
    await expect(page.getByTestId("day-calendar-now-line")).toHaveCount(0);
  });
});

test.describe("View switcher navigation", () => {
  test("cycles Month → Week → Day → Day+Agenda and back to Month", async ({
    page,
  }) => {
    await page.goto("/test/calendar?events=default&view=month");
    await expect(page.getByText("Sun", { exact: true }).first()).toBeVisible();

    // After #150, Day and Week are dropdown triggers — opening the menu
    // and picking "Grid" lands on the time-grid view.
    await page.getByTestId("view-switcher-week").click();
    await page.getByRole("menuitemradio", { name: /grid/i }).click();
    await expect(page.getByTestId("week-calendar-range")).toBeVisible();

    await page.getByTestId("view-switcher-day").click();
    await page.getByRole("menuitemradio", { name: /grid/i }).click();
    await expect(page.getByTestId("day-calendar-heading")).toBeVisible();

    // Day → Day+Agenda via the dropdown's Agenda sub-option (#150).
    await page.getByTestId("view-switcher-day").click();
    await page.getByRole("menuitemradio", { name: /agenda/i }).click();
    await expect(page.getByTestId("agenda-list")).toBeVisible();

    // Month is a plain button — single click switches view.
    await page.getByTestId("view-switcher-month").click();
    await expect(page.getByText("Sun", { exact: true }).first()).toBeVisible();
  });
});
