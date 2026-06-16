import { expect, test } from "@playwright/test";

// Capture video of the popover open/close animation path.
//
// Hoisted to file-level because Playwright disallows `test.use({ video })`
// inside a `describe` group (the video sink requires a new worker, which is
// not legal mid-describe). Splitting these specs into their own file
// preserves the per-describe scoping intent without affecting the rest of
// `calendar.spec.ts`.
// A tall viewport keeps the 10-event popover opening downward and fully on
// screen. At the default 720px height Radix flips it upward (not enough room
// below the mid-grid trigger), which pushes the header close button above the
// viewport top so Playwright can't click it.
test.use({ video: "on", viewport: { width: 1280, height: 1400 } });

test.describe("Month Calendar - Day Overflow Popover", () => {
  // Read today's key inside the browser after navigation so the test and the
  // rendered component share the same clock (avoids midnight / timezone races).
  async function todayKeyFromBrowser(
    page: import("@playwright/test").Page
  ): Promise<string> {
    return page.evaluate(() => {
      const d = new Date();
      const pad = (n: number) => String(n).padStart(2, "0");
      return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    });
  }

  test("clicking +X more opens a popover listing every event for the day", async ({
    page,
  }) => {
    await page.goto("/test/calendar?events=overflow&view=month");
    const key = await todayKeyFromBrowser(page);

    const trigger = page.getByTestId(`day-overflow-trigger-${key}`);
    await expect(trigger).toBeVisible();
    await expect(trigger).toHaveText(/\+\d+ more/);

    await trigger.click();

    const popover = page.getByTestId(`day-events-popover-${key}`);
    await expect(popover).toBeVisible();

    // Heading format "Events on <Weekday>, <Month> <day>, <year>"
    await expect(
      popover.getByRole("heading", {
        name: /Events on \w+, \w+ \d{1,2}, \d{4}/,
      })
    ).toBeVisible();

    // All 10 overflow events appear inside the popover
    for (let i = 1; i <= 10; i++) {
      await expect(
        popover.getByText(`Event ${i}`, { exact: true })
      ).toBeVisible();
    }
  });

  test("close button dismisses the popover", async ({ page }) => {
    await page.goto("/test/calendar?events=overflow&view=month");
    const key = await todayKeyFromBrowser(page);

    await page.getByTestId(`day-overflow-trigger-${key}`).click();

    const popover = page.getByTestId(`day-events-popover-${key}`);
    await expect(popover).toBeVisible();

    await page.getByTestId(`day-events-popover-close-${key}`).click();

    await expect(popover).toBeHidden();
  });

  test("Escape key dismisses the popover", async ({ page }) => {
    await page.goto("/test/calendar?events=overflow&view=month");
    const key = await todayKeyFromBrowser(page);

    await page.getByTestId(`day-overflow-trigger-${key}`).click();

    const popover = page.getByTestId(`day-events-popover-${key}`);
    await expect(popover).toBeVisible();

    await page.keyboard.press("Escape");

    await expect(popover).toBeHidden();
  });

  test("renders event times inside the popover in 24-hour format", async ({
    page,
  }) => {
    await page.goto("/test/calendar?events=overflow&view=month");
    const key = await todayKeyFromBrowser(page);

    await page.getByTestId(`day-overflow-trigger-${key}`).click();

    const popover = page.getByTestId(`day-events-popover-${key}`);
    // Overflow events start at 08:00 and 17:00 (i=0 and i=9)
    await expect(popover.getByText(/08:00 - 09:00/)).toBeVisible();
    await expect(popover.getByText(/17:00 - 18:00/)).toBeVisible();
  });

  test("renders event times in 12-hour format when configured", async ({
    page,
  }) => {
    await page.goto("/test/calendar?events=overflow&view=month&24hour=false");
    const key = await todayKeyFromBrowser(page);

    await page.getByTestId(`day-overflow-trigger-${key}`).click();

    const popover = page.getByTestId(`day-events-popover-${key}`);
    await expect(popover.getByText(/8:00 AM - 9:00 AM/)).toBeVisible();
    await expect(popover.getByText(/5:00 PM - 6:00 PM/)).toBeVisible();
  });

  test("clicking an event card inside the popover opens the event detail modal", async ({
    page,
  }) => {
    await page.goto("/test/calendar?events=overflow&view=month");
    const key = await todayKeyFromBrowser(page);

    const trigger = page.getByTestId(`day-overflow-trigger-${key}`);
    await trigger.click();

    const popover = page.getByTestId(`day-events-popover-${key}`);
    await expect(popover).toBeVisible();

    // Click an overflow event (one only visible inside the popover).
    await popover.getByRole("button", { name: /Event 5/ }).click();

    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await expect(
      dialog.getByRole("heading", { name: "Event 5" })
    ).toBeVisible();

    // Popover dismisses when the modal grabs focus.
    await expect(popover).toBeHidden();

    // Closing the modal returns focus to the +N more trigger so keyboard
    // users land where they were.
    await page.getByRole("button", { name: /close/i }).click();
    await expect(dialog).toBeHidden();
    await expect(trigger).toBeFocused();
  });
});
