import { expect, test } from "@playwright/test";

test.describe("Analog Clock - Radial Display", () => {
  test.describe("Basic Rendering", () => {
    test("renders the analog clock SVG on default scenario", async ({
      page,
    }) => {
      await page.goto("/test/analog-clock?scenario=default&hour=10&min=10");
      await expect(page.getByTestId("analog-clock")).toBeVisible();
      await expect(page.getByTestId("clock-face")).toBeVisible();
    });

    test("renders the correct number of event arcs", async ({ page }) => {
      await page.goto("/test/analog-clock?scenario=default&hour=10&min=10");
      await expect(page.getByTestId("analog-clock")).toBeVisible();

      // Default scenario has 5 events
      const arcs = page.locator('[data-testid^="event-arc-d"]');
      await expect(arcs).toHaveCount(5);
    });

    test("renders with no events (empty scenario)", async ({ page }) => {
      await page.goto("/test/analog-clock?scenario=empty&hour=10&min=10");
      await expect(page.getByTestId("analog-clock")).toBeVisible();

      // No event arcs should be present
      const arcs = page.locator('[data-testid^="event-arc-"]');
      await expect(arcs).toHaveCount(0);
    });

    test("renders single event scenario", async ({ page }) => {
      await page.goto("/test/analog-clock?scenario=single&hour=10&min=10");
      await expect(page.getByTestId("analog-clock")).toBeVisible();
      await expect(page.getByTestId("event-arc-s1")).toBeVisible();
    });
  });

  test.describe("Visual Readability - Screenshots", () => {
    test("default scenario - 5 events at 10:10 AM", async ({ page }) => {
      await page.goto("/test/analog-clock?scenario=default&hour=10&min=10");
      await expect(page.getByTestId("analog-clock")).toBeVisible();

      await page.screenshot({
        path: "test-results/screenshots/clock-default-am.png",
        fullPage: true,
      });

      // Verify hour numbers are readable (spot check a few)
      await expect(page.getByTestId("hour-number-12")).toBeVisible();
      await expect(page.getByTestId("hour-number-3")).toBeVisible();
      await expect(page.getByTestId("hour-number-6")).toBeVisible();
      await expect(page.getByTestId("hour-number-9")).toBeVisible();

      // Verify AM indicator
      await expect(page.getByTestId("period-indicator")).toHaveText("AM");

      // Verify clock hands are present
      await expect(page.getByTestId("hour-hand")).toBeVisible();
      await expect(page.getByTestId("minute-hand")).toBeVisible();
    });

    test("PM scenario - family events at 3:30 PM", async ({ page }) => {
      await page.goto("/test/analog-clock?scenario=family&hour=15&min=30");
      await expect(page.getByTestId("analog-clock")).toBeVisible();

      await page.screenshot({
        path: "test-results/screenshots/clock-family-pm.png",
        fullPage: true,
      });

      // Verify PM indicator
      await expect(page.getByTestId("period-indicator")).toHaveText("PM");

      // Verify family event arcs
      await expect(page.getByTestId("event-arc-f1")).toBeVisible();
      await expect(page.getByTestId("event-arc-f2")).toBeVisible();
    });

    test("color palette - all 6 event colors visible", async ({ page }) => {
      await page.goto("/test/analog-clock?scenario=colors&hour=4&min=0");
      await expect(page.getByTestId("analog-clock")).toBeVisible();

      await page.screenshot({
        path: "test-results/screenshots/clock-colors.png",
        fullPage: true,
      });

      // All 6 color events should be visible
      for (let i = 1; i <= 6; i++) {
        await expect(page.getByTestId(`event-arc-c${i}`)).toBeVisible();
      }

      // Verify color legend items
      for (let i = 1; i <= 6; i++) {
        await expect(page.getByTestId(`legend-item-c${i}`)).toBeVisible();
      }
    });

    test("overlapping events - stacked at different radii", async ({
      page,
    }) => {
      await page.goto("/test/analog-clock?scenario=overlap&hour=3&min=0");
      await expect(page.getByTestId("analog-clock")).toBeVisible();

      await page.screenshot({
        path: "test-results/screenshots/clock-overlap.png",
        fullPage: true,
      });

      // All 3 overlapping events should render
      await expect(page.getByTestId("event-arc-o1")).toBeVisible();
      await expect(page.getByTestId("event-arc-o2")).toBeVisible();
      await expect(page.getByTestId("event-arc-o3")).toBeVisible();
    });

    test("dense schedule - 12 events filling every hour", async ({ page }) => {
      await page.goto("/test/analog-clock?scenario=dense&hour=6&min=0");
      await expect(page.getByTestId("analog-clock")).toBeVisible();

      await page.screenshot({
        path: "test-results/screenshots/clock-dense.png",
        fullPage: true,
      });

      // All 12 events should render
      for (let i = 1; i <= 12; i++) {
        await expect(page.getByTestId(`event-arc-dn${i}`)).toBeVisible();
      }
    });

    test("large size (800px) for wall display readability", async ({
      page,
    }) => {
      await page.goto(
        "/test/analog-clock?scenario=default&hour=10&min=10&size=800"
      );
      await expect(page.getByTestId("analog-clock")).toBeVisible();

      const svg = page.getByTestId("analog-clock");
      await expect(svg).toHaveAttribute("width", "800");
      await expect(svg).toHaveAttribute("height", "800");

      await page.screenshot({
        path: "test-results/screenshots/clock-large-800px.png",
        fullPage: true,
      });
    });
  });

  test.describe("Accessibility & Readability", () => {
    test("clock has accessible role and label", async ({ page }) => {
      await page.goto("/test/analog-clock?scenario=default&hour=10&min=10");
      const svg = page.getByTestId("analog-clock");
      await expect(svg).toHaveAttribute("role", "img");

      const label = await svg.getAttribute("aria-label");
      expect(label).toContain("clock");
      expect(label).toContain("5 events");
    });

    test("event arcs have accessible labels", async ({ page }) => {
      await page.goto("/test/analog-clock?scenario=default&hour=10&min=10");

      const arcGroup = page.getByTestId("event-arc-group-d1");
      await expect(arcGroup).toHaveAttribute("role", "img");
      const label = await arcGroup.getAttribute("aria-label");
      expect(label).toContain("Game Night");
    });

    test("hour numbers 1-12 all visible", async ({ page }) => {
      await page.goto("/test/analog-clock?scenario=empty&hour=12&min=0");
      await expect(page.getByTestId("analog-clock")).toBeVisible();

      for (let i = 1; i <= 12; i++) {
        await expect(page.getByTestId(`hour-number-${i}`)).toBeVisible();
      }

      await page.screenshot({
        path: "test-results/screenshots/clock-empty-readability.png",
        fullPage: true,
      });
    });

    test("event legend matches rendered arcs", async ({ page }) => {
      await page.goto("/test/analog-clock?scenario=default&hour=10&min=10");

      const legend = page.getByTestId("event-legend");
      await expect(legend).toBeVisible();
      await expect(legend).toContainText("Events (5)");
    });
  });

  test.describe("Clock Face Accuracy", () => {
    test("shows correct hand positions at 3:00", async ({ page }) => {
      await page.goto("/test/analog-clock?scenario=empty&hour=3&min=0");
      await expect(page.getByTestId("analog-clock")).toBeVisible();

      // Hour hand at 90 degrees (3 o'clock)
      const hourHand = page.getByTestId("hour-hand");
      const hourTransform = await hourHand.getAttribute("transform");
      expect(hourTransform).toContain("rotate(90");

      // Minute hand at 0 degrees (12 o'clock)
      const minuteHand = page.getByTestId("minute-hand");
      const minuteTransform = await minuteHand.getAttribute("transform");
      expect(minuteTransform).toContain("rotate(0");

      await page.screenshot({
        path: "test-results/screenshots/clock-3oclock.png",
        fullPage: true,
      });
    });

    test("shows correct hand positions at 9:45", async ({ page }) => {
      await page.goto("/test/analog-clock?scenario=empty&hour=9&min=45");
      await expect(page.getByTestId("analog-clock")).toBeVisible();

      // Hour hand at 292.5 degrees (9*30 + 45*0.5 = 292.5)
      const hourHand = page.getByTestId("hour-hand");
      const hourTransform = await hourHand.getAttribute("transform");
      expect(hourTransform).toContain("rotate(292.5");

      // Minute hand at 270 degrees (45*6 = 270)
      const minuteHand = page.getByTestId("minute-hand");
      const minuteTransform = await minuteHand.getAttribute("transform");
      expect(minuteTransform).toContain("rotate(270");

      await page.screenshot({
        path: "test-results/screenshots/clock-945.png",
        fullPage: true,
      });
    });
  });

  test.describe("rawEvents prop (IEvent[] input)", () => {
    test("renders timed events from raw IEvents and filters all-day + out-of-period", async ({
      page,
    }) => {
      await page.goto("/test/analog-clock?scenario=all-day-mix&hour=9&min=0");
      await expect(page.getByTestId("analog-clock")).toBeVisible();

      // Timed AM events render as arcs
      await expect(page.getByTestId("event-arc-tp-1")).toBeVisible();
      await expect(page.getByTestId("event-arc-tp-2")).toBeVisible();
      await expect(page.getByTestId("event-arc-tp-3")).toBeVisible();

      // All-day and out-of-period events are filtered — no arcs rendered
      await expect(page.getByTestId("event-arc-ad-1")).toHaveCount(0);
      await expect(page.getByTestId("event-arc-op-1")).toHaveCount(0);

      // But the raw inputs listing still shows all 5 entries (for the dev UI)
      const rawInputs = page.locator('[data-testid^="raw-input-item-"]');
      await expect(rawInputs).toHaveCount(5);

      await page.screenshot({
        path: "test-results/screenshots/clock-raw-all-day-mix-am.png",
        fullPage: true,
      });
    });

    test("filters all-day events in PM period as well", async ({ page }) => {
      await page.goto("/test/analog-clock?scenario=all-day-mix&hour=15&min=0");
      await expect(page.getByTestId("analog-clock")).toBeVisible();

      // PM indicator
      await expect(page.getByTestId("period-indicator")).toHaveText("PM");

      // Same timed events exist but shifted to PM-relative offsets
      await expect(page.getByTestId("event-arc-tp-1")).toBeVisible();
      await expect(page.getByTestId("event-arc-ad-1")).toHaveCount(0);
      // In PM mode, the "other period" event is AM, so filtered out
      await expect(page.getByTestId("event-arc-op-1")).toHaveCount(0);

      await page.screenshot({
        path: "test-results/screenshots/clock-raw-all-day-mix-pm.png",
        fullPage: true,
      });
    });

    test("shows raw events listing with all-day badge for transparency", async ({
      page,
    }) => {
      await page.goto("/test/analog-clock?scenario=all-day-mix&hour=9&min=0");
      await expect(page.getByTestId("raw-events-input")).toBeVisible();

      // The all-day entry has an all-day badge visible in the input listing
      const allDayEntry = page.getByTestId("raw-input-item-ad-1");
      await expect(allDayEntry).toContainText("all-day");
    });
  });
});
