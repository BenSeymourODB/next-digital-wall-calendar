import type { IEvent, TCalendarView } from "@/types/calendar";
import { describe, expect, it } from "vitest";
import {
  WEEK_STARTS_ON,
  assignBarRows,
  computeEventColumns,
  formatTime,
  getBgColor,
  getCalendarCells,
  getColorClass,
  getCurrentTimePosition,
  getEventTimePosition,
  getEventsByMode,
  getEventsCount,
  getEventsForDay,
  getEventsForMonth,
  getEventsForWeek,
  getEventsForYear,
  getFirstLetters,
  getShortWeekdayLabels,
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
  isAllDay: false,
  calendarId: "primary",
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
    // March 15, 2024 is a Friday; Sunday-first week is Mar 10 – Mar 16.
    expect(result).toBe("Mar 10, 2024 - Mar 16, 2024");
  });

  it("returns single date for day view", () => {
    const result = rangeText("day", testDate);
    expect(result).toBe("Mar 15, 2024");
  });

  it("returns correct range for year view", () => {
    const result = rangeText("year", testDate);
    expect(result).toBe("Jan 1, 2024 - Dec 31, 2024");
  });

  it("returns single date for clock view (12-hour period of selected day)", () => {
    const result = rangeText("clock", testDate);
    expect(result).toBe("Mar 15, 2024");
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

  it("navigates to next day for clock view", () => {
    const result = navigateDate(testDate, "clock", "next");
    expect(result.getDate()).toBe(16);
  });

  it("navigates to previous day for clock view", () => {
    const result = navigateDate(testDate, "clock", "previous");
    expect(result.getDate()).toBe(14);
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

  it("counts events for the same day in clock view", () => {
    const count = getEventsCount(events, testDate, "clock");
    expect(count).toBe(2);
  });

  it("counts events for the same week using WEEK_STARTS_ON", () => {
    // testDate = Fri Mar 15 2024. With WEEK_STARTS_ON = 0 (Sunday), the week
    // runs Sun Mar 10 – Sat Mar 16. Sun Mar 17 falls into the next week.
    const weekEvents: IEvent[] = [
      createMockEvent({ id: "same-week", startDate: "2024-03-10T10:00:00" }),
      createMockEvent({ id: "next-week", startDate: "2024-03-17T10:00:00" }),
    ];
    expect(getEventsCount(weekEvents, testDate, "week")).toBe(1);
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

    // First cell should be from previous month (if March doesn't start on WEEK_STARTS_ON)
    const prevMonthCells = cells.filter(
      (c) => !c.currentMonth && c.date.getMonth() === 1
    );
    expect(prevMonthCells.length).toBeGreaterThan(0);
  });

  it("starts the grid on WEEK_STARTS_ON", () => {
    const date = new Date(2024, 2, 15); // March 2024
    const cells = getCalendarCells(date);
    expect(cells[0].date.getDay()).toBe(WEEK_STARTS_ON);
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

  it("includes Saturday-afternoon events on the last day of the week (regression: #201)", () => {
    // Week of Sun Mar 10 – Sat Mar 16, 2024 (WEEK_STARTS_ON = 0).
    // Events at every hour of Saturday should be included; the previous
    // implementation used `weekDates[6]` (start-of-Saturday) as the upper
    // bound and silently dropped anything after Saturday 00:00:00.
    const saturdayAfternoon = createMockEvent({
      id: "sat-afternoon",
      startDate: "2024-03-16T14:00:00",
      endDate: "2024-03-16T15:00:00",
    });
    const saturdayLateNight = createMockEvent({
      id: "sat-late",
      startDate: "2024-03-16T23:30:00",
      endDate: "2024-03-16T23:59:00",
    });
    const saturdayMorning = createMockEvent({
      id: "sat-morning",
      startDate: "2024-03-16T08:00:00",
      endDate: "2024-03-16T09:00:00",
    });

    const result = getEventsForWeek(
      [saturdayMorning, saturdayAfternoon, saturdayLateNight],
      new Date(2024, 2, 13)
    );
    const ids = result.map((e) => e.id).sort();
    expect(ids).toEqual(["sat-afternoon", "sat-late", "sat-morning"]);
  });

  it("excludes events that start on Sunday of the next week", () => {
    // Boundary check the other direction: the next week starts at
    // Sun Mar 17 00:00:00 and should NOT be included in the prior week.
    const nextSundayMidnight = createMockEvent({
      id: "next-sun",
      startDate: "2024-03-17T00:00:00",
      endDate: "2024-03-17T01:00:00",
    });
    const result = getEventsForWeek(
      [nextSundayMidnight],
      new Date(2024, 2, 13)
    );
    expect(result).toEqual([]);
  });

  it("excludes events fully before the week (Saturday of the prior week)", () => {
    // Week prior runs Sun Mar 3 – Sat Mar 9, 2024. An event at Sat Mar 9
    // 23:30 is in the prior week and should not leak into Mar 10–16.
    const priorSaturdayLate = createMockEvent({
      id: "prior-sat",
      startDate: "2024-03-09T23:30:00",
      endDate: "2024-03-09T23:59:00",
    });
    const result = getEventsForWeek([priorSaturdayLate], new Date(2024, 2, 13));
    expect(result).toEqual([]);
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

  it("starts week on WEEK_STARTS_ON", () => {
    const result = getWeekDates(new Date(2024, 2, 15));
    expect(result[0].getDay()).toBe(WEEK_STARTS_ON);
  });

  it("returns consecutive days covering a full week", () => {
    // March 15, 2024 is a Friday. With Sunday-first (WEEK_STARTS_ON = 0),
    // the week runs from Sun Mar 10 through Sat Mar 16.
    const result = getWeekDates(new Date(2024, 2, 15));
    const isoDates = result.map((d) => d.toISOString().slice(0, 10));
    expect(isoDates).toEqual([
      "2024-03-10",
      "2024-03-11",
      "2024-03-12",
      "2024-03-13",
      "2024-03-14",
      "2024-03-15",
      "2024-03-16",
    ]);
  });
});

describe("getShortWeekdayLabels", () => {
  it("returns labels in correct rotation order", () => {
    // Documents expected output for WEEK_STARTS_ON = 0 (Sunday-first).
    // Update this alongside WEEK_STARTS_ON if the default ever changes.
    expect(getShortWeekdayLabels()).toEqual([
      "Sun",
      "Mon",
      "Tue",
      "Wed",
      "Thu",
      "Fri",
      "Sat",
    ]);
  });

  it("rotates labels Monday-first when weekStartsOn is 1", () => {
    expect(getShortWeekdayLabels(1)).toEqual([
      "Mon",
      "Tue",
      "Wed",
      "Thu",
      "Fri",
      "Sat",
      "Sun",
    ]);
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

describe("getEventsByMode (clock)", () => {
  const testDate = new Date(2024, 2, 15);
  const events: IEvent[] = [
    createMockEvent({
      id: "today-1",
      startDate: "2024-03-15T10:00:00",
      endDate: "2024-03-15T11:00:00",
    }),
    createMockEvent({
      id: "today-2",
      startDate: "2024-03-15T14:00:00",
      endDate: "2024-03-15T15:00:00",
    }),
    createMockEvent({
      id: "tomorrow",
      startDate: "2024-03-16T10:00:00",
      endDate: "2024-03-16T11:00:00",
    }),
  ];

  it("returns events for the selected day in clock view", () => {
    const result = getEventsByMode(events, "clock", testDate);
    const ids = result.map((e) => e.id).sort();
    expect(ids).toEqual(["today-1", "today-2"]);
  });
});

describe("getEventTimePosition", () => {
  const day = new Date(2026, 3, 15); // Apr 15 2026

  it("positions a 9:00–10:00 event at top=37.5%, height=4.166...%", () => {
    const event = createMockEvent({
      startDate: new Date(2026, 3, 15, 9, 0).toISOString(),
      endDate: new Date(2026, 3, 15, 10, 0).toISOString(),
    });
    const { top, height } = getEventTimePosition(event, day);
    expect(top).toBeCloseTo((9 * 60 * 100) / 1440, 5); // 37.5
    expect(height).toBeCloseTo((60 * 100) / 1440, 5); // ~4.166
  });

  it("positions an event at midnight start with top=0", () => {
    const event = createMockEvent({
      startDate: new Date(2026, 3, 15, 0, 0).toISOString(),
      endDate: new Date(2026, 3, 15, 1, 0).toISOString(),
    });
    expect(getEventTimePosition(event, day).top).toBe(0);
  });

  it("clamps top to 0 when event starts before the day", () => {
    const event = createMockEvent({
      startDate: new Date(2026, 3, 14, 22, 0).toISOString(),
      endDate: new Date(2026, 3, 15, 6, 0).toISOString(),
    });
    const { top, height } = getEventTimePosition(event, day);
    expect(top).toBe(0);
    // 6 hours of height = 25%
    expect(height).toBeCloseTo(25, 5);
  });

  it("clamps height when event ends after the day", () => {
    const event = createMockEvent({
      startDate: new Date(2026, 3, 15, 22, 0).toISOString(),
      endDate: new Date(2026, 3, 16, 4, 0).toISOString(),
    });
    const { top, height } = getEventTimePosition(event, day);
    // top: 22*60 / 1440 * 100 = 91.666...
    expect(top).toBeCloseTo((22 * 60 * 100) / 1440, 5);
    // height clamped to remainder of the day = 2 hours / 24 = 8.33...%
    expect(height).toBeCloseTo((2 * 60 * 100) / 1440, 5);
  });

  it("enforces a minimum height so very short events stay clickable", () => {
    const event = createMockEvent({
      startDate: new Date(2026, 3, 15, 9, 0).toISOString(),
      endDate: new Date(2026, 3, 15, 9, 0).toISOString(),
    });
    expect(getEventTimePosition(event, day).height).toBeGreaterThan(0);
  });
});

describe("getCurrentTimePosition", () => {
  it("returns 0% at midnight", () => {
    const now = new Date(2026, 3, 15, 0, 0);
    expect(getCurrentTimePosition(now).top).toBe(0);
  });

  it("returns 50% at noon", () => {
    const now = new Date(2026, 3, 15, 12, 0);
    expect(getCurrentTimePosition(now).top).toBeCloseTo(50, 5);
  });

  it("returns ~99.93% at 23:59", () => {
    const now = new Date(2026, 3, 15, 23, 59);
    expect(getCurrentTimePosition(now).top).toBeCloseTo(
      (23 * 60 + 59) / 14.4,
      5
    );
  });
});

describe("computeEventColumns", () => {
  const day = new Date(2026, 3, 15);

  function eventAt(id: string, startHour: number, endHour: number): IEvent {
    const start = new Date(day);
    start.setHours(startHour, 0, 0, 0);
    const end = new Date(day);
    end.setHours(endHour, 0, 0, 0);
    return createMockEvent({
      id,
      startDate: start.toISOString(),
      endDate: end.toISOString(),
    });
  }

  it("gives a single event 1 column at column 0", () => {
    const result = computeEventColumns([eventAt("a", 9, 10)]);
    expect(result["a"]).toEqual({ column: 0, columns: 1 });
  });

  it("gives an event with no time-overlapping neighbour full width even if other events stack elsewhere", () => {
    // A(9-10) and B(9:30-10:30) overlap. C(11-12) is alone.
    const events = [
      eventAt("a", 9, 10),
      eventAt("b", 9, 11),
      eventAt("c", 11, 12),
    ];
    const result = computeEventColumns(events);
    // A and B overlap each other but not C. C gets full width.
    expect(result["c"]).toEqual({ column: 0, columns: 1 });
  });

  it("widens to the local concurrency for overlapping events", () => {
    const events = [
      eventAt("a", 9, 10),
      eventAt("b", 9, 11), // overlaps a
    ];
    const result = computeEventColumns(events);
    expect(result["a"].columns).toBe(2);
    expect(result["b"].columns).toBe(2);
    expect(result["a"].column).not.toBe(result["b"].column);
  });

  it("handles three concurrent events", () => {
    const events = [
      eventAt("a", 9, 10),
      eventAt("b", 9, 10),
      eventAt("c", 9, 10),
    ];
    const result = computeEventColumns(events);
    expect(result["a"].columns).toBe(3);
    expect(result["b"].columns).toBe(3);
    expect(result["c"].columns).toBe(3);
    const cols = new Set([
      result["a"].column,
      result["b"].column,
      result["c"].column,
    ]);
    expect(cols.size).toBe(3);
  });
});

describe("assignBarRows", () => {
  const weekStart = new Date(2026, 3, 12); // Sun Apr 12 2026
  const weekEnd = new Date(2026, 3, 18); // Sat Apr 18 2026

  it("assigns row 0 to a single multi-day event", () => {
    const event = createMockEvent({
      id: "e1",
      startDate: new Date(2026, 3, 13).toISOString(),
      endDate: new Date(2026, 3, 15).toISOString(),
    });
    const rows = assignBarRows([event], weekStart, weekEnd);
    expect(rows[event.id]).toBe(0);
  });

  it("stacks two overlapping events into rows 0 and 1", () => {
    const a = createMockEvent({
      id: "a",
      startDate: new Date(2026, 3, 13).toISOString(),
      endDate: new Date(2026, 3, 15).toISOString(),
    });
    const b = createMockEvent({
      id: "b",
      startDate: new Date(2026, 3, 14).toISOString(),
      endDate: new Date(2026, 3, 16).toISOString(),
    });
    const rows = assignBarRows([a, b], weekStart, weekEnd);
    expect(rows[a.id]).toBe(0);
    expect(rows[b.id]).toBe(1);
  });

  it("re-uses row 0 for two events that don't overlap", () => {
    const a = createMockEvent({
      id: "a",
      startDate: new Date(2026, 3, 13).toISOString(),
      endDate: new Date(2026, 3, 14).toISOString(),
    });
    const b = createMockEvent({
      id: "b",
      startDate: new Date(2026, 3, 16).toISOString(),
      endDate: new Date(2026, 3, 17).toISOString(),
    });
    const rows = assignBarRows([a, b], weekStart, weekEnd);
    expect(rows[a.id]).toBe(0);
    expect(rows[b.id]).toBe(0);
  });

  it("ignores events fully outside the week", () => {
    const event = createMockEvent({
      id: "out",
      startDate: new Date(2026, 4, 1).toISOString(),
      endDate: new Date(2026, 4, 2).toISOString(),
    });
    const rows = assignBarRows([event], weekStart, weekEnd);
    expect(rows[event.id]).toBeUndefined();
  });
});
