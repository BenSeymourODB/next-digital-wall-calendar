import { type Page, expect, test } from "@playwright/test";

/**
 * E2E for issue #209 — clicking an event card inside the day-overflow
 * popover opens EventDetailModal, dismisses the popover, and on close
 * returns focus to the popover's "+N more" trigger.
 *
 * Uses the `events=overflow` mock set, which seeds 10 events on today.
 * With the default `maxEventsPerDay=3`, today's month cell shows three
 * inline event pills plus a "+7 more" popover trigger, surfacing every
 * piece of the contract under test (popover open, card click, modal
 * heading, focus restoration).
 */

test.use({ video: "on" });

/**
 * The popover trigger's data-testid is keyed off `format(day, "yyyy-MM-dd")`
 * which uses the browser's local clock, and the overflow fixture's events
 * are seeded with `new Date()` + `setHours()` (also local). Computing the
 * same key in Node (e.g. `new Date().toISOString().slice(0, 10)`) is UTC
 * and would diverge from the browser by one day in any timezone west of
 * GMT during the post-midnight-UTC / pre-midnight-local window — so we
 * derive it from the browser per test.
 */
async function getTodayDayKey(page: Page): Promise<string> {
  return page.evaluate(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  });
}

test.describe("Day overflow popover → EventDetailModal (#209)", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/test/calendar?events=overflow&view=month&controls=false");

    // Positive page-load assertion guards against false passes if the
    // fixture stops mounting (404, render error, etc.).
    await expect(page.getByTestId("test-page")).toBeVisible();
    await expect(page.getByRole("dialog")).not.toBeAttached();
  });

  test("clicking a popover event card opens the modal with that event", async ({
    page,
  }) => {
    const dayKey = await getTodayDayKey(page);
    const trigger = page.getByTestId(`day-overflow-trigger-${dayKey}`);
    await expect(trigger).toBeVisible();

    await trigger.click();

    const popover = page.getByTestId(`day-events-popover-${dayKey}`);
    await expect(popover).toBeVisible();

    // The 5th overflow event — only reachable via the popover (inline cap is 3)
    // — verifying the wiring covers cards that weren't already on-screen.
    const card = page.getByTestId("day-events-popover-event-overflow-4");
    await expect(card).toBeVisible();
    await card.click();

    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await expect(
      dialog.getByRole("heading", { name: "Event 5" })
    ).toBeVisible();

    // Popover dismisses when modal grabs focus (Radix moves focus into the
    // dialog), so the popover should no longer be in the DOM.
    await expect(popover).not.toBeAttached();
  });

  test("popover event cards are keyboard activatable with Enter", async ({
    page,
  }) => {
    const dayKey = await getTodayDayKey(page);
    const trigger = page.getByTestId(`day-overflow-trigger-${dayKey}`);
    // Open the popover via a real click (scripted .focus() is unreliable
    // on WebKit for buttons); reserve keyboard activation for the in-popover
    // card, which is the path under test.
    await trigger.click();

    const popover = page.getByTestId(`day-events-popover-${dayKey}`);
    await expect(popover).toBeVisible();

    const card = page.getByTestId("day-events-popover-event-overflow-3");
    await card.focus();
    await expect(card).toBeFocused();
    await page.keyboard.press("Enter");

    await expect(
      page.getByRole("dialog").getByRole("heading", { name: "Event 4" })
    ).toBeVisible();

    // Match the click test's contract: the popover dismisses when the
    // dialog grabs focus, so a future regression that breaks Radix focus
    // handoff fails this test on the keyboard path too.
    await expect(popover).not.toBeAttached();
  });

  test("closing the modal restores focus to the +N more trigger", async ({
    page,
  }) => {
    const dayKey = await getTodayDayKey(page);
    const trigger = page.getByTestId(`day-overflow-trigger-${dayKey}`);
    await trigger.click();
    await expect(
      page.getByTestId(`day-events-popover-${dayKey}`)
    ).toBeVisible();

    await page.getByTestId("day-events-popover-event-overflow-4").click();
    await expect(
      page.getByRole("dialog").getByRole("heading", { name: "Event 5" })
    ).toBeVisible();

    await page.getByRole("button", { name: /close/i }).click();

    await expect(page.getByRole("dialog")).toBeHidden();
    // The popover itself unmounted when the modal grabbed focus, so focus
    // returns to the underlying "+N more" trigger.
    await expect(trigger).toBeFocused();
  });
});
