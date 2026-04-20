import { type Page, expect, test } from "@playwright/test";

/**
 * E2E tests for the left-side navigation bar (PR #132).
 *
 * Uses video capture to verify that clicking a nav icon:
 *   - Triggers a slide transition between screens
 *   - Updates the active-icon highlight to the new route
 *
 * Videos are saved to test-results/ for visual inspection.
 */

test.use({
  video: "on",
  viewport: { width: 1280, height: 720 },
  // Allow pinning the browser binary via PLAYWRIGHT_CHROME_BIN for
  // restricted-network environments; otherwise use the default Playwright
  // install.
  ...(process.env.PLAYWRIGHT_CHROME_BIN
    ? { launchOptions: { executablePath: process.env.PLAYWRIGHT_CHROME_BIN } }
    : {}),
});

/** Click the side-nav link with the given accessible name. */
async function clickNavLink(page: Page, label: string) {
  const nav = page.getByRole("navigation", { name: /main navigation/i });
  await nav.getByRole("link", { name: label }).click();
}

/** Assert the side-nav link with the given label is the active (aria-current) one. */
async function expectActiveNavLink(page: Page, label: string) {
  const nav = page.getByRole("navigation", { name: /main navigation/i });
  await expect(nav.getByRole("link", { name: label })).toHaveAttribute(
    "aria-current",
    "page"
  );
}

test.describe("Side navigation bar transitions", () => {
  test("clicking nav icons slides between screens and highlights active icon", async ({
    page,
  }) => {
    // Land on /calendar to mount the AppShell + nav
    await page.goto("/calendar");
    await expect(
      page.getByRole("navigation", { name: /main navigation/i })
    ).toBeVisible();
    await expect(page.getByTestId("screen-transition")).toBeVisible();
    await expectActiveNavLink(page, "Calendar");

    // /calendar -> /recipe (forward)
    await clickNavLink(page, "Recipe");
    await expect(page).toHaveURL(/\/recipe$/);
    await expectActiveNavLink(page, "Recipe");
    // Give the 400ms slide animation time to finish before the next click
    await page.waitForTimeout(600);

    // /recipe -> /profiles (forward)
    await clickNavLink(page, "Profiles");
    await expect(page).toHaveURL(/\/profiles$/);
    await expectActiveNavLink(page, "Profiles");
    await page.waitForTimeout(600);

    // NOTE: /settings requires an authenticated session (redirects to
    // /api/auth/signin otherwise), so we cover the "backward" direction
    // by jumping back to an earlier NAV_ITEMS entry from /profiles.

    // /profiles -> /calendar (backward — earlier in NAV_ITEMS)
    await clickNavLink(page, "Calendar");
    await expect(page).toHaveURL(/\/calendar$/);
    await expectActiveNavLink(page, "Calendar");
    await page.waitForTimeout(600);

    // /calendar -> /recipe (forward, final leg — confirms repeat navigation works)
    await clickNavLink(page, "Recipe");
    await expect(page).toHaveURL(/\/recipe$/);
    await expectActiveNavLink(page, "Recipe");
    await page.waitForTimeout(600);
  });

  test("transition wrapper renders a sliding outgoing layer during navigation", async ({
    page,
  }) => {
    await page.goto("/calendar");
    await expect(page.getByTestId("screen-transition")).toBeVisible();

    // Kick off a navigation and immediately assert the outgoing layer appears
    const recipeLink = page
      .getByRole("navigation", { name: /main navigation/i })
      .getByRole("link", { name: "Recipe" });

    await Promise.all([page.waitForURL(/\/recipe$/), recipeLink.click()]);

    // During the exit phase (up to 400ms), both outgoing and incoming layers exist.
    // We check for the outgoing layer within that window.
    const outgoing = page.getByTestId("transition-outgoing");
    await expect(outgoing).toBeVisible({ timeout: 500 });

    // And after the animation settles we return to idle
    await expect(page.getByTestId("transition-idle")).toBeVisible({
      timeout: 2000,
    });
  });
});
