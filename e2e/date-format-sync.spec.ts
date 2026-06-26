/**
 * E2E coverage for the cross-surface `dateFormat` sync introduced in
 * #339, mirroring `e2e/time-format-sync.spec.ts` (#337). The fixture
 * page mounts an isolated `useUserSettings` writer next to a probe;
 * writing the form must propagate through the in-tab user-settings bus
 * to the probe so any calendar/settings surface re-renders without a
 * reload.
 */
import { expect, test } from "@playwright/test";

test.describe("Cross-surface dateFormat sync (#339)", () => {
  test.beforeEach(async ({ page }) => {
    // Rubber-stamp `/api/settings` so the writer's `mutate` resolves
    // its optimistic path and emits to the bus. The fixture page is
    // unauthenticated, so a 200 with empty body is all the writer
    // needs to keep going.
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
    await page.goto("/test/date-format-sync");
  });

  test("the probe starts at MM/DD/YYYY (default)", async ({ page }) => {
    await expect(page.getByTestId("probe-date-format")).toHaveText(
      "MM/DD/YYYY"
    );
    await expect(page.getByTestId("probe-date-sample")).toHaveText(
      "03/05/2026"
    );
  });

  test("switching to DD/MM/YYYY in the writer updates the probe via the bus", async ({
    page,
  }) => {
    const probeFormat = page.getByTestId("probe-date-format");
    const probeSample = page.getByTestId("probe-date-sample");

    await page
      .getByTestId("writer-date-format")
      .selectOption({ value: "DD/MM/YYYY" });

    await expect(probeFormat).toHaveText("DD/MM/YYYY");
    await expect(probeSample).toHaveText("05/03/2026");
  });

  test("switching to YYYY-MM-DD propagates to the probe", async ({ page }) => {
    await page
      .getByTestId("writer-date-format")
      .selectOption({ value: "YYYY-MM-DD" });

    await expect(page.getByTestId("probe-date-format")).toHaveText(
      "YYYY-MM-DD"
    );
    await expect(page.getByTestId("probe-date-sample")).toHaveText(
      "2026-03-05"
    );
  });

  test("returning to MM/DD/YYYY propagates back", async ({ page }) => {
    await page
      .getByTestId("writer-date-format")
      .selectOption({ value: "DD/MM/YYYY" });
    await expect(page.getByTestId("probe-date-format")).toHaveText(
      "DD/MM/YYYY"
    );

    await page
      .getByTestId("writer-date-format")
      .selectOption({ value: "MM/DD/YYYY" });
    await expect(page.getByTestId("probe-date-format")).toHaveText(
      "MM/DD/YYYY"
    );
    await expect(page.getByTestId("probe-date-sample")).toHaveText(
      "03/05/2026"
    );
  });
});
