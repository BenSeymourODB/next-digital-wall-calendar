import { expect, test } from "@playwright/test";
import path from "path";

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
 *
 * Color picker note: the radio inputs use `sr-only` (visually hidden) with a
 * colored `<span aria-hidden>` as the visual affordance inside a wrapping
 * `<label>`. Clicking the label (via `.filter({ hasText })`) is the correct
 * user-level interaction and avoids the swatch span intercepting pointer
 * events when `.check()` targets the 1 px sr-only input directly.
 */

test.use({ video: "retain-on-failure" });

const SCREENSHOTS_DIR = path.join(
  __dirname,
  "../docs/screenshots/event-create"
);

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

    await page.screenshot({
      path: path.join(SCREENSHOTS_DIR, "01-dialog-open.png"),
      fullPage: true,
    });
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

    await page.screenshot({
      path: path.join(SCREENSHOTS_DIR, "04-validation-error.png"),
      fullPage: true,
    });
  });

  test("creates an event and renders it on the calendar", async ({ page }) => {
    await page.goto("/test/calendar?events=empty&view=month");

    await page.getByTestId("calendar-add-event-btn").click();
    const dialog = page.getByRole("dialog");

    await dialog.getByLabel(/title/i).fill("Team offsite");
    await dialog.getByLabel(/description/i).fill("All-hands in the mountains");

    // The color picker uses sr-only radio inputs inside <label> wrappers with
    // a colored <span aria-hidden> swatch. Clicking the label (by text) is the
    // correct user-level interaction — direct .check() on the sr-only input
    // fails because the swatch span intercepts pointer events at that position.
    await dialog
      .locator("label")
      .filter({ hasText: /^Purple$/ })
      .click();
    await expect(dialog.getByRole("radio", { name: /purple/i })).toBeChecked();

    await page.screenshot({
      path: path.join(SCREENSHOTS_DIR, "02-dialog-filled.png"),
      fullPage: true,
    });

    await dialog.getByRole("button", { name: /create event/i }).click();

    // Dialog should close
    await expect(dialog).not.toBeAttached();

    // Event should be visible in the calendar grid exactly once. The dialog
    // seeds from the currently selected date (today) so the new event lands
    // somewhere in the current month view.
    await expect(page.getByText("Team offsite")).toHaveCount(1);
    await expect(page.getByText("Team offsite")).toBeVisible();

    await page.screenshot({
      path: path.join(SCREENSHOTS_DIR, "03-event-on-calendar.png"),
      fullPage: true,
    });
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
