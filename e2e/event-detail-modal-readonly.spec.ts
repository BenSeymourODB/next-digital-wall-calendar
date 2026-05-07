import { expect, test } from "@playwright/test";

/**
 * E2E for #266 — EventDetailModal must not render its delete button when
 * the source calendar's accessRole is `reader` or `freeBusyReader`. The
 * test page seeds MockCalendarProvider with a `shared-readonly` calendar
 * marked as `reader`; clicking the event opens the modal and we assert
 * the delete affordance is absent.
 */

test.use({ video: "retain-on-failure" });

test.describe("EventDetailModal — read-only access (#266)", () => {
  test("hides the delete button when the event lives on a reader calendar", async ({
    page,
  }) => {
    await page.goto("/test/calendar?events=read-only&view=month");

    const trigger = page.getByRole("button", { name: "Read Only Event" });
    await expect(trigger).toBeVisible();
    await trigger.click();

    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await expect(
      dialog.getByRole("heading", { name: "Read Only Event" })
    ).toBeVisible();

    // Read-only access ⇒ no delete affordance even though the modal
    // otherwise behaves identically to the writable case.
    await expect(
      dialog.getByRole("button", { name: /^delete event$/i })
    ).toHaveCount(0);
  });

  test("hides the delete button when the event lives on a freeBusyReader calendar", async ({
    page,
  }) => {
    await page.goto("/test/calendar?events=free-busy&view=month");

    const trigger = page.getByRole("button", { name: "Free Busy Event" });
    await expect(trigger).toBeVisible();
    await trigger.click();

    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await expect(
      dialog.getByRole("button", { name: /^delete event$/i })
    ).toHaveCount(0);
  });

  test("still shows the delete button on writable events as a control case", async ({
    page,
  }) => {
    await page.goto("/test/calendar?events=single&view=month");

    const trigger = page.getByRole("button", { name: "Single Event" });
    await expect(trigger).toBeVisible();
    await trigger.click();

    const dialog = page.getByRole("dialog");
    await expect(
      dialog.getByRole("button", { name: /^delete event$/i })
    ).toBeVisible();
  });
});
