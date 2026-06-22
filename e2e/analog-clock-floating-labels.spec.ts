import { expect, test } from "@playwright/test";

/**
 * Floating off-arc title labels (#311).
 *
 * Exercises the overflow path on top of #310's 2-line wrap: when a title
 * cannot fit even on two curved lines (or sits on a sub-30° arc whose
 * single-line budget is too tight), the in-arc title is suppressed and a
 * sibling FloatingLabel renders the full text outside the clock face with
 * a thin connector back to the arc midpoint.
 *
 * The default scenario is sufficient: "Team Standup" (12 chars) sits on a
 * 15° arc whose single-line budget is well below 12 chars, so the title
 * overflows and a floating label renders.
 */
test.describe("Analog Clock — floating off-arc labels (#311)", () => {
  test("renders a floating label for an event whose title overflows the arc", async ({
    page,
  }) => {
    await page.goto("/test/analog-clock?scenario=default&hour=10&min=10");
    await expect(page.getByTestId("analog-clock")).toBeVisible();

    const layer = page.getByTestId("floating-labels-layer");
    await expect(layer).toBeAttached();

    // d3 ("Team Standup") sits on a 15° arc; its 12-char title overflows.
    const label = page.getByTestId("floating-label-d3");
    await expect(label).toBeVisible();

    const text = page.getByTestId("floating-label-text-d3");
    await expect(text).toHaveText("Team Standup");
  });

  test("suppresses the in-arc title for an overflowing event but keeps the colored arc", async ({
    page,
  }) => {
    await page.goto("/test/analog-clock?scenario=default&hour=10&min=10");
    await expect(page.getByTestId("analog-clock")).toBeVisible();

    // The arc fill is still painted.
    await expect(page.getByTestId("event-arc-d3")).toBeVisible();
    // …but no in-arc title text is rendered (would otherwise be event-title-d3).
    await expect(page.getByTestId("event-title-d3")).toHaveCount(0);
  });

  test("renders a connector line in the event's color back to the arc midpoint", async ({
    page,
  }) => {
    await page.goto("/test/analog-clock?scenario=default&hour=10&min=10");
    const connector = page.getByTestId("floating-label-connector-d3");
    await expect(connector).toBeAttached();
    // d3 is the blue Team Standup event. The DOM serializes the stroke in
    // lower-case (#3b82f6); match case-insensitively so the assertion doesn't
    // depend on hex casing.
    await expect(connector).toHaveAttribute("stroke", /^#3b82f6$/i);
  });

  test("the analog clock SVG carries overflow='visible' so labels can paint outside the viewBox", async ({
    page,
  }) => {
    await page.goto("/test/analog-clock?scenario=default&hour=10&min=10");
    const svg = page.getByTestId("analog-clock");
    await expect(svg).toHaveAttribute("overflow", "visible");
  });

  test("does not render a floating label for an event whose title fits inside the arc", async ({
    page,
  }) => {
    await page.goto("/test/analog-clock?scenario=default&hour=10&min=10");
    // d1 ("Family Game Night") sits on a 45° arc — fits across two lines.
    await expect(page.getByTestId("event-title-d1")).toBeVisible();
    await expect(page.getByTestId("floating-label-d1")).toHaveCount(0);
  });

  test("captures a screenshot of the default scenario showing the floating label layer", async ({
    page,
  }) => {
    await page.goto("/test/analog-clock?scenario=default&hour=10&min=10");
    await expect(page.getByTestId("analog-clock")).toBeVisible();
    await expect(page.getByTestId("floating-label-d3")).toBeVisible();
    await page.screenshot({
      path: "test-results/screenshots/clock-floating-labels-default.png",
      fullPage: true,
    });
  });
});
