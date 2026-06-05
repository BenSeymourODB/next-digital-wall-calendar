import { expect, test } from "@playwright/test";

/**
 * E2E coverage for the user-configurable calendar transition speed (#283).
 *
 * Two paths matter:
 *
 *   1. `transitionMs=0` — the user picked "Off" in settings. AnimatedSwap
 *      short-circuits and never renders an `animated-swap-outgoing` snapshot;
 *      content swaps instantly. Same code path as `prefers-reduced-motion`.
 *
 *   2. `transitionMs=600` — the user picked "Slow". The outgoing snapshot
 *      is briefly visible mid-transition; we capture it via Playwright's
 *      `expect.poll` race against the slide-out.
 *
 * `video: "on"` so the off-path / slow-path animation behaviour is
 * reviewable in `test-results/`. Generated artefacts are git-ignored — only
 * the spec lands in the repo.
 */

test.use({
  video: "on",
  viewport: { width: 1280, height: 720 },
});

test.describe("Calendar transition speed (#283)", () => {
  test("transitionMs=0 swaps instantly with no outgoing snapshot", async ({
    page,
  }) => {
    await page.goto("/test/calendar?events=default&view=month&transitionMs=0");

    const header = page.locator("h2").first();
    const initialMonth = await header.textContent();

    const outgoing = page.getByTestId("animated-swap-outgoing");
    await page.getByTestId("calendar-next-month").click();

    // Off-path: outgoing must never be in the DOM.
    await expect(outgoing).toHaveCount(0);

    // Header still updates to the new month immediately.
    await expect(header).not.toHaveText(initialMonth ?? "", { timeout: 5000 });
  });

  test("transitionMs=600 (Slow) renders the outgoing snapshot mid-slide", async ({
    page,
  }) => {
    await page.goto(
      "/test/calendar?events=default&view=month&transitionMs=600"
    );

    const header = page.locator("h2").first();
    const initialMonth = await header.textContent();

    await page.getByTestId("calendar-next-month").click();

    // With a 600ms duration the outgoing snapshot is on screen long enough
    // that Playwright can race it before it disappears.
    const outgoing = page.getByTestId("animated-swap-outgoing").first();
    await expect(outgoing).toBeVisible({ timeout: 1000 });
    const transform = await outgoing.evaluate(
      (el) => (el as HTMLElement).style.transform
    );
    expect(transform).toBe("translateX(-100%)");

    // Header settles on a new month label.
    await expect(header).not.toHaveText(initialMonth ?? "", { timeout: 5000 });
  });

  test("toggling the view fades instantly when transitionMs=0", async ({
    page,
  }) => {
    await page.goto("/test/calendar?events=default&view=month&transitionMs=0");

    await page.getByTestId("view-switcher-day").click();
    await page.getByRole("menuitemradio", { name: /agenda/i }).click();

    // No outgoing snapshot for the cross-view fade either.
    await expect(page.getByTestId("animated-swap-outgoing")).toHaveCount(0);
    await expect(page.getByTestId("agenda-list")).toBeVisible({
      timeout: 5000,
    });
  });
});
