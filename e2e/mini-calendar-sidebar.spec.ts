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

    // #279 acceptance criterion: the *main* view follows the sidebar click.
    // The sidebar cell's aria-label is the same `EEEE, MMMM d, yyyy` string
    // DayCalendar uses for its heading, so we can compare them directly.
    await expect(page.getByTestId("day-calendar-heading")).toHaveText(
      ariaLabel ?? ""
    );
  });

  test("clicking an in-month day in a chevron-advanced month moves the main view to that day (#279)", async ({
    page,
  }) => {
    // Advance the sidebar's local viewMonth two months ahead via the chevron,
    // waiting for the header to flip after each click so the grid is fully
    // re-rendered before the next interaction. This decouples viewMonth from
    // selectedDate, so the next in-month click forces a *cross-month*
    // selectedDate update — the regression coverage the prior spec lacked.
    const miniHeader = page.getByTestId("mini-calendar-header");
    const initialHeader = await miniHeader.textContent();
    await page.getByTestId("mini-calendar-next-month").click();
    await expect(miniHeader).not.toHaveText(initialHeader ?? "");
    const oneAheadHeader = await miniHeader.textContent();
    await page.getByTestId("mini-calendar-next-month").click();
    await expect(miniHeader).not.toHaveText(oneAheadHeader ?? "");

    const advancedHeader = await miniHeader.textContent();
    expect(advancedHeader).toBeTruthy();

    // Pick the first in-month cell in the advanced view. The first row is
    // either entirely in-month (when the month starts on the configured
    // week-start day) or contains leading padding from the previous month;
    // either way the *first* `data-in-month='true'` cell is a valid target
    // that is guaranteed to be in a month different from today's. Capture
    // the cell's stable `data-testid` (date-based, see MiniCalendarSidebar
    // line 194) so post-click assertions don't ride a positional locator
    // through a React re-render.
    const miniGrid = page.getByTestId("mini-calendar-grid");
    const advancedInMonth = miniGrid.locator("[data-in-month='true']").first();
    const ariaLabel = await advancedInMonth.getAttribute("aria-label");
    const cellTestId = await advancedInMonth.getAttribute("data-testid");
    expect(ariaLabel).toBeTruthy();
    expect(cellTestId).toBeTruthy();

    await advancedInMonth.click();

    // Re-anchor to the stable date-based test-id rather than the original
    // positional locator — handleDayClick triggers a React re-render and a
    // first-child locator could resolve to a different cell after that.
    const clickedCell = miniGrid.locator(`[data-testid="${cellTestId}"]`);
    await expect(clickedCell).toHaveAttribute("data-selected", "true");
    await expect(clickedCell).toHaveAttribute("data-in-month", "true");

    // The main view's DayCalendar heading now matches the cell's aria-label
    // (both use `format(selectedDate, "EEEE, MMMM d, yyyy")`).
    await expect(page.getByTestId("day-calendar-heading")).toHaveText(
      ariaLabel ?? ""
    );

    // The sidebar header stays parked on the advanced month: clicking an
    // in-month cell calls setSelectedDate only. The auto-sync block
    // (MiniCalendarSidebar lines 84-91) then computes
    // startOfMonth(newSelectedDate) === viewMonth, so its setViewMonth call
    // is a no-op and the header text stays put.
    await expect(miniHeader).toHaveText(advancedHeader ?? "");
  });

  test("clicking a padding cell pulls both the main view and the sidebar onto the new month (#202 / #279)", async ({
    page,
  }) => {
    // To guarantee at least one `data-in-month='false'` padding cell exists
    // regardless of where today lands in the week, advance the sidebar's
    // viewMonth a few months forward until we find one. Three months is
    // always enough: at least one of any four consecutive months
    // (current + 3) has its first-of-month land on a non-Sunday with
    // weekStartDay=0, producing leading padding cells. After each chevron
    // click we wait for the header text to change so the grid is fully
    // re-rendered before we re-query for padding cells — Playwright
    // auto-waits on `.click()` actionability but not on the resulting
    // React state update.
    const miniGrid = page.getByTestId("mini-calendar-grid");
    const miniHeader = page.getByTestId("mini-calendar-header");
    let paddingCell = miniGrid.locator("[data-in-month='false']").first();
    for (let i = 0; i < 3 && (await paddingCell.count()) === 0; i++) {
      const headerBeforeAdvance = await miniHeader.textContent();
      await page.getByTestId("mini-calendar-next-month").click();
      await expect(miniHeader).not.toHaveText(headerBeforeAdvance ?? "");
      paddingCell = miniGrid.locator("[data-in-month='false']").first();
    }
    await expect(paddingCell).toBeVisible();

    const paddingAriaLabel = await paddingCell.getAttribute("aria-label");
    const paddingTestId = await paddingCell.getAttribute("data-testid");
    expect(paddingAriaLabel).toBeTruthy();
    expect(paddingTestId).toBeTruthy();

    // Header before the click — we expect it to *change* to the clicked
    // cell's month when handleDayClick runs its second arm
    // (setViewMonth(startOfMonth(day))).
    const headerBefore = await page
      .getByTestId("mini-calendar-header")
      .textContent();

    await paddingCell.click();

    // After the click the *same* date cell now reads in-month, because
    // viewMonth has been pulled to the clicked cell's month. This is the
    // exact behaviour #202 added; without it the highlight would scroll
    // off-grid.
    const sameCellById = miniGrid.locator(`[data-testid="${paddingTestId}"]`);
    await expect(sameCellById).toHaveAttribute("data-in-month", "true");
    await expect(sameCellById).toHaveAttribute("data-selected", "true");

    // Sidebar header advanced to the new month.
    await expect(page.getByTestId("mini-calendar-header")).not.toHaveText(
      headerBefore ?? ""
    );

    // Main view's DayCalendar heading reflects the clicked day, using the
    // same `EEEE, MMMM d, yyyy` formatting as the cell's aria-label.
    await expect(page.getByTestId("day-calendar-heading")).toHaveText(
      paddingAriaLabel ?? ""
    );
  });

  test("shows an empty state when the selected day has no events", async ({
    page,
  }) => {
    await page.goto("/test/calendar?events=empty&view=agenda&sidebar=true");

    const list = page.getByTestId("mini-calendar-events-list");
    await expect(list).toBeVisible();
    await expect(list).toContainText(/no events/i);
  });

  test("renders multiple distinct color dots on busy days (max 3)", async ({
    page,
  }) => {
    // The `overflow` mock set puts 10 events on today, cycling through
    // blue/green/red/yellow/purple/orange — at least 6 distinct colors.
    // Use an agenda view: the mini-calendar sidebar is intentionally hidden in
    // month view (it would duplicate the main grid — #146/#214).
    await page.goto("/test/calendar?events=overflow&view=agenda&sidebar=true");

    const todayCell = page
      .getByTestId("mini-calendar-sidebar")
      .locator("[data-today='true']")
      .first();
    await expect(todayCell).toBeVisible();

    // Multi-color cluster appears under the day number; cap is 3.
    const dots = todayCell.getByTestId("mini-calendar-event-dot");
    await expect(dots).toHaveCount(3);
  });

  test("auto-advances the mini-calendar when external navigation jumps months", async ({
    page,
  }) => {
    // The test page exposes a "Next Month" button that calls
    // setSelectedDate(nextMonth) on CalendarProvider — i.e. external
    // navigation. The sidebar should follow so the highlight stays visible.
    const miniHeader = page.getByTestId("mini-calendar-header");
    const initialMiniHeader = await miniHeader.textContent();

    await page.getByTestId("go-next-month").click();

    // Sidebar header advances along with the external selectedDate change.
    await expect(miniHeader).not.toHaveText(initialMiniHeader ?? "");
    // The newly selected day should now be in-month and selected.
    const selectedCell = page
      .getByTestId("mini-calendar-sidebar")
      .locator("[data-selected='true']")
      .first();
    await expect(selectedCell).toBeVisible();
    await expect(selectedCell).toHaveAttribute("data-in-month", "true");
  });
});
