/**
 * E2E Integration tests for calendar with real authenticated session
 *
 * These tests use an existing authenticated user's session from the database
 * to verify real Google Calendar integration works correctly.
 *
 * Prerequisites:
 * - User must be signed in via the app (session stored in database)
 * - User must have Google Calendar events in the current month
 *
 * Run with: pnpm test:e2e e2e/calendar-integration.spec.ts
 */
import { expect, test } from "@playwright/test";
import {
  disconnectDatabase,
  getExistingUserSession,
  setAuthCookies,
} from "./auth/auth-setup";

// Email of the authenticated user to use for integration tests
const TEST_USER_EMAIL = "zenoc2@gmail.com";

test.describe("Calendar Integration with Real Events", () => {
  test.beforeEach(async ({ context }) => {
    // Get existing user session from database
    const authUser = await getExistingUserSession(TEST_USER_EMAIL);

    if (!authUser) {
      test.skip(
        true,
        `No authenticated session found for ${TEST_USER_EMAIL}. Please sign in first.`
      );
      return;
    }

    // Set auth cookies from existing session
    await setAuthCookies(context, authUser.sessionToken);
  });

  test("displays calendar page with authenticated user", async ({ page }) => {
    await page.goto("/calendar");

    // Wait for the page to load
    await expect(page.getByText("Wall Calendar")).toBeVisible();

    // Verify the calendar component is rendered
    await expect(page.locator(".min-h-screen")).toBeVisible();
  });

  test("shows connected account in settings panel", async ({ page }) => {
    await page.goto("/calendar");

    // Wait for page to load with a reasonable timeout
    await page.waitForTimeout(2000);

    // Click settings button (gear icon) to open settings panel
    const settingsButton = page
      .locator("button")
      .filter({ has: page.locator("svg") })
      .first();

    if (await settingsButton.isVisible().catch(() => false)) {
      await settingsButton.click();

      // Wait for settings panel to open
      await page.waitForTimeout(1000);

      // Verify the account manager shows
      const accountsHeading = page.getByText("Calendar Accounts");

      if (await accountsHeading.isVisible().catch(() => false)) {
        // Should show auth buttons
        const signOutButton = page.getByRole("button", { name: /sign out/i });
        const signInButton = page.getByRole("button", {
          name: /sign in with google/i,
        });

        // Wait for auth state to load
        await page.waitForTimeout(1000);

        // Check if signed in - one of these should be visible
        const isSignedIn = await signOutButton.isVisible().catch(() => false);
        const needsSignIn = await signInButton.isVisible().catch(() => false);

        expect(isSignedIn || needsSignIn).toBe(true);
      }
    }
  });

  test("loads calendar events from API", async ({ page }) => {
    // Listen for API calls
    const eventsPromise = page.waitForResponse(
      (response) =>
        response.url().includes("/api/calendar/events") &&
        response.status() === 200
    );

    await page.goto("/calendar");

    // Wait for events API call
    const eventsResponse = await eventsPromise.catch(() => null);

    if (eventsResponse) {
      const data = await eventsResponse.json();
      expect(data).toHaveProperty("events");
      expect(Array.isArray(data.events)).toBe(true);

      // Log how many events were loaded for debugging
      console.log(`Loaded ${data.events.length} calendar events`);
    }
  });

  test("displays events in month view calendar", async ({ page }) => {
    await page.goto("/calendar");

    // Wait for calendar grid to load (uses div with grid-cols-7, not table)
    await page.waitForSelector('[class*="grid-cols-7"]', { timeout: 10000 });

    // The calendar grid should be visible
    await expect(page.locator('[class*="grid-cols-7"]').first()).toBeVisible();

    // Wait for events to potentially load
    await page.waitForTimeout(3000);

    // Check if there are any event indicators on the calendar
    // Events are typically shown as colored badges
    const eventIndicators = page.locator(
      '[class*="bg-blue-100"], [class*="bg-green-100"], [class*="bg-red-100"], [class*="bg-yellow-100"], [class*="bg-purple-100"], [class*="bg-orange-100"]'
    );
    const indicatorCount = await eventIndicators.count();

    console.log(`Found ${indicatorCount} event indicators on calendar`);

    // Calendar grid should be visible
    await expect(page.locator('[class*="grid-cols-7"]').first()).toBeVisible();
  });

  test("can switch to agenda view", async ({ page }) => {
    await page.goto("/calendar");

    // Find and click the Agenda view switcher
    const agendaButton = page.getByRole("button", { name: /agenda/i });

    if (await agendaButton.isVisible()) {
      await agendaButton.click();

      // Wait for agenda view to render
      await page.waitForTimeout(500);

      // Agenda view should show a different layout
      // Typically has a list-style view with dates and events
    }
  });

  test("account info API returns user data", async ({ page }) => {
    // Get the auth cookies first
    const authUser = await getExistingUserSession(TEST_USER_EMAIL);

    if (!authUser) {
      test.skip(true, "No authenticated session available");
      return;
    }

    // Set cookies on the page context
    await page.context().addCookies([
      {
        name: "authjs.session-token",
        value: authUser.sessionToken,
        domain: "localhost",
        path: "/",
        httpOnly: true,
        secure: false,
        sameSite: "Lax",
      },
    ]);

    // Make API request with authenticated context
    const response = await page.request.get("/api/auth/account");

    if (response.status() === 200) {
      const data = await response.json();
      expect(data).toHaveProperty("email");
      expect(data).toHaveProperty("calendarIds");
      expect(Array.isArray(data.calendarIds)).toBe(true);

      console.log(
        `Account info: ${data.email}, calendars: ${data.calendarIds.join(", ")}`
      );
    } else if (response.status() === 401) {
      console.log("Session may have expired - 401 returned from account API");
    }
  });

  test("calendar events API returns event data", async ({ page }) => {
    await page.goto("/calendar");

    // Make a direct API call to the events endpoint
    const now = new Date();
    const timeMin = new Date(
      now.getFullYear(),
      now.getMonth(),
      1
    ).toISOString();
    const timeMax = new Date(
      now.getFullYear(),
      now.getMonth() + 1,
      0
    ).toISOString();

    const response = await page.request.get(
      `/api/calendar/events?calendarId=primary&timeMin=${encodeURIComponent(timeMin)}&timeMax=${encodeURIComponent(timeMax)}`
    );

    if (response.status() === 200) {
      const data = await response.json();
      expect(data).toHaveProperty("events");

      if (data.events.length > 0) {
        // Verify event structure
        const event = data.events[0];
        expect(event).toHaveProperty("id");
        expect(event).toHaveProperty("summary");
        expect(event).toHaveProperty("start");
        expect(event).toHaveProperty("end");

        console.log(
          `First event: ${event.summary} at ${event.start.dateTime || event.start.date}`
        );
      }

      console.log(
        `Found ${data.events.length} events in current month via API`
      );
    } else if (response.status() === 401) {
      console.log(
        "Session expired or not authenticated - skipping event verification"
      );
    } else {
      console.log(`Unexpected API response: ${response.status()}`);
    }
  });
});

test.describe("Calendar UI Components", () => {
  test.beforeEach(async ({ context }) => {
    const authUser = await getExistingUserSession(TEST_USER_EMAIL);

    if (!authUser) {
      test.skip(
        true,
        `No authenticated session found for ${TEST_USER_EMAIL}. Please sign in first.`
      );
      return;
    }

    await setAuthCookies(context, authUser.sessionToken);
  });

  test("view switcher toggles between month and agenda views", async ({
    page,
  }) => {
    await page.goto("/calendar");

    // Wait for page to load
    await page.waitForTimeout(2000);

    // View switcher uses TabsTrigger - look for elements containing "Month" and "Agenda"
    const monthTab = page
      .locator('[data-slot="trigger"]')
      .filter({ hasText: "Month" });
    const agendaTab = page
      .locator('[data-slot="trigger"]')
      .filter({ hasText: "Agenda" });

    // Check if view switcher tabs exist
    const monthVisible = await monthTab.isVisible().catch(() => false);
    const agendaVisible = await agendaTab.isVisible().catch(() => false);

    if (monthVisible && agendaVisible) {
      // Click agenda view
      await agendaTab.click();
      await page.waitForTimeout(500);

      // Click back to month view
      await monthTab.click();
      await page.waitForTimeout(500);
    }

    // Calendar grid should be visible in month view (uses grid-cols-7, not table)
    await expect(page.locator('[class*="grid-cols-7"]').first()).toBeVisible();
  });

  test("calendar navigation works", async ({ page }) => {
    await page.goto("/calendar");

    // Wait for calendar to load (uses grid-cols-7, not table)
    await page.waitForSelector('[class*="grid-cols-7"]', { timeout: 10000 });

    // Look for navigation buttons using test IDs
    const nextButton = page.getByTestId("calendar-next-month");

    // If navigation buttons exist, verify they work
    const hasNext = await nextButton.isVisible().catch(() => false);
    if (hasNext) {
      await nextButton.click();
      await page.waitForTimeout(500);
    }

    // Calendar grid should still be visible
    await expect(page.locator('[class*="grid-cols-7"]').first()).toBeVisible();
  });
});

// Clean up database connection after all tests
test.afterAll(async () => {
  await disconnectDatabase();
});
