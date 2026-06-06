import { expect, test } from "@playwright/test";

/**
 * E2E tests for the CalendarFilterPanel.
 *
 * Renders against `/test/calendar?events=family&filters=true&view=agenda` so we
 * drive a deterministic `MockCalendarProvider` populated with multi-user,
 * multi-color events. Video-on captures the popover interactions + list reflow.
 */

test.use({ video: "on" });

test.describe("CalendarFilterPanel", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(
      "/test/calendar?events=family&filters=true&view=agenda&controls=false"
    );
  });

  test("renders both filter triggers alongside the view switcher", async ({
    page,
  }) => {
    await expect(page.getByTestId("calendar-filter-panel")).toBeVisible();
    await expect(page.getByTestId("filter-panel-color-trigger")).toBeVisible();
    await expect(page.getByTestId("filter-panel-user-trigger")).toBeVisible();
    // No clear button before any filter is applied.
    await expect(page.getByTestId("filter-panel-clear")).not.toBeAttached();
  });

  test("toggling a color hides events of that color and shows a Clear button", async ({
    page,
  }) => {
    // Baseline: the blue "Work Meeting" from the family data set is visible.
    await expect(page.getByText("Work Meeting")).toBeVisible();

    await page.getByTestId("filter-panel-color-trigger").click();
    const colorPopover = page.getByTestId("filter-panel-color-popover");
    await expect(colorPopover).toBeVisible();

    // Select `blue` → enable it as a positive filter.
    await colorPopover.getByTestId("filter-panel-color-option-blue").click();

    // Close popover and check state.
    await page.keyboard.press("Escape");

    // Count badge reflects the one active color.
    await expect(page.getByTestId("filter-panel-color-count")).toHaveText("1");

    // Clear filter action is now present.
    await expect(page.getByTestId("filter-panel-clear")).toBeVisible();

    // Only blue events remain: "Work Meeting" (blue) should still be visible,
    // while the green "Grocery Shopping" and "Soccer Practice" should not.
    await expect(page.getByText("Work Meeting")).toBeVisible();
    await expect(page.getByText("Grocery Shopping")).not.toBeVisible();
    await expect(page.getByText("Soccer Practice")).not.toBeVisible();
  });

  test("selecting a user hides other users' events", async ({ page }) => {
    // Baseline: events for multiple users are present.
    await expect(page.getByText("Work Meeting")).toBeVisible(); // Mom
    await expect(page.getByText("Soccer Practice")).toBeVisible(); // Emma

    await page.getByTestId("filter-panel-user-trigger").click();
    const userPopover = page.getByTestId("filter-panel-user-popover");
    await expect(userPopover).toBeVisible();

    // All + 4 users from `family` (Mom, Emma, Jack, and the shared "Family"
    // calendar pseudo-user, not an individual profile).
    await expect(
      userPopover.getByTestId("filter-panel-user-option-all")
    ).toBeVisible();

    // Select Mom.
    await userPopover.getByTestId("filter-panel-user-option-parent-1").click();

    await page.keyboard.press("Escape");

    // Trigger now reflects Mom as the active user.
    await expect(page.getByTestId("filter-panel-user-trigger")).toContainText(
      "Mom"
    );

    // Mom's events remain; Emma's and Jack's do not.
    await expect(page.getByText("Work Meeting")).toBeVisible();
    await expect(page.getByText("Grocery Shopping")).toBeVisible();
    await expect(page.getByText("Soccer Practice")).not.toBeVisible();
    await expect(page.getByText("Piano Lesson")).not.toBeVisible();
    await expect(page.getByText("Art Class")).not.toBeVisible();
  });

  test("Clear filters restores all events", async ({ page }) => {
    // Apply a discriminating color+user intersection: purple + Emma (kid-1).
    // Emma has both green (Soccer Practice) and purple (Piano Lesson) events,
    // so the color filter proves it's doing work on top of the user filter —
    // Soccer Practice is hidden by color while Piano Lesson survives.
    await page.getByTestId("filter-panel-color-trigger").click();
    await page
      .getByTestId("filter-panel-color-popover")
      .getByTestId("filter-panel-color-option-purple")
      .click();
    await page.keyboard.press("Escape");

    await page.getByTestId("filter-panel-user-trigger").click();
    await page
      .getByTestId("filter-panel-user-popover")
      .getByTestId("filter-panel-user-option-kid-1")
      .click();
    await page.keyboard.press("Escape");

    // Mom's Work Meeting (blue) is hidden by the user filter.
    await expect(page.getByText("Work Meeting")).not.toBeVisible();
    // Emma's Soccer Practice (green) is hidden by the color filter — proves
    // the color filter is actually applied on top of the user filter.
    await expect(page.getByText("Soccer Practice")).not.toBeVisible();
    // Emma's Piano Lesson (purple) survives both filters.
    await expect(page.getByText("Piano Lesson")).toBeVisible();

    // Clear.
    await page.getByTestId("filter-panel-clear").click();

    // Filters are gone and hidden events are back.
    await expect(
      page.getByTestId("filter-panel-color-count")
    ).not.toBeAttached();
    await expect(page.getByTestId("filter-panel-clear")).not.toBeAttached();
    await expect(page.getByText("Work Meeting")).toBeVisible();
    await expect(page.getByText("Soccer Practice")).toBeVisible();
  });
});
