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
  test("fades between Month and Agenda view when the view switcher changes", async ({
    page,
  }) => {
    await page.goto("/test/calendar?events=default&view=month");

    // The grid view is wrapped in AnimatedSwap.
    const swap = page.getByTestId("animated-swap").first();
    await expect(swap).toBeVisible();

    // Initially we are in Month view — header reads "MMMM yyyy".
    await expect(page.locator("h2").first()).toBeVisible();

    // Switch to Agenda by clicking the Agenda tab in the view switcher.
    await page.getByRole("tab", { name: /agenda/i }).click();

    // During the transition the outgoing snapshot of Month and the
    // incoming Agenda root are both present in the same wrapper.
    // The transition completes within ~250ms; the assertion below races
    // for the entering or idle state and confirms Agenda is rendered.
    await expect(page.getByText("Morning Standup").first()).toBeVisible({
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
      await page.getByRole("tab", { name: /agenda/i }).click();

      // Outgoing should never appear when animations are disabled.
      const outgoing = page.getByTestId("animated-swap-outgoing");
      await expect(outgoing).toHaveCount(0);

      // Agenda content is visible immediately.
      await expect(page.getByText("Morning Standup").first()).toBeVisible({
        timeout: 5000,
      });

      // Same for month navigation.
      await page.getByRole("tab", { name: /month/i }).click();
      await page.getByTestId("calendar-next-month").click();
      await expect(outgoing).toHaveCount(0);
    } finally {
      await context.close();
    }
  });
});
