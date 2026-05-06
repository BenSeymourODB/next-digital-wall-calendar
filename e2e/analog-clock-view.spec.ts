import { expect, test } from "@playwright/test";

test.describe("AnalogClockView (calendar page wiring)", () => {
  test("renders the analog clock when ?view=clock", async ({ page }) => {
    await page.goto("/test/calendar?events=default&view=clock");

    await expect(page.getByTestId("analog-clock-view")).toBeVisible();
    await expect(page.getByTestId("analog-clock")).toBeVisible();
  });

  test("Clock button in ViewSwitcher is highlighted when active", async ({
    page,
  }) => {
    await page.goto("/test/calendar?events=default&view=clock");

    const clockBtn = page.getByTestId("view-switcher-clock");
    await expect(clockBtn).toHaveAttribute("aria-pressed", "true");
  });

  test("switches into clock view from month via the Clock button", async ({
    page,
  }) => {
    await page.goto("/test/calendar?events=default&view=month");

    await expect(page.getByTestId("analog-clock-view")).toHaveCount(0);

    await page.getByTestId("view-switcher-clock").click();

    await expect(page.getByTestId("analog-clock-view")).toBeVisible();
    await expect(page.getByTestId("analog-clock")).toBeVisible();
  });

  test("switching away and back to clock keeps it functional", async ({
    page,
  }) => {
    await page.goto("/test/calendar?events=default&view=clock");
    await expect(page.getByTestId("analog-clock-view")).toBeVisible();

    await page.getByTestId("view-switcher-month").click();
    await expect(page.getByTestId("analog-clock-view")).toHaveCount(0);

    await page.getByTestId("view-switcher-clock").click();
    await expect(page.getByTestId("analog-clock-view")).toBeVisible();
    await expect(page.getByTestId("analog-clock")).toBeVisible();
  });

  test("renders the all-day sidebar in empty state with no events", async ({
    page,
  }) => {
    await page.goto("/test/calendar?events=empty&view=clock");

    await expect(page.getByTestId("analog-clock-view")).toBeVisible();
    await expect(page.getByTestId("analog-clock-all-day-empty")).toBeVisible();
    await expect(page.getByTestId("analog-clock-all-day-list")).toHaveCount(0);
  });

  test("clicking an event arc opens the EventDetailModal (#309)", async ({
    page,
  }) => {
    await page.goto("/test/calendar?events=default&view=clock");

    await expect(page.getByTestId("analog-clock-view")).toBeVisible();

    // The clock filters timed events to the current 12-hour AM/PM period; the
    // default fixture seeds events at 9, 12, 14 and 16 so at least one arc is
    // always present regardless of when the test runs.
    const anyArc = page.locator('[data-testid^="event-arc-group-"]').first();
    await expect(anyArc).toBeVisible();

    expect(await anyArc.getAttribute("role")).toBe("button");
    expect(await anyArc.getAttribute("tabindex")).toBe("0");

    await anyArc.click();

    await expect(page.getByRole("dialog")).toBeVisible();
  });

  test("Enter on a focused arc opens the EventDetailModal (#309)", async ({
    page,
  }) => {
    await page.goto("/test/calendar?events=default&view=clock");

    const anyArc = page.locator('[data-testid^="event-arc-group-"]').first();
    await expect(anyArc).toBeVisible();
    await anyArc.focus();
    await page.keyboard.press("Enter");

    await expect(page.getByRole("dialog")).toBeVisible();
  });

  test("clicking an all-day list item opens the EventDetailModal (#309)", async ({
    page,
  }) => {
    // multiDay set seeds an all-day "Holiday" event for today.
    await page.goto("/test/calendar?events=multiDay&view=clock");

    await expect(page.getByTestId("analog-clock-view")).toBeVisible();

    const allDayButton = page.getByTestId(
      "analog-clock-all-day-all-day-holiday-button"
    );
    await expect(allDayButton).toBeVisible();
    await allDayButton.click();

    await expect(page.getByRole("dialog")).toBeVisible();
    await expect(page.getByRole("dialog")).toContainText("Holiday");
  });
});
