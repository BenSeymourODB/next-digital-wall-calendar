import { expect, test } from "@playwright/test";

test.describe("AnalogClockView (calendar page wiring)", () => {
  test("renders the analog clock when ?view=clock", async ({ page }) => {
    await page.goto("/test/calendar?events=default&view=clock");

    await expect(page.getByTestId("analog-clock-view")).toBeVisible();
    await expect(page.getByTestId("analog-clock")).toBeVisible();
  });

  test("Clock button in ViewSwitcher is highlighted when active", async ({
    page,
  }) => {
    await page.goto("/test/calendar?events=default&view=clock");

    const clockBtn = page.getByTestId("view-switcher-clock");
    await expect(clockBtn).toHaveAttribute("aria-pressed", "true");
  });

  test("switches into clock view from month via the Clock button", async ({
    page,
  }) => {
    await page.goto("/test/calendar?events=default&view=month");

    await expect(page.getByTestId("analog-clock-view")).toHaveCount(0);

    await page.getByTestId("view-switcher-clock").click();

    await expect(page.getByTestId("analog-clock-view")).toBeVisible();
    await expect(page.getByTestId("analog-clock")).toBeVisible();
  });

  test("switching away and back to clock keeps it functional", async ({
    page,
  }) => {
    await page.goto("/test/calendar?events=default&view=clock");
    await expect(page.getByTestId("analog-clock-view")).toBeVisible();

    await page.getByTestId("view-switcher-month").click();
    await expect(page.getByTestId("analog-clock-view")).toHaveCount(0);

    await page.getByTestId("view-switcher-clock").click();
    await expect(page.getByTestId("analog-clock-view")).toBeVisible();
    await expect(page.getByTestId("analog-clock")).toBeVisible();
  });

  test("renders the all-day sidebar in empty state with no events", async ({
    page,
  }) => {
    await page.goto("/test/calendar?events=empty&view=clock");

    await expect(page.getByTestId("analog-clock-view")).toBeVisible();
    await expect(page.getByTestId("analog-clock-all-day-empty")).toBeVisible();
    await expect(page.getByTestId("analog-clock-all-day-list")).toHaveCount(0);
  });
});
