import { type Locator, type Page, expect, test } from "@playwright/test";

/**
 * E2E coverage for the new Calendar settings section (issue #71 / PR #157).
 *
 * Verifies the four user-configurable knobs that replaced previously
 * hardcoded calendar values:
 *   - Refresh Interval         (5–120 min, step 5, default 15)
 *   - Months Ahead             (1–12,    step 1, default 6)
 *   - Months Behind            (0–6,     step 1, default 1)
 *   - Max Events Per Day       (1–10,    step 1, default 3)
 *
 * Drives the Radix slider via a synthesized keydown event (the underlying
 * primitive listens for keydown on the thumb). Playwright's `locator.press`
 * focuses the element but a synthesized keydown is the most reliable way
 * to ensure the Radix listener fires across browsers.
 */

async function pressArrowOnSlider(
  page: Page,
  thumb: Locator,
  key: "ArrowRight" | "ArrowLeft"
): Promise<void> {
  await thumb.focus();
  await thumb.evaluate((el, k) => {
    el.dispatchEvent(
      new KeyboardEvent("keydown", { key: k, code: k, bubbles: true })
    );
  }, key);
}

test.describe("Settings → Calendar section (/test/settings)", () => {
  test.beforeEach(async ({ page }) => {
    await page.route("**/api/settings", (route) =>
      route.fulfill({ status: 200, body: "{}" })
    );
    await page.goto("/test/settings");
  });

  test("renders the Calendar section with title and description", async ({
    page,
  }) => {
    await expect(page.getByText("Calendar", { exact: true })).toBeVisible();
    await expect(
      page.getByText(
        /How often the calendar fetches events and how much data is loaded/i
      )
    ).toBeVisible();
  });

  test("renders all four sliders with their default values", async ({
    page,
  }) => {
    await expect(page.getByText("Refresh Interval")).toBeVisible();
    await expect(page.getByText("15 minutes", { exact: true })).toBeVisible();

    await expect(page.getByText("Months Ahead")).toBeVisible();
    await expect(page.getByText("6 months", { exact: true })).toBeVisible();

    await expect(page.getByText("Months Behind")).toBeVisible();
    await expect(page.getByText("1 month", { exact: true })).toBeVisible();

    await expect(page.getByText("Max Events Per Day")).toBeVisible();
    await expect(page.getByText("3 events", { exact: true })).toBeVisible();
  });

  test("each slider exposes the documented min/max range via aria attributes", async ({
    page,
  }) => {
    const refresh = page.locator("#calendar-refresh-interval [role=slider]");
    const ahead = page.locator("#calendar-fetch-ahead [role=slider]");
    const behind = page.locator("#calendar-fetch-behind [role=slider]");
    const maxEvents = page.locator("#calendar-max-events [role=slider]");

    await expect(refresh).toHaveAttribute("aria-valuemin", "5");
    await expect(refresh).toHaveAttribute("aria-valuemax", "120");
    await expect(refresh).toHaveAttribute("aria-valuenow", "15");

    await expect(ahead).toHaveAttribute("aria-valuemin", "1");
    await expect(ahead).toHaveAttribute("aria-valuemax", "12");
    await expect(ahead).toHaveAttribute("aria-valuenow", "6");

    await expect(behind).toHaveAttribute("aria-valuemin", "0");
    await expect(behind).toHaveAttribute("aria-valuemax", "6");
    await expect(behind).toHaveAttribute("aria-valuenow", "1");

    await expect(maxEvents).toHaveAttribute("aria-valuemin", "1");
    await expect(maxEvents).toHaveAttribute("aria-valuemax", "10");
    await expect(maxEvents).toHaveAttribute("aria-valuenow", "3");
  });

  test("Refresh Interval slider updates value and label on ArrowRight", async ({
    page,
  }) => {
    const refresh = page.locator("#calendar-refresh-interval [role=slider]");
    await pressArrowOnSlider(page, refresh, "ArrowRight"); // step 5: 15 → 20

    await expect(refresh).toHaveAttribute("aria-valuenow", "20");
    await expect(page.getByText("20 minutes", { exact: true })).toBeVisible();
  });

  test("Months Behind slider can step down to 0 and pluralizes correctly", async ({
    page,
  }) => {
    const behind = page.locator("#calendar-fetch-behind [role=slider]");
    await pressArrowOnSlider(page, behind, "ArrowLeft"); // 1 → 0

    await expect(behind).toHaveAttribute("aria-valuenow", "0");
    await expect(page.getByText("0 months", { exact: true })).toBeVisible();
  });

  test("Max Events Per Day uses singular 'event' label when set to 1", async ({
    page,
  }) => {
    const maxEvents = page.locator("#calendar-max-events [role=slider]");
    // Default 3 → two ArrowLefts → 1
    await pressArrowOnSlider(page, maxEvents, "ArrowLeft");
    await pressArrowOnSlider(page, maxEvents, "ArrowLeft");

    await expect(maxEvents).toHaveAttribute("aria-valuenow", "1");
    await expect(page.getByText("1 event", { exact: true })).toBeVisible();
  });

  test("changing a slider PUTs only the changed field to /api/settings", async ({
    page,
  }) => {
    const settingsRequests: Array<Record<string, unknown>> = [];
    await page.route("**/api/settings", async (route, request) => {
      if (request.method() === "PUT") {
        try {
          const body = request.postDataJSON() as Record<string, unknown>;
          settingsRequests.push(body);
        } catch {
          // ignore body parse errors
        }
      }
      await route.fulfill({ status: 200, body: "{}" });
    });

    const ahead = page.locator("#calendar-fetch-ahead [role=slider]");
    await pressArrowOnSlider(page, ahead, "ArrowRight"); // 6 → 7

    await expect
      .poll(() => settingsRequests.length, { timeout: 5000 })
      .toBeGreaterThan(0);

    const lastBody = settingsRequests.at(-1)!;
    expect(lastBody).toEqual({ calendarFetchMonthsAhead: 7 });
  });

  test("Calendar section sits between Screen Rotation and Page Transitions sections", async ({
    page,
  }) => {
    // PR description says the section is wired in between Scheduler and
    // Transition sections. The actual rendered titles use the user-facing
    // names "Screen Rotation" and "Page Transitions".
    const titleTexts = await page
      .locator("[data-slot='card-title']")
      .allTextContents();

    const idxScheduler = titleTexts.findIndex(
      (t) => t.trim() === "Screen Rotation"
    );
    const idxCalendar = titleTexts.findIndex((t) => t.trim() === "Calendar");
    const idxTransition = titleTexts.findIndex(
      (t) => t.trim() === "Page Transitions"
    );

    expect(idxScheduler).toBeGreaterThanOrEqual(0);
    expect(idxCalendar).toBeGreaterThanOrEqual(0);
    expect(idxTransition).toBeGreaterThanOrEqual(0);
    expect(idxScheduler).toBeLessThan(idxCalendar);
    expect(idxCalendar).toBeLessThan(idxTransition);
  });
});
