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

test.describe("/calendar — ?view= deep linking (#238, #278)", () => {
  // The production page calls Google through the app's own Next.js API
  // routes (`/api/calendar/*`, `/api/settings`) rather than hitting
  // `googleapis.com` from the browser — Playwright's `page.route` only
  // sees browser-originated requests, so the relevant intercept points
  // are the internal routes. Stub each with an empty/permissive
  // response so the YearCalendar landmarks render without depending on
  // a real Google account behind the shared session.
  test.beforeEach(async ({ page }) => {
    await page.route("**/api/calendar/events**", (route) => {
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ items: [], nextSyncToken: null }),
      });
    });
    await page.route("**/api/calendar/calendars", (route) => {
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ items: [] }),
      });
    });
    await page.route("**/api/calendar/colors", (route) => {
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ event: {}, calendar: {} }),
      });
    });
    await page.route("**/api/settings", (route) => {
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({}),
      });
    });
  });

  test("?view=year renders the YearCalendar grid", async ({ page }) => {
    await page.goto("/calendar?view=year");

    await expect(page.getByTestId("year-calendar-grid")).toBeVisible();
    await expect(page.getByTestId("year-calendar-month-0")).toBeVisible();
    await expect(page.getByTestId("year-calendar-month-11")).toBeVisible();

    // Read the year in the browser so we compare against whatever the
    // page itself believes "now" is — avoids a one-second flake at
    // midnight on Dec 31 where the test process and the browser
    // process disagree on the year.
    const year = await page.evaluate(() => String(new Date().getFullYear()));
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
    // Wait for the calendar surface to commit before touching
    // localStorage. Without this, an auth/redirect interstitial (e.g.
    // a slow session check that bounces to `/auth/signin` for a beat)
    // would let the `localStorage.setItem` below silently no-op on the
    // wrong origin, and the next-line assertion would pass for the
    // wrong reason. Tying the seed to a visible landmark on the
    // production page makes the test fail loudly if the shared session
    // ever stops being recognised.
    await expect(
      page.getByRole("heading", { name: "Wall Calendar" })
    ).toBeVisible();

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
