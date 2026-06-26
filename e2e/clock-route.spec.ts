/**
 * `/clock` standalone wall-display route — auth-gating (issue #398).
 *
 * Companion to `e2e/authenticated/clock-route.spec.ts`. This spec
 * runs in the unauthenticated browser projects (chromium / firefox /
 * webkit / mobile-chrome / tablet) and asserts that the proxy
 * (`src/proxy.ts`) redirects an unauthenticated visitor at `/clock`
 * through `/auth/signin` with the original path captured in
 * `?callbackUrl=`, matching the other protected pages
 * (`/calendar`, `/settings`, `/dashboard`).
 */
import { expect, test } from "@playwright/test";

test.describe("/clock auth-gating (#398)", () => {
  test("redirects unauthenticated visitors to /auth/signin with callbackUrl", async ({
    page,
  }) => {
    await page.goto("/clock");

    // The middleware redirects before the page renders, so the final
    // URL must land on /auth/signin and preserve /clock as the
    // post-sign-in destination.
    await expect(page).toHaveURL(/\/auth\/signin/);
    expect(page.url()).toContain("callbackUrl=%2Fclock");
  });
});
