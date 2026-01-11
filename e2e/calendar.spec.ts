import { expect, test } from "@playwright/test";

test.describe("Month Calendar (SimpleCalendar)", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/test/calendar?events=default&view=month");
  });

  test("displays the current month and year in header", async ({ page }) => {
    const header = page.locator("h2").first();
    await expect(header).toBeVisible();

    // Header should contain month and year (e.g., "January 2026")
    const headerText = await header.textContent();
    expect(headerText).toMatch(/\w+ \d{4}/);
  });

  test("displays day of week headers", async ({ page }) => {
    const dayHeaders = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

    for (const day of dayHeaders) {
      await expect(page.getByText(day, { exact: true })).toBeVisible();
    }
  });

  test("displays events on calendar days", async ({ page }) => {
    // Wait for events to be rendered
    await expect(page.getByText("Morning Standup")).toBeVisible();
    await expect(page.getByText("Project Review")).toBeVisible();
    await expect(page.getByText("Team Lunch")).toBeVisible();
  });

  test("highlights today's date", async ({ page }) => {
    // Today's date should have special styling (blue background)
    const todayCell = page.locator(".bg-blue-50");
    await expect(todayCell).toBeVisible();
  });

  test("navigates to previous month", async ({ page }) => {
    const prevButton = page
      .locator("button")
      .filter({ has: page.locator("svg") })
      .first();
    const header = page.locator("h2").first();

    const initialMonth = await header.textContent();
    await prevButton.click();

    // Month should change
    await expect(header).not.toHaveText(initialMonth!);
  });

  test("navigates to next month", async ({ page }) => {
    const nextButton = page
      .locator("button")
      .filter({ has: page.locator("svg") })
      .last();
    const header = page.locator("h2").first();

    const initialMonth = await header.textContent();
    await nextButton.click();

    // Month should change
    await expect(header).not.toHaveText(initialMonth!);
  });

  test("shows overflow indicator when more than 3 events on a day", async ({
    page,
  }) => {
    await page.goto("/test/calendar?events=overflow&view=month");

    // Should show "+X more" indicator
    await expect(page.getByText(/\+\d+ more/)).toBeVisible();
  });
});

test.describe("Month Calendar - Color Variations", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/test/calendar?events=colors&view=month");
  });

  test("displays events with correct color styling", async ({ page }) => {
    // Check that each color event is visible
    await expect(page.getByText("Blue Event")).toBeVisible();
    await expect(page.getByText("Green Event")).toBeVisible();
    await expect(page.getByText("Red Event")).toBeVisible();
    await expect(page.getByText("Yellow Event")).toBeVisible();
    await expect(page.getByText("Purple Event")).toBeVisible();
    await expect(page.getByText("Orange Event")).toBeVisible();
  });

  test("blue events have blue styling", async ({ page }) => {
    const blueEvent = page.getByText("Blue Event");
    await expect(blueEvent).toHaveClass(/bg-blue-100/);
  });

  test("green events have green styling", async ({ page }) => {
    const greenEvent = page.getByText("Green Event");
    await expect(greenEvent).toHaveClass(/bg-green-100/);
  });

  test("red events have red styling", async ({ page }) => {
    const redEvent = page.getByText("Red Event");
    await expect(redEvent).toHaveClass(/bg-red-100/);
  });
});

test.describe("Month Calendar - Empty State", () => {
  test("displays empty calendar without events", async ({ page }) => {
    await page.goto("/test/calendar?events=empty&view=month");

    // Calendar grid should still be visible
    await expect(page.getByText("Sun")).toBeVisible();
    await expect(page.getByText("Mon")).toBeVisible();

    // No events should be displayed
    await expect(page.getByText("Morning Standup")).not.toBeVisible();
  });
});

test.describe("Agenda Calendar", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/test/calendar?events=default&view=agenda");
  });

  test("displays 'Upcoming Events' header", async ({ page }) => {
    await expect(page.getByText("Upcoming Events")).toBeVisible();
  });

  test("groups events by date", async ({ page }) => {
    // Should show date headers like "Monday, January 13"
    const dateHeader = page.locator("h3").first();
    await expect(dateHeader).toBeVisible();

    const headerText = await dateHeader.textContent();
    expect(headerText).toMatch(/\w+, \w+ \d+/);
  });

  test("shows event count per day", async ({ page }) => {
    // Should show "X events" or "1 event"
    await expect(page.getByText(/\d+ events?/)).toBeVisible();
  });

  test("displays event times in 24-hour format by default", async ({
    page,
  }) => {
    // Should show times like "09:00" or "14:30"
    await expect(page.getByText(/\d{2}:\d{2}/)).toBeVisible();
  });

  test("displays event descriptions when available", async ({ page }) => {
    await expect(page.getByText("Daily team standup meeting")).toBeVisible();
  });

  test("displays event cards with color-coded borders", async ({ page }) => {
    // Events should have colored left border
    const eventCard = page.locator(".border-l-4").first();
    await expect(eventCard).toBeVisible();
  });
});

test.describe("Agenda Calendar - Empty State", () => {
  test("shows empty message when no upcoming events", async ({ page }) => {
    await page.goto("/test/calendar?events=empty&view=agenda");

    await expect(
      page.getByText("No upcoming events in the next 7 days")
    ).toBeVisible();
  });
});

test.describe("Agenda Calendar - Time Format", () => {
  test("displays times in 12-hour format when configured", async ({ page }) => {
    await page.goto("/test/calendar?events=default&view=agenda&24hour=false");

    // Should show times like "9:00 AM" or "2:30 PM"
    await expect(page.getByText(/\d{1,2}:\d{2} (AM|PM)/)).toBeVisible();
  });

  test("can toggle time format", async ({ page }) => {
    await page.goto("/test/calendar?events=default&view=agenda");

    // Initially 24-hour format
    await expect(page.getByText(/\d{2}:\d{2}/)).toBeVisible();

    // Click toggle button
    await page.getByTestId("toggle-time-format").click();

    // Should now show 12-hour format
    await expect(page.getByText(/\d{1,2}:\d{2} (AM|PM)/)).toBeVisible();
  });
});

test.describe("View Switcher", () => {
  test("switches from month view to agenda view", async ({ page }) => {
    await page.goto("/test/calendar?events=default&view=month");

    // Click Agenda tab
    await page.getByRole("tab", { name: "Agenda" }).click();

    // Should now show agenda view
    await expect(page.getByText("Upcoming Events")).toBeVisible();
  });

  test("switches from agenda view to month view", async ({ page }) => {
    await page.goto("/test/calendar?events=default&view=agenda");

    // Click Month tab
    await page.getByRole("tab", { name: "Month" }).click();

    // Should now show month view with day headers
    await expect(page.getByText("Sun")).toBeVisible();
    await expect(page.getByText("Mon")).toBeVisible();
  });

  test("maintains events when switching views", async ({ page }) => {
    await page.goto("/test/calendar?events=default&view=month");

    // Verify event in month view
    await expect(page.getByText("Morning Standup")).toBeVisible();

    // Switch to agenda
    await page.getByRole("tab", { name: "Agenda" }).click();

    // Event should still be visible in agenda view
    await expect(page.getByText("Morning Standup")).toBeVisible();
  });
});

test.describe("Loading State", () => {
  test("shows loading indicator in month view", async ({ page }) => {
    await page.goto("/test/calendar?events=default&view=month&loading=true");

    await expect(page.getByText("Loading events...")).toBeVisible();
  });

  test("shows loading indicator in agenda view", async ({ page }) => {
    await page.goto("/test/calendar?events=default&view=agenda&loading=true");

    await expect(page.getByText("Loading events...")).toBeVisible();
  });
});

test.describe("Family Calendar Scenario", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/test/calendar?events=family&view=month");
  });

  test("displays events from multiple family members", async ({ page }) => {
    await expect(page.getByText("Work Meeting")).toBeVisible();
    await expect(page.getByText("Soccer Practice")).toBeVisible();
    await expect(page.getByText("Art Class")).toBeVisible();
  });

  test("displays shared family events", async ({ page }) => {
    await expect(page.getByText("Family Dinner")).toBeVisible();
  });

  test("shows different event colors for different activities", async ({
    page,
  }) => {
    // Work events are blue
    const workEvent = page.getByText("Work Meeting");
    await expect(workEvent).toBeVisible();

    // Sports events are green
    const sportsEvent = page.getByText("Soccer Practice");
    await expect(sportsEvent).toBeVisible();

    // Art is yellow
    const artEvent = page.getByText("Art Class");
    await expect(artEvent).toBeVisible();
  });
});

test.describe("Family Calendar - Agenda View", () => {
  test("shows event descriptions in agenda view", async ({ page }) => {
    await page.goto("/test/calendar?events=family&view=agenda");

    await expect(page.getByText("Grandma's house")).toBeVisible();
  });

  test("displays multiple users' events grouped by date", async ({ page }) => {
    await page.goto("/test/calendar?events=family&view=agenda");

    // Events from different users should appear on the same day
    // if they occur on the same date
    await expect(page.getByText("Work Meeting")).toBeVisible();
    await expect(page.getByText("Soccer Practice")).toBeVisible();
    await expect(page.getByText("Family Dinner")).toBeVisible();
  });
});

test.describe("Responsive Design", () => {
  test("calendar displays correctly on mobile viewport", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto("/test/calendar?events=default&view=month");

    // Calendar should still be visible
    await expect(page.getByText("Sun")).toBeVisible();
    await expect(page.getByText("Morning Standup")).toBeVisible();
  });

  test("agenda displays correctly on mobile viewport", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto("/test/calendar?events=default&view=agenda");

    await expect(page.getByText("Upcoming Events")).toBeVisible();
    await expect(page.getByText("Morning Standup")).toBeVisible();
  });

  test("calendar displays correctly on tablet viewport", async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.goto("/test/calendar?events=default&view=month");

    await expect(page.getByText("Sun")).toBeVisible();
    await expect(page.getByText("Morning Standup")).toBeVisible();
  });
});

test.describe("Accessibility", () => {
  test("month calendar has accessible navigation buttons", async ({ page }) => {
    await page.goto("/test/calendar?events=default&view=month");

    // Navigation buttons should be keyboard accessible
    const prevButton = page
      .locator("button")
      .filter({ has: page.locator("svg") })
      .first();
    const nextButton = page
      .locator("button")
      .filter({ has: page.locator("svg") })
      .last();

    await expect(prevButton).toBeEnabled();
    await expect(nextButton).toBeEnabled();
  });

  test("view switcher tabs are keyboard navigable", async ({ page }) => {
    await page.goto("/test/calendar?events=default&view=month");

    const monthTab = page.getByRole("tab", { name: "Month" });
    const agendaTab = page.getByRole("tab", { name: "Agenda" });

    await expect(monthTab).toBeVisible();
    await expect(agendaTab).toBeVisible();

    // Tabs should be focusable
    await monthTab.focus();
    await expect(monthTab).toBeFocused();
  });
});
