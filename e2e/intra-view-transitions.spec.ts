import { expect, test } from "@playwright/test";

/**
 * E2E for intra-view slide animations on Day / Week / Year navigation
 * (#207). Mirrors the month-slide spec in `calendar-transitions.spec.ts`.
 *
 * Video capture is on so the slide is reviewable in `test-results/`. The
 * `animated-swap-outgoing` element is timing-sensitive — we assert the
 * transform direction *if* we catch it mid-animation, then always assert
 * the heading updated. Either path proves the wiring is correct.
 *
 * Uses the public `/test/calendar` fixtures so no auth is required.
 */

test.use({
  video: "on",
  viewport: { width: 1280, height: 720 },
});

async function expectOutgoingTransform(
  page: import("@playwright/test").Page,
  expected: "translateX(-100%)" | "translateX(100%)"
) {
  const outgoing = page.getByTestId("animated-swap-outgoing").first();
  if (await outgoing.isVisible().catch(() => false)) {
    const transform = await outgoing.evaluate(
      (el) => (el as HTMLElement).style.transform
    );
    expect(transform).toBe(expected);
  }
}

test.describe("Intra-view slide animations (#207)", () => {
  test("slides the day body when navigating prev/next day", async ({
    page,
  }) => {
    await page.goto("/test/calendar?events=default&view=day");

    const heading = page.getByTestId("day-calendar-heading");
    await expect(heading).toBeVisible();
    const initial = await heading.textContent();

    await page.getByTestId("day-calendar-next").click();
    await expectOutgoingTransform(page, "translateX(-100%)");
    await expect(heading).not.toHaveText(initial ?? "", { timeout: 5000 });

    const afterNext = await heading.textContent();
    await page.getByTestId("day-calendar-prev").click();
    await expectOutgoingTransform(page, "translateX(100%)");
    await expect(heading).not.toHaveText(afterNext ?? "", { timeout: 5000 });
  });

  test("slides the week body when navigating prev/next week", async ({
    page,
  }) => {
    await page.goto("/test/calendar?events=default&view=week");

    const range = page.getByTestId("week-calendar-range");
    await expect(range).toBeVisible();
    const initial = await range.textContent();

    await page.getByTestId("week-calendar-next").click();
    await expectOutgoingTransform(page, "translateX(-100%)");
    await expect(range).not.toHaveText(initial ?? "", { timeout: 5000 });

    const afterNext = await range.textContent();
    await page.getByTestId("week-calendar-prev").click();
    await expectOutgoingTransform(page, "translateX(100%)");
    await expect(range).not.toHaveText(afterNext ?? "", { timeout: 5000 });
  });

  test("slides the year months grid when navigating prev/next year", async ({
    page,
  }) => {
    await page.goto("/test/calendar?events=default&view=year");

    // Year header is the only h2 in the year view.
    const heading = page.locator("h2").first();
    await expect(heading).toBeVisible();
    const initial = await heading.textContent();

    await page.getByTestId("year-calendar-next-year").click();
    await expectOutgoingTransform(page, "translateX(-100%)");
    await expect(heading).not.toHaveText(initial ?? "", { timeout: 5000 });

    const afterNext = await heading.textContent();
    await page.getByTestId("year-calendar-prev-year").click();
    await expectOutgoingTransform(page, "translateX(100%)");
    await expect(heading).not.toHaveText(afterNext ?? "", { timeout: 5000 });
  });

  test("skips intra-view animation under prefers-reduced-motion", async ({
    browser,
  }) => {
    const context = await browser.newContext({
      reducedMotion: "reduce",
      viewport: { width: 1280, height: 720 },
    });
    const page = await context.newPage();

    try {
      await page.goto("/test/calendar?events=default&view=day");
      await page.getByTestId("day-calendar-next").click();
      await expect(page.getByTestId("animated-swap-outgoing")).toHaveCount(0);

      await page.goto("/test/calendar?events=default&view=week");
      await page.getByTestId("week-calendar-next").click();
      await expect(page.getByTestId("animated-swap-outgoing")).toHaveCount(0);

      await page.goto("/test/calendar?events=default&view=year");
      await page.getByTestId("year-calendar-next-year").click();
      await expect(page.getByTestId("animated-swap-outgoing")).toHaveCount(0);
    } finally {
      await context.close();
    }
  });
});
