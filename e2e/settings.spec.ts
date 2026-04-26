import { expect, test } from "@playwright/test";

test.describe("Settings Page (/test/settings)", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/test/settings");
  });

  test.describe("Page Layout", () => {
    test("displays the settings heading", async ({ page }) => {
      await expect(
        page.getByRole("heading", { name: "Settings", level: 1 })
      ).toBeVisible();
    });

    test("displays the test page banner", async ({ page }) => {
      await expect(
        page.getByText("Test page — rendering SettingsForm with mock data")
      ).toBeVisible();
    });

    test("renders all five settings sections", async ({ page }) => {
      // CardTitle renders as <div>, not heading elements
      await expect(page.getByText("Account", { exact: true })).toBeVisible();
      await expect(page.getByText("Display", { exact: true })).toBeVisible();
      await expect(page.getByText("Rewards", { exact: true })).toBeVisible();
      await expect(page.getByText("Tasks", { exact: true })).toBeVisible();
      await expect(page.getByText("Privacy", { exact: true })).toBeVisible();
    });
  });

  test.describe("Account Section", () => {
    test("displays user name and email", async ({ page }) => {
      await expect(page.getByText("Jane Doe")).toBeVisible();
      await expect(page.getByText("jane.doe@example.com")).toBeVisible();
    });

    test("displays member since date", async ({ page }) => {
      await expect(
        page.getByText("Member since January 15, 2024")
      ).toBeVisible();
    });

    test("displays connected providers", async ({ page }) => {
      await expect(page.getByText("Connected providers")).toBeVisible();
      await expect(page.getByText("google", { exact: true })).toBeVisible();
    });

    test("shows sign out button", async ({ page }) => {
      await expect(
        page.getByRole("button", { name: "Sign out" })
      ).toBeVisible();
    });

    test("shows delete account button", async ({ page }) => {
      await expect(
        page.getByRole("button", { name: "Delete account" })
      ).toBeVisible();
    });

    test("opens delete account confirmation dialog", async ({ page }) => {
      await page.getByRole("button", { name: "Delete account" }).click();

      await expect(page.getByText("Are you sure?").first()).toBeVisible();
      await expect(
        page.getByText("This action cannot be undone").first()
      ).toBeVisible();
      await expect(page.getByRole("button", { name: "Cancel" })).toBeVisible();
      await expect(
        page.getByRole("button", { name: "Yes, delete my account" })
      ).toBeVisible();
    });

    test("can dismiss delete account dialog with Cancel", async ({ page }) => {
      await page.getByRole("button", { name: "Delete account" }).click();
      await expect(page.getByText("Are you sure?").first()).toBeVisible();

      await page.getByRole("button", { name: "Cancel" }).click();
      await expect(page.getByText("Are you sure?").first()).not.toBeVisible();
    });
  });

  test.describe("Display Section", () => {
    test("shows section description", async ({ page }) => {
      await expect(
        page.getByText("Customize your display preferences")
      ).toBeVisible();
    });

    test("displays theme radio buttons with light selected by default", async ({
      page,
    }) => {
      const lightRadio = page.getByRole("radio", { name: "light" });
      const darkRadio = page.getByRole("radio", { name: "dark" });
      const systemRadio = page.getByRole("radio", { name: "system" });

      await expect(lightRadio).toBeVisible();
      await expect(darkRadio).toBeVisible();
      await expect(systemRadio).toBeVisible();

      await expect(lightRadio).toBeChecked();
      await expect(darkRadio).not.toBeChecked();
      await expect(systemRadio).not.toBeChecked();
    });

    test("can change theme selection", async ({ page }) => {
      await page.route("**/api/settings", (route) =>
        route.fulfill({ status: 200, body: "{}" })
      );
      const darkRadio = page.getByRole("radio", { name: "dark" });
      await darkRadio.click();

      await expect(darkRadio).toBeChecked();
      await expect(
        page.getByRole("radio", { name: "light" })
      ).not.toBeChecked();
    });

    test("displays time format radio buttons with 12-hour selected", async ({
      page,
    }) => {
      const radio12h = page.locator('input[name="timeFormat"][value="12h"]');
      const radio24h = page.locator('input[name="timeFormat"][value="24h"]');

      await expect(radio12h).toBeChecked();
      await expect(radio24h).not.toBeChecked();
    });

    test("can switch to 24-hour format", async ({ page }) => {
      await page.route("**/api/settings", (route) =>
        route.fulfill({ status: 200, body: "{}" })
      );
      const radio24h = page.locator('input[name="timeFormat"][value="24h"]');
      const radio12h = page.locator('input[name="timeFormat"][value="12h"]');
      await radio24h.click();

      await expect(radio24h).toBeChecked();
      await expect(radio12h).not.toBeChecked();
    });

    test("displays zoom level at 100%", async ({ page }) => {
      await expect(page.getByText("100%")).toBeVisible();
      await expect(page.getByText("Zoom Level")).toBeVisible();
    });
  });

  test.describe("Rewards Section", () => {
    test("shows section description", async ({ page }) => {
      await expect(
        page.getByText("Configure the reward point system")
      ).toBeVisible();
    });

    test("shows reward system toggle enabled by default", async ({ page }) => {
      const toggle = page.getByRole("switch", {
        name: "Enable reward system",
      });
      await expect(toggle).toBeVisible();
      await expect(toggle).toBeChecked();
    });

    test("shows default points input with value 10", async ({ page }) => {
      const pointsInput = page.getByLabel("Default points per task");
      await expect(pointsInput).toBeVisible();
      await expect(pointsInput).toHaveValue("10");
    });

    test("shows points on completion toggle", async ({ page }) => {
      const toggle = page.getByRole("switch", {
        name: "Show points on completion",
      });
      await expect(toggle).toBeVisible();
    });

    test("hides reward sub-settings when reward system is disabled", async ({
      page,
    }) => {
      await page.route("**/api/settings", (route) =>
        route.fulfill({ status: 200, body: "{}" })
      );
      const rewardToggle = page.getByRole("switch", {
        name: "Enable reward system",
      });
      await rewardToggle.click();

      // Sub-settings should be hidden when rewards are disabled
      await expect(
        page.getByLabel("Default points per task")
      ).not.toBeVisible();
      await expect(
        page.getByRole("switch", { name: "Show points on completion" })
      ).not.toBeVisible();
    });

    test("can re-enable reward system and see sub-settings again", async ({
      page,
    }) => {
      await page.route("**/api/settings", (route) =>
        route.fulfill({ status: 200, body: "{}" })
      );
      const rewardToggle = page.getByRole("switch", {
        name: "Enable reward system",
      });

      // Disable
      await rewardToggle.click();
      await expect(
        page.getByLabel("Default points per task")
      ).not.toBeVisible();

      // Re-enable
      await rewardToggle.click();
      await expect(page.getByLabel("Default points per task")).toBeVisible();
    });

    test("can modify default points value", async ({ page }) => {
      await page.route("**/api/settings", (route) =>
        route.fulfill({ status: 200, body: "{}" })
      );
      const pointsInput = page.getByLabel("Default points per task");
      await pointsInput.clear();
      await pointsInput.fill("25");

      await expect(pointsInput).toHaveValue("25");
    });
  });

  test.describe("Tasks Section", () => {
    test("shows section description", async ({ page }) => {
      await expect(
        page.getByText("Configure task list defaults")
      ).toBeVisible();
    });

    test("shows default sort order dropdown", async ({ page }) => {
      await expect(page.getByText("Default sort order")).toBeVisible();
      // The select trigger should show "Due Date" as default
      await expect(page.getByText("Due Date")).toBeVisible();
    });

    test("shows completed tasks toggle (off by default)", async ({ page }) => {
      const toggle = page.getByRole("switch", {
        name: "Show completed tasks",
      });
      await expect(toggle).toBeVisible();
      await expect(toggle).not.toBeChecked();
    });

    test("can toggle show completed tasks", async ({ page }) => {
      const toggle = page.getByRole("switch", {
        name: "Show completed tasks",
      });

      await toggle.click();
      await expect(toggle).toBeChecked();

      await toggle.click();
      await expect(toggle).not.toBeChecked();
    });

    test("can open sort order dropdown and see options", async ({ page }) => {
      // Click the select trigger to open dropdown
      await page.getByRole("combobox").click();

      await expect(
        page.getByRole("option", { name: "Due Date" })
      ).toBeVisible();
      await expect(page.getByRole("option", { name: "Title" })).toBeVisible();
      await expect(
        page.getByRole("option", { name: "Priority" })
      ).toBeVisible();
      await expect(
        page.getByRole("option", { name: "Created Date" })
      ).toBeVisible();
    });

    test("can change sort order", async ({ page }) => {
      await page.getByRole("combobox").click();
      await page.getByRole("option", { name: "Title" }).click();

      // The trigger should now show "Title"
      await expect(page.getByRole("combobox")).toHaveText("Title");
    });
  });

  test.describe("Privacy Section", () => {
    test("shows section description", async ({ page }) => {
      await expect(
        page.getByText("Manage your data and permissions")
      ).toBeVisible();
    });

    test("displays connected permissions", async ({ page }) => {
      await expect(page.getByText("Connected permissions")).toBeVisible();
      await expect(page.getByText("Google Calendar (read)")).toBeVisible();
      await expect(page.getByText("Google Tasks (read/write)")).toBeVisible();
    });

    test("shows export data button", async ({ page }) => {
      await expect(
        page.getByRole("button", { name: "Export data" })
      ).toBeVisible();
    });

    test("shows delete all data button", async ({ page }) => {
      await expect(
        page.getByRole("button", { name: "Delete all data" })
      ).toBeVisible();
    });

    test("opens delete all data confirmation dialog", async ({ page }) => {
      await page.getByRole("button", { name: "Delete all data" }).click();

      await expect(page.getByText("Are you sure?").first()).toBeVisible();
      await expect(
        page.getByText("permanently delete all of your data")
      ).toBeVisible();
      await expect(
        page.getByRole("button", { name: "Yes, delete all data" })
      ).toBeVisible();
    });

    test("can dismiss delete all data dialog", async ({ page }) => {
      await page.getByRole("button", { name: "Delete all data" }).click();
      await expect(
        page.getByRole("button", { name: "Yes, delete all data" })
      ).toBeVisible();

      await page.getByRole("button", { name: "Cancel" }).click();
      await expect(
        page.getByRole("button", { name: "Yes, delete all data" })
      ).not.toBeVisible();
    });
  });

  test.describe("Cross-Section Interactions", () => {
    test("multiple settings can be changed in sequence", async ({ page }) => {
      // Mock the settings API so changes don't revert on failure
      await page.route("**/api/settings", (route) =>
        route.fulfill({ status: 200, body: "{}" })
      );

      const radio24h = page.locator('input[name="timeFormat"][value="24h"]');

      // Change theme to dark
      await page.getByRole("radio", { name: "dark" }).click();
      await expect(page.getByRole("radio", { name: "dark" })).toBeChecked();

      // Change time format to 24h
      await radio24h.click();
      await expect(radio24h).toBeChecked();

      // Disable rewards
      await page.getByRole("switch", { name: "Enable reward system" }).click();
      await expect(
        page.getByRole("switch", { name: "Enable reward system" })
      ).not.toBeChecked();

      // Enable show completed tasks
      await page.getByRole("switch", { name: "Show completed tasks" }).click();
      await expect(
        page.getByRole("switch", { name: "Show completed tasks" })
      ).toBeChecked();

      // Verify all changes persisted in the page
      await expect(page.getByRole("radio", { name: "dark" })).toBeChecked();
      await expect(radio24h).toBeChecked();
    });
  });
});
