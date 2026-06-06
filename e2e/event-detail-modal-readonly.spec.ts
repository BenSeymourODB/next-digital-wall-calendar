import { expect, test } from "@playwright/test";

/**
 * E2E for #266 — EventDetailModal must not render its delete button when the
 * source calendar's accessRole is `reader` or `freeBusyReader`. The test page
 * seeds MockCalendarProvider with the matching accessRolesByCalendarId so the
 * gating path is exercised without a real Google OAuth session.
 */

test.use({ video: "retain-on-failure" });

test.describe("EventDetailModal — read-only access (#266)", () => {
  test("hides the delete button for a reader-access calendar", async ({
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

    await expect(
      dialog.getByRole("button", { name: /^delete event$/i })
    ).toHaveCount(0);
  });

  test("hides the delete button for a freeBusyReader calendar", async ({
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

  test("still shows the delete button for writable events (control case)", async ({
    page,
  }) => {
    await page.goto("/test/calendar?events=single&view=month");

    const trigger = page.getByRole("button", { name: "Single Event" });
    await expect(trigger).toBeVisible();
    await trigger.click();

    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await expect(
      dialog.getByRole("button", { name: /^delete event$/i })
    ).toBeVisible();
  });
});
