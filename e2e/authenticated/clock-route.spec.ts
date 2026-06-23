/**
 * Production `/clock` standalone wall-display route (issue #398).
 *
 * The route must render only `AnalogClockView` — no `ViewSwitcher`, no
 * page header, no settings/account chrome — and `AppShell` must skip
 * `SideNavigation`, `PointsBadge`, and `ScreenTransition` so the clock
 * fills the screen.
 *
 * Lives under `e2e/authenticated/` so the `authenticated-chromium`
 * project picks it up (other browser projects skip it; see
 * `playwright.config.ts`). Uses the shared auth fixture from #278.
 */
import { expect, test } from "@playwright/test";

test.describe("/clock standalone wall-display route (#398)", () => {
  // Match `e2e/authenticated/calendar-view-deeplink.spec.ts` and stub
  // the internal Next.js API routes the CalendarProvider hits, so the
  // page renders deterministically without depending on a real Google
  // account behind the shared session.
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

  test("renders AnalogClockView at the page root", async ({ page }) => {
    await page.goto("/clock");

    await expect(page.getByTestId("clock-page")).toBeVisible();
    await expect(page.getByTestId("analog-clock-view")).toBeVisible();
    await expect(page.getByTestId("analog-clock")).toBeVisible();
  });

  test("does not render the /calendar header, view switcher, or settings chrome", async ({
    page,
  }) => {
    await page.goto("/clock");

    // Wait for the clock to commit before negative-asserting the chrome.
    await expect(page.getByTestId("analog-clock-view")).toBeVisible();

    await expect(
      page.getByRole("heading", { name: "Wall Calendar" })
    ).toHaveCount(0);
    // Use the container testid (`view-switcher`), not an inner button
    // (`view-switcher-clock`) — the container guard catches a regression
    // where the whole switcher is imported even if the clock button
    // happened to be filtered out.
    await expect(page.getByTestId("view-switcher")).toHaveCount(0);
    await expect(page.getByTestId("calendar-settings-panel")).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: /account manager/i })
    ).toHaveCount(0);
  });

  test("AppShell does not wrap /clock — no SideNavigation, no ScreenTransition, no PointsBadge", async ({
    page,
  }) => {
    await page.goto("/clock");

    await expect(page.getByTestId("analog-clock-view")).toBeVisible();

    await expect(
      page.getByRole("navigation", { name: /main navigation/i })
    ).toHaveCount(0);
    await expect(page.getByTestId("screen-transition")).toHaveCount(0);
    await expect(page.getByTestId("points-badge")).toHaveCount(0);
  });

  test("captures a wall-display screenshot of the rendered /clock page", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("/clock");
    await expect(page.getByTestId("analog-clock")).toBeVisible();

    // Saved to playwright artifacts; the PR body embeds the rendered
    // image so reviewers can eyeball the chrome-free wall view. The
    // `screenshots/` subdir matches the convention used by other specs
    // (e.g. `e2e/analog-clock.spec.ts`).
    await page.screenshot({
      path: "test-results/screenshots/clock-route-wall-display.png",
      fullPage: true,
    });
  });
});
