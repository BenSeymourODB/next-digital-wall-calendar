import { expect, test } from "@playwright/test";

// Retain video only when a test fails so the interaction flow can be replayed
// without accumulating artifacts on every passing run.
test.use({ video: "retain-on-failure" });

test.describe("Agenda Calendar — Search", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/test/calendar?events=default&view=agenda");
    await expect(page.getByText("Upcoming Events")).toBeVisible();
  });

  test("renders the search input", async ({ page }) => {
    await expect(page.getByTestId("agenda-search-input")).toBeVisible();
  });

  test("filters events in real time as the user types", async ({ page }) => {
    // Baseline: multiple default events are visible
    await expect(page.getByText("Morning Standup")).toBeVisible();
    await expect(page.getByText("Project Review")).toBeVisible();

    const input = page.getByTestId("agenda-search-input");
    await input.fill("standup");

    await expect(page.getByText("Morning Standup")).toBeVisible();
    await expect(page.getByText("Project Review")).not.toBeVisible();
  });

  test("matches against event descriptions", async ({ page }) => {
    // "Daily team standup meeting" is the description of the Morning Standup event
    await page.getByTestId("agenda-search-input").fill("daily team");
    await expect(page.getByText("Morning Standup")).toBeVisible();
    await expect(page.getByText("Project Review")).not.toBeVisible();
  });

  test("is case-insensitive", async ({ page }) => {
    await page.getByTestId("agenda-search-input").fill("PROJECT");
    await expect(page.getByText("Project Review")).toBeVisible();
    await expect(page.getByText("Morning Standup")).not.toBeVisible();
  });

  test("shows 'no matches' state when the query filters out everything", async ({
    page,
  }) => {
    await page.getByTestId("agenda-search-input").fill("xyzzy-unlikely-query");
    await expect(page.getByText(/no events match/i)).toBeVisible();
    await expect(page.getByText("Morning Standup")).not.toBeVisible();
  });

  test("clear button restores the full list", async ({ page }) => {
    const input = page.getByTestId("agenda-search-input");
    await input.fill("standup");
    await expect(page.getByText("Project Review")).not.toBeVisible();

    await page.getByTestId("agenda-search-clear").click();

    await expect(input).toHaveValue("");
    await expect(page.getByText("Morning Standup")).toBeVisible();
    await expect(page.getByText("Project Review")).toBeVisible();
  });
});

test.describe("Agenda Calendar — Group By", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/test/calendar?events=default&view=agenda");
    await expect(page.getByText("Upcoming Events")).toBeVisible();
  });

  test("group-by-date is the initial grouping", async ({ page }) => {
    // Date headers look like "Monday, January 13"
    const firstHeader = page.locator("h3").first();
    const text = await firstHeader.textContent();
    expect(text).toMatch(/\w+, \w+ \d+/);
  });

  test("clicking 'Group by color' switches to color-grouped headers", async ({
    page,
  }) => {
    await page.getByRole("button", { name: /group by color/i }).click();

    // After switching, at least one header should be a color name.
    // Default events span blue, green, yellow, purple, red, orange.
    const headers = page.locator("h3");
    await expect(headers.first()).toBeVisible();

    const headerTexts = await headers.allTextContents();
    const colorPattern = /^(Blue|Green|Red|Yellow|Purple|Orange)$/;
    expect(headerTexts.some((t) => colorPattern.test(t.trim()))).toBe(true);
  });

  test("search narrows results within the color grouping", async ({ page }) => {
    await page.getByRole("button", { name: /group by color/i }).click();
    await page.getByTestId("agenda-search-input").fill("standup");

    await expect(page.getByText("Morning Standup")).toBeVisible();
    await expect(page.getByText("Project Review")).not.toBeVisible();
  });
});
