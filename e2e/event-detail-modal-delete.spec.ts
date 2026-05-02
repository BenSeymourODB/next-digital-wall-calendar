import { expect, test } from "@playwright/test";

/**
 * E2E for the EventDetailModal delete flow — issue #115.
 *
 * Exercises the full confirmation path against the test calendar's
 * MockCalendarProvider: open modal → click "Delete event" → confirm →
 * modal closes and the event row disappears from month view.
 *
 * The mock provider stubs `deleteEvent` with an in-memory remove (no
 * Google API call) so this test is hermetic; the real network path is
 * covered by the route unit tests.
 */

// Keep video only when something fails so green CI runs don't churn out
// gigabytes of useless artifacts. CLAUDE.md forbids committing them either way,
// but this also keeps the local test-results dir lean.
test.use({ video: "retain-on-failure" });

test.describe("EventDetailModal — delete (#115)", () => {
  test("clicking 'Delete event' and confirming removes the event from the calendar", async ({
    page,
  }) => {
    await page.goto("/test/calendar?events=single&view=month");

    const trigger = page.getByRole("button", { name: "Single Event" });
    await expect(trigger).toBeVisible();

    await trigger.click();

    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();

    const deleteBtn = dialog.getByRole("button", { name: /delete event/i });
    await expect(deleteBtn).toBeVisible();
    await deleteBtn.click();

    const confirm = page.getByRole("alertdialog", {
      name: /delete this event\?/i,
    });
    await expect(confirm).toBeVisible();
    await expect(confirm).toContainText("Single Event");

    await confirm.getByRole("button", { name: /yes, delete/i }).click();

    // Modal + alert dialog both dismiss on success.
    await expect(page.getByRole("alertdialog")).toBeHidden();
    await expect(page.getByRole("dialog")).toBeHidden();

    // The event row is gone from the month grid.
    await expect(
      page.getByRole("button", { name: "Single Event" })
    ).toHaveCount(0);
  });

  test("cancelling the confirmation keeps the event in the calendar", async ({
    page,
  }) => {
    await page.goto("/test/calendar?events=single&view=month");

    const trigger = page.getByRole("button", { name: "Single Event" });
    await trigger.click();
    await expect(page.getByRole("dialog")).toBeVisible();

    await page
      .getByRole("dialog")
      .getByRole("button", { name: /delete event/i })
      .click();
    await page
      .getByRole("alertdialog")
      .getByRole("button", { name: /cancel/i })
      .click();

    await expect(page.getByRole("alertdialog")).toBeHidden();

    // The detail dialog stays open after cancelling.
    await expect(page.getByRole("dialog")).toBeVisible();

    // Dismiss the detail dialog and confirm the event row is still present
    // on the grid (cancel must not have triggered a deletion).
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toBeHidden();
    await expect(trigger).toBeVisible();
  });
});
