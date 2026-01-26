import type { IEvent, TCalendarView } from "@/types/calendar";
import { describe, expect, it } from "vitest";
import {
  formatTime,
  getBgColor,
  getCalendarCells,
  getColorClass,
  getEventsCount,
  getEventsForDay,
  getEventsForMonth,
  getEventsForWeek,
  getEventsForYear,
  getFirstLetters,
  getWeekDates,
  groupEvents,
  navigateDate,
  rangeText,
  toCapitalize,
} from "../calendar-helpers";

// Test fixtures
const createMockEvent = (overrides: Partial<IEvent> = {}): IEvent => ({
  id: "test-event-1",
  title: "Test Event",
  startDate: "2024-03-15T10:00:00",
  endDate: "2024-03-15T11:00:00",
  color: "blue",
  description: "Test description",
  user: {
    id: "user-1",
    name: "Test User",
    picturePath: null,
  },
  ...overrides,
});

describe("rangeText", () => {
  const testDate = new Date(2024, 2, 15); // March 15, 2024

  it("returns correct range for month view", () => {
    const result = rangeText("month", testDate);
    expect(result).toBe("Mar 1, 2024 - Mar 31, 2024");
  });

  it("returns correct range for week view", () => {
    const result = rangeText("week", testDate);
    // Week containing March 15, 2024 (Sunday to Saturday)
    expect(result).toContain(" - ");
  });

  it("returns single date for day view", () => {
    const result = rangeText("day", testDate);
    expect(result).toBe("Mar 15, 2024");
  });

  it("returns correct range for year view", () => {
    const result = rangeText("year", testDate);
    expect(result).toBe("Jan 1, 2024 - Dec 31, 2024");
  });

  it("returns correct range for agenda view", () => {
    const result = rangeText("agenda", testDate);
    expect(result).toBe("Mar 1, 2024 - Mar 31, 2024");
  });

  it("returns error for unknown view", () => {
    const result = rangeText("unknown" as TCalendarView, testDate);
    expect(result).toBe("Error while formatting");
  });
});

describe("navigateDate", () => {
  const testDate = new Date(2024, 2, 15); // March 15, 2024

  it("navigates to next month", () => {
    const result = navigateDate(testDate, "month", "next");
    expect(result.getMonth()).toBe(3); // April
  });

  it("navigates to previous month", () => {
    const result = navigateDate(testDate, "month", "previous");
    expect(result.getMonth()).toBe(1); // February
  });

  it("navigates to next week", () => {
    const result = navigateDate(testDate, "week", "next");
    expect(result.getDate()).toBe(22);
  });

  it("navigates to previous week", () => {
    const result = navigateDate(testDate, "week", "previous");
    expect(result.getDate()).toBe(8);
  });

  it("navigates to next day", () => {
    const result = navigateDate(testDate, "day", "next");
    expect(result.getDate()).toBe(16);
  });

  it("navigates to previous day", () => {
    const result = navigateDate(testDate, "day", "previous");
    expect(result.getDate()).toBe(14);
  });

  it("navigates to next year", () => {
    const result = navigateDate(testDate, "year", "next");
    expect(result.getFullYear()).toBe(2025);
  });

  it("navigates to previous year", () => {
    const result = navigateDate(testDate, "year", "previous");
    expect(result.getFullYear()).toBe(2023);
  });
});

describe("getEventsCount", () => {
  const testDate = new Date(2024, 2, 15);
  const events: IEvent[] = [
    createMockEvent({ id: "1", startDate: "2024-03-15T10:00:00" }),
    createMockEvent({ id: "2", startDate: "2024-03-15T14:00:00" }),
    createMockEvent({ id: "3", startDate: "2024-03-20T10:00:00" }),
  ];

  it("counts events for the same day", () => {
    const count = getEventsCount(events, testDate, "day");
    expect(count).toBe(2);
  });

  it("counts events for the same month", () => {
    const count = getEventsCount(events, testDate, "month");
    expect(count).toBe(3);
  });
});

describe("groupEvents", () => {
  it("groups non-overlapping events together", () => {
    const events: IEvent[] = [
      createMockEvent({
        id: "1",
        startDate: "2024-03-15T09:00:00",
        endDate: "2024-03-15T10:00:00",
      }),
      createMockEvent({
        id: "2",
        startDate: "2024-03-15T10:30:00",
        endDate: "2024-03-15T11:30:00",
      }),
    ];

    const groups = groupEvents(events);
    expect(groups.length).toBe(1);
    expect(groups[0].length).toBe(2);
  });

  it("separates overlapping events into different groups", () => {
    const events: IEvent[] = [
      createMockEvent({
        id: "1",
        startDate: "2024-03-15T09:00:00",
        endDate: "2024-03-15T11:00:00",
      }),
      createMockEvent({
        id: "2",
        startDate: "2024-03-15T10:00:00",
        endDate: "2024-03-15T12:00:00",
      }),
    ];

    const groups = groupEvents(events);
    expect(groups.length).toBe(2);
  });

  it("handles empty array", () => {
    const groups = groupEvents([]);
    expect(groups).toEqual([]);
  });
});

describe("getCalendarCells", () => {
  it("returns cells for a full month grid", () => {
    const date = new Date(2024, 2, 15); // March 2024
    const cells = getCalendarCells(date);

    // Should always be a complete grid (multiple of 7)
    expect(cells.length % 7).toBe(0);

    // Should have cells from current month
    const currentMonthCells = cells.filter((c) => c.currentMonth);
    expect(currentMonthCells.length).toBe(31); // March has 31 days
  });

  it("marks current month cells correctly", () => {
    const date = new Date(2024, 2, 15);
    const cells = getCalendarCells(date);

    const currentMonthCells = cells.filter((c) => c.currentMonth);
    currentMonthCells.forEach((cell) => {
      expect(cell.date.getMonth()).toBe(2); // March
    });
  });

  it("includes previous month cells", () => {
    const date = new Date(2024, 2, 1); // March 2024 starts on Friday
    const cells = getCalendarCells(date);

    // First cell should be from previous month (if March doesn't start on Sunday)
    const prevMonthCells = cells.filter(
      (c) => !c.currentMonth && c.date.getMonth() === 1
    );
    expect(prevMonthCells.length).toBeGreaterThan(0);
  });
});

describe("formatTime", () => {
  it("formats time in 24-hour format", () => {
    const result = formatTime("2024-03-15T14:30:00", true);
    expect(result).toBe("14:30");
  });

  it("formats time in 12-hour format", () => {
    const result = formatTime("2024-03-15T14:30:00", false);
    expect(result).toBe("2:30 PM");
  });

  it("handles Date objects", () => {
    const date = new Date(2024, 2, 15, 14, 30);
    const result = formatTime(date, true);
    expect(result).toBe("14:30");
  });

  it("returns empty string for invalid dates", () => {
    const result = formatTime("invalid-date", true);
    expect(result).toBe("");
  });
});

describe("getFirstLetters", () => {
  it("returns first letter of single word", () => {
    expect(getFirstLetters("Alice")).toBe("A");
  });

  it("returns first letters of two words", () => {
    expect(getFirstLetters("Alice Smith")).toBe("AS");
  });

  it("handles multiple words by using first two", () => {
    expect(getFirstLetters("Alice Marie Smith")).toBe("AM");
  });

  it("returns empty string for empty input", () => {
    expect(getFirstLetters("")).toBe("");
  });
});

describe("toCapitalize", () => {
  it("capitalizes first letter", () => {
    expect(toCapitalize("hello")).toBe("Hello");
  });

  it("handles already capitalized strings", () => {
    expect(toCapitalize("Hello")).toBe("Hello");
  });

  it("returns empty string for empty input", () => {
    expect(toCapitalize("")).toBe("");
  });
});

describe("getEventsForDay", () => {
  const events: IEvent[] = [
    createMockEvent({
      id: "1",
      startDate: "2024-03-15T10:00:00",
      endDate: "2024-03-15T11:00:00",
    }),
    createMockEvent({
      id: "2",
      startDate: "2024-03-14T10:00:00",
      endDate: "2024-03-16T11:00:00",
    }),
    createMockEvent({
      id: "3",
      startDate: "2024-03-20T10:00:00",
      endDate: "2024-03-20T11:00:00",
    }),
  ];

  it("returns events for a specific day", () => {
    const result = getEventsForDay(events, new Date(2024, 2, 15));
    expect(result.length).toBe(2);
  });

  it("excludes events from other days", () => {
    const result = getEventsForDay(events, new Date(2024, 2, 21));
    expect(result.length).toBe(0);
  });
});

describe("getEventsForWeek", () => {
  it("returns events within the week", () => {
    const events: IEvent[] = [
      createMockEvent({
        id: "1",
        startDate: "2024-03-11T10:00:00",
        endDate: "2024-03-11T11:00:00",
      }),
      createMockEvent({
        id: "2",
        startDate: "2024-03-15T10:00:00",
        endDate: "2024-03-15T11:00:00",
      }),
    ];

    const result = getEventsForWeek(events, new Date(2024, 2, 13));
    expect(result.length).toBe(2);
  });
});

describe("getEventsForMonth", () => {
  it("returns events within the month", () => {
    const events: IEvent[] = [
      createMockEvent({
        id: "1",
        startDate: "2024-03-01T10:00:00",
        endDate: "2024-03-01T11:00:00",
      }),
      createMockEvent({
        id: "2",
        startDate: "2024-03-31T10:00:00",
        endDate: "2024-03-31T11:00:00",
      }),
      createMockEvent({
        id: "3",
        startDate: "2024-04-01T10:00:00",
        endDate: "2024-04-01T11:00:00",
      }),
    ];

    const result = getEventsForMonth(events, new Date(2024, 2, 15));
    expect(result.length).toBe(2);
  });
});

describe("getEventsForYear", () => {
  it("returns events within the year", () => {
    const events: IEvent[] = [
      createMockEvent({
        id: "1",
        startDate: "2024-01-01T10:00:00",
        endDate: "2024-01-01T11:00:00",
      }),
      createMockEvent({
        id: "2",
        startDate: "2024-12-31T10:00:00",
        endDate: "2024-12-31T11:00:00",
      }),
      createMockEvent({
        id: "3",
        startDate: "2025-01-01T10:00:00",
        endDate: "2025-01-01T11:00:00",
      }),
    ];

    const result = getEventsForYear(events, new Date(2024, 5, 15));
    expect(result.length).toBe(2);
  });

  it("handles invalid inputs gracefully", () => {
    expect(getEventsForYear([], new Date(2024, 0, 1))).toEqual([]);
  });
});

describe("getWeekDates", () => {
  it("returns 7 dates for a week", () => {
    const result = getWeekDates(new Date(2024, 2, 15));
    expect(result.length).toBe(7);
  });

  it("starts week on Monday", () => {
    const result = getWeekDates(new Date(2024, 2, 15));
    expect(result[0].getDay()).toBe(1); // Monday
  });
});

describe("getColorClass", () => {
  it("returns correct class for blue", () => {
    expect(getColorClass("blue")).toContain("blue");
  });

  it("returns correct class for red", () => {
    expect(getColorClass("red")).toContain("red");
  });

  it("returns empty string for unknown color", () => {
    expect(getColorClass("unknown")).toBe("");
  });
});

describe("getBgColor", () => {
  it("returns background class for blue", () => {
    expect(getBgColor("blue")).toContain("bg-blue");
  });

  it("returns background class for green", () => {
    expect(getBgColor("green")).toContain("bg-green");
  });

  it("returns empty string for unknown color", () => {
    expect(getBgColor("unknown")).toBe("");
  });
});
