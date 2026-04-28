/**
 * QA screenshot capture for PR #144 — searchable/filterable agenda view.
 * Saves PNGs to docs/screenshots/agenda-search/ for the review body.
 */
import { expect, test } from "@playwright/test";

test.use({ video: "retain-on-failure" });

test.describe("QA Screenshots — Agenda Search (#144)", () => {
  test("01-default-agenda — search input visible, events listed", async ({
    page,
  }) => {
    await page.goto("/test/calendar?events=default&view=agenda");
    await expect(page.getByText("Upcoming Events")).toBeVisible();
    await expect(page.getByTestId("agenda-search-input")).toBeVisible();
    await page.screenshot({
      path: "docs/screenshots/agenda-search/01-default-agenda.png",
      fullPage: true,
    });
  });

  test("02-search-filters — typing filters events in real time", async ({
    page,
  }) => {
    await page.goto("/test/calendar?events=default&view=agenda");
    await expect(page.getByText("Upcoming Events")).toBeVisible();
    await page.getByTestId("agenda-search-input").fill("standup");
    await expect(page.getByText("Morning Standup")).toBeVisible();
    await expect(page.getByText("Project Review")).not.toBeVisible();
    await page.screenshot({
      path: "docs/screenshots/agenda-search/02-search-filters.png",
      fullPage: true,
    });
  });

  test("03-no-matches — empty state shown for unmatched query", async ({
    page,
  }) => {
    await page.goto("/test/calendar?events=default&view=agenda");
    await expect(page.getByText("Upcoming Events")).toBeVisible();
    await page.getByTestId("agenda-search-input").fill("xyzzy-unlikely-query");
    await expect(page.getByText(/no events match/i)).toBeVisible();
    await page.screenshot({
      path: "docs/screenshots/agenda-search/03-no-matches.png",
      fullPage: true,
    });
  });

  test("04-color-grouping — group-by color toggle produces color headers", async ({
    page,
  }) => {
    await page.goto("/test/calendar?events=default&view=agenda");
    await expect(page.getByText("Upcoming Events")).toBeVisible();
    await page.getByRole("button", { name: /group by color/i }).click();
    const headers = page.locator("h3");
    await expect(headers.first()).toBeVisible();
    await page.screenshot({
      path: "docs/screenshots/agenda-search/04-color-grouping.png",
      fullPage: true,
    });
  });
});
