/**
 * Production `/calendar` page — deep-link `?view=` E2E coverage.
 *
 * Issue #278 was filed because the auth-gated `/calendar` page had no
 * Playwright coverage — only `/test/calendar` (which bypasses auth) and
 * the unit suite in `src/app/calendar/__tests__/page.test.tsx` (which
 * stubs `CalendarProvider`). This spec is the first consumer of the
 * shared auth fixture and proves the URL `?view=` deep-link flow added
 * in #238 reaches the real provider and renders the requested view on
 * the production route.
 *
 * Lives under `e2e/authenticated/` so the `authenticated-chromium`
 * project picks it up (and the other browser projects skip it; see
 * `playwright.config.ts`).
 */
import { expect, test } from "@playwright/test";
import { mockCalendarEventsResponse } from "../fixtures/google-api-mocks";

test.describe("/calendar — ?view= deep linking (#238, #278)", () => {
  // The production page issues real Google Calendar fetches once the
  // session resolves. Stub those with an empty event list so the test
  // doesn't depend on the network or on any seeded calendar data — the
  // YearCalendar landmarks render before events arrive.
  test.beforeEach(async ({ page }) => {
    await page.route("**/www.googleapis.com/calendar/**", (route) => {
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          ...mockCalendarEventsResponse(),
          items: [],
        }),
      });
    });
    await page.route("**/tasks.googleapis.com/**", (route) => {
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ items: [] }),
      });
    });
  });

  test("?view=year renders the YearCalendar grid", async ({ page }) => {
    await page.goto("/calendar?view=year");

    await expect(page.getByTestId("year-calendar-grid")).toBeVisible();
    await expect(page.getByTestId("year-calendar-month-0")).toBeVisible();
    await expect(page.getByTestId("year-calendar-month-11")).toBeVisible();

    const year = new Date().getFullYear().toString();
    await expect(page.getByRole("heading", { level: 2 }).first()).toContainText(
      year
    );
  });

  test("?view=year wins over a competing localStorage view", async ({
    page,
  }) => {
    // Seed localStorage with month before the deep-link navigation. The
    // page reads `calendar-settings` (see CalendarProvider) — we don't
    // need a full payload, just enough that the boot path would prefer
    // month if the URL signal were ignored.
    await page.goto("/calendar");
    await page.evaluate(() => {
      window.localStorage.setItem(
        "calendar-settings",
        JSON.stringify({ view: "month" })
      );
    });

    await page.goto("/calendar?view=year");

    await expect(page.getByTestId("year-calendar-grid")).toBeVisible();
  });

  test("ViewSwitcher marks the year tab pressed on ?view=year", async ({
    page,
  }) => {
    await page.goto("/calendar?view=year");

    await expect(page.getByTestId("view-switcher-year")).toHaveAttribute(
      "aria-pressed",
      "true"
    );
  });
});
