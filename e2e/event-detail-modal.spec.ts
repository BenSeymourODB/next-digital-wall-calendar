import { expect, test } from "@playwright/test";

/**
 * E2E tests for the EventDetailModal — issue #81.
 *
 * Verifies clicking an event in both month and agenda views opens a modal
 * showing that event's details, and the modal can be dismissed via the
 * close button or Escape key.
 */

test.describe("Event detail modal — month view", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/test/calendar?events=default&view=month");
  });

  test("opens when an event is clicked", async ({ page }) => {
    await expect(page.getByRole("dialog")).not.toBeVisible();

    await page.getByRole("button", { name: "Morning Standup" }).click();

    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await expect(
      dialog.getByRole("heading", { name: "Morning Standup" })
    ).toBeVisible();
  });

  test("displays the event description", async ({ page }) => {
    await page.getByRole("button", { name: "Morning Standup" }).click();

    const description = page.getByTestId("event-detail-description");
    await expect(description).toHaveText("Daily team standup meeting");
  });

  test("displays the event time range in 24-hour format", async ({ page }) => {
    await page.getByRole("button", { name: "Morning Standup" }).click();

    await expect(page.getByTestId("event-detail-time")).toHaveText(
      "09:00 – 09:30"
    );
  });

  test("displays the event date", async ({ page }) => {
    await page.getByRole("button", { name: "Morning Standup" }).click();

    const date = page.getByTestId("event-detail-date");
    await expect(date).toBeVisible();
    // Full weekday + month + day + year (e.g. "Monday, April 20, 2026")
    await expect(date).toHaveText(/\w+, \w+ \d+, \d{4}/);
  });

  test("closes when the close button is clicked", async ({ page }) => {
    await page.getByRole("button", { name: "Morning Standup" }).click();
    await expect(page.getByRole("dialog")).toBeVisible();

    await page.getByRole("button", { name: /close/i }).click();

    await expect(page.getByRole("dialog")).not.toBeVisible();
  });

  test("closes when Escape is pressed", async ({ page }) => {
    await page.getByRole("button", { name: "Morning Standup" }).click();
    await expect(page.getByRole("dialog")).toBeVisible();

    await page.keyboard.press("Escape");

    await expect(page.getByRole("dialog")).not.toBeVisible();
  });

  test("shows the color indicator for the clicked event", async ({ page }) => {
    // Morning Standup is blue
    await page.getByRole("button", { name: "Morning Standup" }).click();

    const indicator = page.getByTestId("event-detail-color");
    await expect(indicator).toHaveAttribute("data-color", "blue");
  });
});

test.describe("Event detail modal — agenda view", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/test/calendar?events=default&view=agenda");
  });

  test("opens when an event card is clicked", async ({ page }) => {
    await expect(page.getByRole("dialog")).not.toBeVisible();

    await page.getByRole("button", { name: /Client Call/ }).click();

    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await expect(
      dialog.getByRole("heading", { name: "Client Call" })
    ).toBeVisible();
  });

  test("displays the event description inside the modal", async ({ page }) => {
    await page.getByRole("button", { name: /Client Call/ }).click();

    await expect(page.getByTestId("event-detail-description")).toHaveText(
      "Important client meeting"
    );
  });

  test("displays the event time range", async ({ page }) => {
    await page.getByRole("button", { name: /Client Call/ }).click();

    await expect(page.getByTestId("event-detail-time")).toHaveText(
      "10:00 – 11:00"
    );
  });

  test("closes when Escape is pressed", async ({ page }) => {
    await page.getByRole("button", { name: /Client Call/ }).click();
    await expect(page.getByRole("dialog")).toBeVisible();

    await page.keyboard.press("Escape");

    await expect(page.getByRole("dialog")).not.toBeVisible();
  });
});

test.describe("Event detail modal — time format", () => {
  test("shows 12-hour time when the calendar is configured for 12-hour format", async ({
    page,
  }) => {
    await page.goto("/test/calendar?events=default&view=month&24hour=false");

    await page.getByRole("button", { name: "Morning Standup" }).click();

    await expect(page.getByTestId("event-detail-time")).toHaveText(
      "9:00 AM – 9:30 AM"
    );
  });
});

test.describe("Event detail modal — keyboard navigation", () => {
  test("event buttons are keyboard focusable", async ({ page }) => {
    await page.goto("/test/calendar?events=single&view=month");

    const eventButton = page.getByRole("button", { name: "Single Event" });
    await eventButton.focus();
    await expect(eventButton).toBeFocused();

    await page.keyboard.press("Enter");

    await expect(page.getByRole("dialog")).toBeVisible();
  });
});
