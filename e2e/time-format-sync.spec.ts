/**
 * E2E coverage for the cross-surface `timeFormat` sync introduced in
 * #337. The fixture page mounts `SettingsForm` (the main Settings page)
 * next to an isolated `useUserSettings` probe; toggling the form must
 * propagate through the in-tab user-settings bus to the probe so the
 * calendar surface re-renders without a reload.
 */
import { expect, test } from "@playwright/test";

test.describe("Cross-surface timeFormat sync (#337)", () => {
  test.beforeEach(async ({ page }) => {
    // Mock /api/settings PUTs so SettingsForm.updateSettings completes
    // its happy path (and emits to the bus). The fixture page itself
    // doesn't run an authenticated session, so we just rubber-stamp.
    await page.route("**/api/settings", (route) => {
      const method = route.request().method();
      if (method === "PUT" || method === "GET") {
        return route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({}),
        });
      }
      return route.continue();
    });
    await page.goto("/test/time-format-sync");
  });

  test("the probe starts at the form's initial timeFormat (12h)", async ({
    page,
  }) => {
    const probe = page.getByTestId("probe-time-format");
    await expect(probe).toHaveText("12h");
  });

  test("toggling 24-hour in the Settings form updates the probe via the bus", async ({
    page,
  }) => {
    const probe = page.getByTestId("probe-time-format");
    await expect(probe).toHaveText("12h");

    // Use the form's 24-hour radio button. The radios are named
    // `timeFormat`; pick by accessible name to avoid coupling to layout.
    await page.getByRole("radio", { name: "24-hour" }).click();

    // The probe is a separate `useUserSettings` instance — only the bus
    // can update it without a reload.
    await expect(probe).toHaveText("24h");
  });

  test("toggling back to 12-hour propagates to the probe", async ({ page }) => {
    await page.getByRole("radio", { name: "24-hour" }).click();
    await expect(page.getByTestId("probe-time-format")).toHaveText("24h");

    await page.getByRole("radio", { name: "12-hour" }).click();
    await expect(page.getByTestId("probe-time-format")).toHaveText("12h");
  });

  test("does not write `use24HourFormat` to localStorage on settings change (#337)", async ({
    page,
  }) => {
    await page.getByRole("radio", { name: "24-hour" }).click();
    await expect(page.getByTestId("probe-time-format")).toHaveText("24h");

    const calendarSettings = await page.evaluate(() =>
      window.localStorage.getItem("calendar-settings")
    );
    if (calendarSettings) {
      const parsed = JSON.parse(calendarSettings) as Record<string, unknown>;
      expect(parsed).not.toHaveProperty("use24HourFormat");
    }
  });
});
