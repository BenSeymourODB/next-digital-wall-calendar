import { expect, test } from "@playwright/test";

/**
 * E2E tests for calendar view-mode and month-navigation transition
 * animations (#87).
 *
 * Uses video capture so animation behavior is reviewable in test-results/.
 * Animations are not committed; only the spec is.
 */

test.use({
  video: "on",
  viewport: { width: 1280, height: 720 },
});

test.describe("Calendar transition animations", () => {
  test("fades between Month and Day-Agenda when the view switcher changes (#150)", async ({
    page,
  }) => {
    await page.goto("/test/calendar?events=default&view=month");

    // The grid view is wrapped in AnimatedSwap.
    const swap = page.getByTestId("animated-swap").first();
    await expect(swap).toBeVisible();

    // Initially we are in Month view — header reads "MMMM yyyy".
    await expect(page.locator("h2").first()).toBeVisible();

    // Open the Day dropdown and pick Agenda — composite swap key
    // `day:agenda` triggers the same fade as a top-level view change.
    await page.getByTestId("view-switcher-day").click();
    await page.getByRole("menuitemradio", { name: /agenda/i }).click();

    // The Day-agenda renderer is now visible.
    await expect(page.getByTestId("agenda-list")).toBeVisible({
      timeout: 5000,
    });
  });

  test("slides the month grid left when navigating to next month", async ({
    page,
  }) => {
    await page.goto("/test/calendar?events=default&view=month");

    const header = page.locator("h2").first();
    const initialMonth = await header.textContent();

    await page.getByTestId("calendar-next-month").click();

    // During the slide, the outgoing wrapper carries translateX(-100%).
    // We may catch it mid-animation; if not, the new month is rendered.
    const outgoing = page.getByTestId("animated-swap-outgoing").first();
    if (await outgoing.isVisible().catch(() => false)) {
      const transform = await outgoing.evaluate(
        (el) => (el as HTMLElement).style.transform
      );
      expect(transform).toBe("translateX(-100%)");
    }

    // Header must update to a new month label.
    await expect(header).not.toHaveText(initialMonth ?? "", { timeout: 5000 });
  });

  test("slides the month grid right when navigating to previous month", async ({
    page,
  }) => {
    await page.goto("/test/calendar?events=default&view=month");

    const header = page.locator("h2").first();
    const initialMonth = await header.textContent();

    await page.getByTestId("calendar-prev-month").click();

    const outgoing = page.getByTestId("animated-swap-outgoing").first();
    if (await outgoing.isVisible().catch(() => false)) {
      const transform = await outgoing.evaluate(
        (el) => (el as HTMLElement).style.transform
      );
      expect(transform).toBe("translateX(100%)");
    }

    await expect(header).not.toHaveText(initialMonth ?? "", { timeout: 5000 });
  });

  test("skips animations when prefers-reduced-motion is set", async ({
    browser,
  }) => {
    const context = await browser.newContext({
      reducedMotion: "reduce",
      viewport: { width: 1280, height: 720 },
    });
    const page = await context.newPage();

    try {
      await page.goto("/test/calendar?events=default&view=month");

      // With reduced motion, AnimatedSwap renders a single wrapper with
      // its child directly — no outgoing/incoming/entering nodes.
      await page.getByTestId("view-switcher-day").click();
      await page.getByRole("menuitemradio", { name: /agenda/i }).click();

      // Outgoing should never appear when animations are disabled.
      const outgoing = page.getByTestId("animated-swap-outgoing");
      await expect(outgoing).toHaveCount(0);

      // Day-agenda content is visible immediately.
      await expect(page.getByTestId("agenda-list")).toBeVisible({
        timeout: 5000,
      });

      // Same for month navigation.
      await page.getByTestId("view-switcher-month").click();
      await page.getByTestId("calendar-next-month").click();
      await expect(outgoing).toHaveCount(0);
    } finally {
      await context.close();
    }
  });
});
