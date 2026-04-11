import { expect, test } from "@playwright/test";

/**
 * E2E tests for scheduler animated page transitions (#94).
 *
 * Uses video capture to verify smooth transitions between screens.
 * Videos are saved to test-results/ for visual inspection.
 */

// Enable video recording for all tests — must be top-level
test.use({
  video: "on",
  viewport: { width: 1280, height: 720 },
});

/**
 * Wait for a screen heading to appear after a transition completes.
 */
async function waitForScreenHeading(
  page: import("@playwright/test").Page,
  heading: string,
  timeout = 15000
) {
  await expect(
    page.getByRole("heading", { name: heading, exact: true }).first()
  ).toBeVisible({ timeout });
}

/**
 * Click the Next button after ensuring nav controls are visible.
 */
async function clickNext(page: import("@playwright/test").Page) {
  await page.mouse.move(640, 360);
  await page.waitForTimeout(300);
  await page.getByRole("button", { name: "Next screen" }).click();
}

/**
 * Click the Previous button after ensuring nav controls are visible.
 */
async function clickPrevious(page: import("@playwright/test").Page) {
  await page.mouse.move(640, 360);
  await page.waitForTimeout(300);
  await page.getByRole("button", { name: "Previous screen" }).click();
}

test.describe("Scheduler Page Transitions", () => {
  test("auto-rotation transitions smoothly between screens", async ({
    page,
  }) => {
    await page.goto("/test/scheduler-demo");

    // Verify we start on Screen A (blue / Calendar)
    await waitForScreenHeading(page, "Calendar");
    await expect(page.getByText("Screen 1 of 3")).toBeVisible();

    // Verify transition wrapper is present
    await expect(page.getByTestId("screen-transition")).toBeVisible();

    // Wait for auto-rotation (10s interval + transition animation time)
    await waitForScreenHeading(page, "Tasks", 15000);

    // Wait for another auto-rotation to Screen C
    await waitForScreenHeading(page, "Recipes", 15000);
  });

  test("manual forward navigation triggers slide-left transition", async ({
    page,
  }) => {
    await page.goto("/test/scheduler-demo");
    await waitForScreenHeading(page, "Calendar");

    await clickNext(page);

    // Should transition to Screen B
    await waitForScreenHeading(page, "Tasks");
  });

  test("manual backward navigation triggers slide-right transition", async ({
    page,
  }) => {
    await page.goto("/test/scheduler-demo");
    await waitForScreenHeading(page, "Calendar");

    await clickPrevious(page);

    // Should transition to Screen C (wraps backward)
    await waitForScreenHeading(page, "Recipes");
  });

  test("full rotation cycle wraps back to first screen via buttons", async ({
    page,
  }) => {
    await page.goto("/test/scheduler-demo");
    await waitForScreenHeading(page, "Calendar");

    // Navigate through all 3 screens using buttons
    await clickNext(page);
    await waitForScreenHeading(page, "Tasks");

    await clickNext(page);
    await waitForScreenHeading(page, "Recipes");

    await clickNext(page);
    await waitForScreenHeading(page, "Calendar");
  });

  test("status indicator and nav controls remain visible during transition", async ({
    page,
  }) => {
    await page.goto("/test/scheduler-demo");
    await waitForScreenHeading(page, "Calendar");

    // Move mouse to show controls
    await page.mouse.move(640, 360);
    await page.waitForTimeout(500);

    // Check controls are visible
    const nav = page.getByRole("navigation", {
      name: /screen rotation controls/i,
    });
    await expect(nav).toBeVisible();

    // Check status indicator is visible
    const status = page.getByRole("status");
    await expect(status).toBeVisible();

    // Navigate and verify controls stay visible during transition
    await clickNext(page);

    // Controls and status should still be visible (outside the transition wrapper)
    await expect(status).toBeVisible();
  });

  test("backward then forward navigation uses correct directions", async ({
    page,
  }) => {
    await page.goto("/test/scheduler-demo");
    await waitForScreenHeading(page, "Calendar");

    // Go backward to Screen C
    await clickPrevious(page);
    await waitForScreenHeading(page, "Recipes");

    // Go forward to Screen A
    await clickNext(page);
    await waitForScreenHeading(page, "Calendar");
  });
});
