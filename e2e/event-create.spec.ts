import { expect, test } from "@playwright/test";

/**
 * E2E tests for the event creation flow introduced in #82.
 *
 * Uses the MockCalendarProvider test fixture at /test/calendar so the flow
 * can be exercised without a real Google Calendar session. Event submission
 * goes through CalendarProvider.addEvent(IEvent), which immediately renders
 * the event in the month grid.
 *
 * Video capture is enabled for this suite so the PR can visually document
 * the feature. Screenshots from the test run should be attached to the PR.
 */

test.use({ video: "retain-on-failure" });

test.describe("Event creation dialog", () => {
  test("opens the dialog from the toolbar button", async ({ page }) => {
    await page.goto("/test/calendar?events=empty&view=month");

    const addBtn = page.getByTestId("calendar-add-event-btn");
    await expect(addBtn).toBeVisible();

    await addBtn.click();

    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await expect(
      dialog.getByRole("heading", { name: /create event/i })
    ).toBeVisible();
  });

  test("Create button is disabled until a title is entered", async ({
    page,
  }) => {
    await page.goto("/test/calendar?events=empty&view=month");
    await page.getByTestId("calendar-add-event-btn").click();

    const dialog = page.getByRole("dialog");
    const create = dialog.getByRole("button", { name: /create event/i });

    await expect(create).toBeDisabled();

    await dialog.getByLabel(/title/i).fill("Dinner");
    await expect(create).toBeEnabled();
  });

  test("shows inline validation error when end is before start", async ({
    page,
  }) => {
    await page.goto("/test/calendar?events=empty&view=month");
    await page.getByTestId("calendar-add-event-btn").click();

    const dialog = page.getByRole("dialog");
    await dialog.getByLabel(/title/i).fill("Impossible meeting");

    const start = dialog.getByLabel(/^start/i);
    const end = dialog.getByLabel(/^end/i);

    // Put end BEFORE start
    await start.fill("2026-05-01T10:00");
    await end.fill("2026-05-01T09:00");

    await expect(dialog.getByText(/end must be after start/i)).toBeVisible();
    await expect(
      dialog.getByRole("button", { name: /create event/i })
    ).toBeDisabled();
  });

  test("creates an event and renders it on the calendar", async ({ page }) => {
    await page.goto("/test/calendar?events=empty&view=month");

    await page.getByTestId("calendar-add-event-btn").click();
    const dialog = page.getByRole("dialog");

    await dialog.getByLabel(/title/i).fill("Team offsite");
    await dialog.getByLabel(/description/i).fill("All-hands in the mountains");
    await dialog.getByRole("radio", { name: /purple/i }).check();
    await dialog.getByRole("button", { name: /create event/i }).click();

    // Dialog should close
    await expect(dialog).not.toBeVisible();

    // Event should be visible in the calendar grid exactly once. The dialog
    // seeds from the currently selected date (today) so the new event lands
    // somewhere in the current month view.
    await expect(page.getByText("Team offsite")).toHaveCount(1);
    await expect(page.getByText("Team offsite")).toBeVisible();
  });

  test("Cancel closes the dialog without creating an event", async ({
    page,
  }) => {
    await page.goto("/test/calendar?events=empty&view=month");

    await page.getByTestId("calendar-add-event-btn").click();
    const dialog = page.getByRole("dialog");

    await dialog.getByLabel(/title/i).fill("Not happening");
    await dialog.getByRole("button", { name: /cancel/i }).click();

    await expect(dialog).not.toBeVisible();
    await expect(page.getByText("Not happening")).not.toBeVisible();
  });

  test("switches start and end inputs to date-only when All day is checked", async ({
    page,
  }) => {
    await page.goto("/test/calendar?events=empty&view=month");

    await page.getByTestId("calendar-add-event-btn").click();
    const dialog = page.getByRole("dialog");

    const start = dialog.getByLabel(/^start/i);
    const end = dialog.getByLabel(/^end/i);

    await expect(start).toHaveAttribute("type", "datetime-local");
    await expect(end).toHaveAttribute("type", "datetime-local");

    await dialog.getByRole("checkbox", { name: /all day/i }).check();

    await expect(start).toHaveAttribute("type", "date");
    await expect(end).toHaveAttribute("type", "date");
  });

  test("resets the form when reopened after cancel", async ({ page }) => {
    await page.goto("/test/calendar?events=empty&view=month");

    // First attempt — type then cancel
    await page.getByTestId("calendar-add-event-btn").click();
    let dialog = page.getByRole("dialog");
    await dialog.getByLabel(/title/i).fill("Draft title");
    await dialog.getByRole("button", { name: /cancel/i }).click();
    await expect(dialog).not.toBeVisible();

    // Reopen — title input should be empty
    await page.getByTestId("calendar-add-event-btn").click();
    dialog = page.getByRole("dialog");
    await expect(dialog.getByLabel(/title/i)).toHaveValue("");
  });
});
