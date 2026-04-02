import { expect, test } from "@playwright/test";

test.describe("Radial Clock - Default Events (AM)", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/test/radial-clock?events=default");
  });

  test("renders the radial clock component", async ({ page }) => {
    await expect(page.getByTestId("radial-clock")).toBeVisible();
  });

  test("displays the clock face with hour numbers", async ({ page }) => {
    await expect(page.getByTestId("clock-face")).toBeVisible();

    // Check key hour numbers are rendered
    for (const hour of [12, 3, 6, 9]) {
      await expect(page.getByTestId(`hour-number-${hour}`)).toBeVisible();
    }
  });

  test("shows AM indicator for morning period", async ({ page }) => {
    await expect(page.getByTestId("ampm-indicator")).toContainText("AM");
  });

  test("renders clock hands", async ({ page }) => {
    await expect(page.getByTestId("hour-hand")).toBeVisible();
    await expect(page.getByTestId("minute-hand")).toBeVisible();
    await expect(page.getByTestId("second-hand")).toBeVisible();
  });

  test("displays event arcs for AM events", async ({ page }) => {
    // Default set has events in AM period
    await expect(page.getByTestId("event-arc-morning-standup")).toBeVisible();
    await expect(page.getByTestId("event-arc-gym-session")).toBeVisible();
    await expect(page.getByTestId("event-arc-team-lunch")).toBeVisible();
    await expect(page.getByTestId("event-arc-code-review")).toBeVisible();
    await expect(page.getByTestId("event-arc-breakfast")).toBeVisible();
  });

  test("renders the arc ring background", async ({ page }) => {
    await expect(page.getByTestId("arc-ring-background")).toBeVisible();
  });

  test("has correct ARIA label with event count", async ({ page }) => {
    const svg = page.locator("svg[role='img']");
    await expect(svg).toHaveAttribute("aria-label", /5 events.*AM period/);
  });

  test("displays event list below clock", async ({ page }) => {
    await expect(page.getByTestId("event-list")).toBeVisible();
    await expect(
      page.getByTestId("event-list-item-morning-standup")
    ).toBeVisible();
  });
});

test.describe("Radial Clock - PM Events", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/test/radial-clock?events=pm&period=pm");
  });

  test("shows PM indicator for afternoon period", async ({ page }) => {
    await expect(page.getByTestId("ampm-indicator")).toContainText("PM");
  });

  test("displays PM event arcs", async ({ page }) => {
    await expect(page.getByTestId("event-arc-pm-meeting")).toBeVisible();
    await expect(page.getByTestId("event-arc-pm-workshop")).toBeVisible();
    await expect(page.getByTestId("event-arc-pm-dinner")).toBeVisible();
    await expect(page.getByTestId("event-arc-pm-movie")).toBeVisible();
  });
});

test.describe("Radial Clock - Empty State", () => {
  test("renders clock without event arcs", async ({ page }) => {
    await page.goto("/test/radial-clock?events=empty");

    await expect(page.getByTestId("radial-clock")).toBeVisible();
    await expect(page.getByTestId("clock-face")).toBeVisible();

    // Event arcs container should be empty
    const arcs = page.getByTestId("event-arcs");
    await expect(arcs).toBeVisible();
    const arcChildren = arcs.locator(".event-arc");
    await expect(arcChildren).toHaveCount(0);
  });

  test("ARIA label reflects zero events", async ({ page }) => {
    await page.goto("/test/radial-clock?events=empty");
    const svg = page.locator("svg[role='img']");
    await expect(svg).toHaveAttribute("aria-label", /0 events/);
  });
});

test.describe("Radial Clock - Color Variations", () => {
  test("renders arcs for all color-coded events", async ({ page }) => {
    await page.goto("/test/radial-clock?events=colors");

    const colors = ["red", "orange", "yellow", "green", "blue", "purple"];
    for (const color of colors) {
      await expect(page.getByTestId(`event-arc-color-${color}`)).toBeVisible();
    }
  });
});

test.describe("Radial Clock - Emoji Events", () => {
  test("displays event emojis on arcs", async ({ page }) => {
    await page.goto("/test/radial-clock?events=emoji");

    // Events with explicit event emoji should show them
    await expect(page.getByTestId("event-emoji-emoji-game")).toContainText(
      "🎮"
    );
    await expect(page.getByTestId("event-emoji-emoji-gym")).toContainText("🏋️");
    await expect(page.getByTestId("event-emoji-emoji-food")).toContainText(
      "🍕"
    );
    await expect(page.getByTestId("event-emoji-emoji-music")).toContainText(
      "🎵"
    );
  });
});

test.describe("Radial Clock - All-Day Event Filtering", () => {
  test("excludes all-day events from arcs", async ({ page }) => {
    await page.goto("/test/radial-clock?events=allday");

    // All-day event should NOT have an arc
    await expect(
      page.getByTestId("event-arc-allday-holiday")
    ).not.toBeVisible();

    // Regular event should have an arc
    await expect(page.getByTestId("event-arc-allday-regular")).toBeVisible();
  });
});

test.describe("Radial Clock - Single Event", () => {
  test("renders a single event arc", async ({ page }) => {
    await page.goto("/test/radial-clock?events=single");

    await expect(page.getByTestId("event-arc-single-1")).toBeVisible();

    const svg = page.locator("svg[role='img']");
    await expect(svg).toHaveAttribute("aria-label", /1 events.*AM period/);
  });
});

test.describe("Radial Clock - Overlapping Events", () => {
  test("renders all overlapping event arcs", async ({ page }) => {
    await page.goto("/test/radial-clock?events=overlap");

    await expect(page.getByTestId("event-arc-overlap-1")).toBeVisible();
    await expect(page.getByTestId("event-arc-overlap-2")).toBeVisible();
    await expect(page.getByTestId("event-arc-overlap-3")).toBeVisible();
  });
});

test.describe("Radial Clock - Responsive Size", () => {
  test("respects custom size parameter", async ({ page }) => {
    await page.goto("/test/radial-clock?events=default&size=300");

    const clock = page.getByTestId("radial-clock");
    await expect(clock).toHaveCSS("width", "300px");
    await expect(clock).toHaveCSS("height", "300px");
  });
});

test.describe("Radial Clock - Test Page Navigation", () => {
  test("displays test configuration info", async ({ page }) => {
    await page.goto("/test/radial-clock?events=colors");

    await expect(page.getByTestId("test-config")).toContainText(
      "events=colors"
    );
  });

  test("event set navigation links work", async ({ page }) => {
    await page.goto("/test/radial-clock?events=default");

    // Click on the "empty" link
    await page.getByRole("link", { name: "empty" }).click();

    // Should navigate and show empty config
    await expect(page.getByTestId("test-config")).toContainText("events=empty");

    // Should have no event arcs
    const arcs = page.getByTestId("event-arcs");
    const arcChildren = arcs.locator(".event-arc");
    await expect(arcChildren).toHaveCount(0);
  });
});
