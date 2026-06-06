import { describe, expect, it } from "vitest";
import {
  type CalendarKeyboardAction,
  applyCalendarKeyboardAction,
  keyboardEventToAction,
} from "../calendar-keyboard";

/**
 * The calendar-keyboard module is a pure mapper between keyboard events and
 * date transformations for the month-view grid. Keeping it separate from the
 * component lets us exhaustively cover every key binding without a DOM.
 */

type KeyInput = Partial<KeyboardEvent> & {
  key: string;
  shiftKey?: boolean;
};

function key(input: KeyInput): KeyboardEvent {
  return input as unknown as KeyboardEvent;
}

describe("keyboardEventToAction", () => {
  it.each<[KeyInput, CalendarKeyboardAction["type"]]>([
    [{ key: "ArrowLeft" }, "PREVIOUS_DAY"],
    [{ key: "ArrowRight" }, "NEXT_DAY"],
    [{ key: "ArrowUp" }, "PREVIOUS_WEEK"],
    [{ key: "ArrowDown" }, "NEXT_WEEK"],
    [{ key: "Home" }, "WEEK_START"],
    [{ key: "End" }, "WEEK_END"],
    [{ key: "PageUp" }, "PREVIOUS_MONTH"],
    [{ key: "PageDown" }, "NEXT_MONTH"],
    [{ key: "PageUp", shiftKey: true }, "PREVIOUS_YEAR"],
    [{ key: "PageDown", shiftKey: true }, "NEXT_YEAR"],
  ])("maps %o to %s", (input, expected) => {
    const action = keyboardEventToAction(key(input));
    expect(action).not.toBeNull();
    expect(action?.type).toBe(expected);
  });

  it("returns null for unhandled keys", () => {
    expect(keyboardEventToAction(key({ key: "Escape" }))).toBeNull();
    expect(keyboardEventToAction(key({ key: "Tab" }))).toBeNull();
    expect(keyboardEventToAction(key({ key: "a" }))).toBeNull();
  });

  it("ignores shift for arrow keys (only affects PageUp/PageDown)", () => {
    expect(
      keyboardEventToAction(key({ key: "ArrowLeft", shiftKey: true }))?.type
    ).toBe("PREVIOUS_DAY");
    expect(
      keyboardEventToAction(key({ key: "ArrowRight", shiftKey: true }))?.type
    ).toBe("NEXT_DAY");
  });
});

describe("applyCalendarKeyboardAction", () => {
  // Wednesday, April 15, 2026 — mid-week anchor so PREVIOUS_DAY / NEXT_DAY
  // don't cross month or week boundaries accidentally.
  const anchor = new Date(2026, 3, 15);

  it("PREVIOUS_DAY subtracts one day", () => {
    const result = applyCalendarKeyboardAction(anchor, {
      type: "PREVIOUS_DAY",
    });
    expect(result.toDateString()).toBe(new Date(2026, 3, 14).toDateString());
  });

  it("NEXT_DAY adds one day", () => {
    const result = applyCalendarKeyboardAction(anchor, { type: "NEXT_DAY" });
    expect(result.toDateString()).toBe(new Date(2026, 3, 16).toDateString());
  });

  it("PREVIOUS_WEEK subtracts seven days", () => {
    const result = applyCalendarKeyboardAction(anchor, {
      type: "PREVIOUS_WEEK",
    });
    expect(result.toDateString()).toBe(new Date(2026, 3, 8).toDateString());
  });

  it("NEXT_WEEK adds seven days", () => {
    const result = applyCalendarKeyboardAction(anchor, { type: "NEXT_WEEK" });
    expect(result.toDateString()).toBe(new Date(2026, 3, 22).toDateString());
  });

  it("WEEK_START defaults to Sunday-start when weekStartsOn is omitted (WEEK_STARTS_ON = 0)", () => {
    // Wed Apr 15 → Sun Apr 12
    const result = applyCalendarKeyboardAction(anchor, { type: "WEEK_START" });
    expect(result.toDateString()).toBe(new Date(2026, 3, 12).toDateString());
  });

  it("WEEK_END defaults to Saturday-end when weekStartsOn is omitted", () => {
    // Wed Apr 15 → Sat Apr 18
    const result = applyCalendarKeyboardAction(anchor, { type: "WEEK_END" });
    expect(result.toDateString()).toBe(new Date(2026, 3, 18).toDateString());
  });

  it("WEEK_START is idempotent when already on the first day of the week (Sunday-start)", () => {
    const sunday = new Date(2026, 3, 12);
    const result = applyCalendarKeyboardAction(sunday, { type: "WEEK_START" });
    expect(result.toDateString()).toBe(sunday.toDateString());
  });

  it("WEEK_END is idempotent when already on the last day of the week (Sunday-start)", () => {
    const saturday = new Date(2026, 3, 18);
    const result = applyCalendarKeyboardAction(saturday, { type: "WEEK_END" });
    expect(result.toDateString()).toBe(saturday.toDateString());
  });

  it("WEEK_START with weekStartsOn=1 moves a Wednesday to the preceding Monday", () => {
    // Wed Apr 15 → Mon Apr 13 (not Sunday Apr 12)
    const result = applyCalendarKeyboardAction(
      anchor,
      { type: "WEEK_START" },
      1
    );
    expect(result.toDateString()).toBe(new Date(2026, 3, 13).toDateString());
  });

  it("WEEK_END with weekStartsOn=1 moves a Wednesday to the following Sunday", () => {
    // Wed Apr 15 → Sun Apr 19 (not Saturday Apr 18)
    const result = applyCalendarKeyboardAction(anchor, { type: "WEEK_END" }, 1);
    expect(result.toDateString()).toBe(new Date(2026, 3, 19).toDateString());
  });

  it("WEEK_START with weekStartsOn=1 keeps a Sunday on the previous Monday (week boundary)", () => {
    // Sun Apr 12 in a Monday-first week belongs to the week ending Apr 12,
    // so WEEK_START goes back to Mon Apr 6 (start of that week).
    const sunday = new Date(2026, 3, 12);
    const result = applyCalendarKeyboardAction(
      sunday,
      { type: "WEEK_START" },
      1
    );
    expect(result.toDateString()).toBe(new Date(2026, 3, 6).toDateString());
  });

  it("WEEK_END with weekStartsOn=1 leaves a Sunday on itself (Sunday is the end of a Monday-first week)", () => {
    const sunday = new Date(2026, 3, 12);
    const result = applyCalendarKeyboardAction(sunday, { type: "WEEK_END" }, 1);
    expect(result.toDateString()).toBe(sunday.toDateString());
  });

  it("WEEK_START with weekStartsOn=1 leaves a Monday in place (idempotent)", () => {
    const monday = new Date(2026, 3, 13);
    const result = applyCalendarKeyboardAction(
      monday,
      { type: "WEEK_START" },
      1
    );
    expect(result.toDateString()).toBe(monday.toDateString());
  });

  it("WEEK_END with weekStartsOn=1 moves a Saturday forward to the following Sunday (Saturday is not end-of-week)", () => {
    // Saturday is the last day of a Sunday-first week but the
    // second-to-last day of a Monday-first week — `WEEK_END` must jump
    // forward, not stay put. Mon-first week: Mon Apr 13 – Sun Apr 19.
    const saturday = new Date(2026, 3, 18);
    const result = applyCalendarKeyboardAction(
      saturday,
      { type: "WEEK_END" },
      1
    );
    expect(result.toDateString()).toBe(new Date(2026, 3, 19).toDateString());
  });

  it("non-week actions ignore weekStartsOn (PREVIOUS_DAY behaves identically)", () => {
    const result = applyCalendarKeyboardAction(
      anchor,
      { type: "PREVIOUS_DAY" },
      1
    );
    expect(result.toDateString()).toBe(new Date(2026, 3, 14).toDateString());
  });

  it("PREVIOUS_MONTH subtracts one month", () => {
    const result = applyCalendarKeyboardAction(anchor, {
      type: "PREVIOUS_MONTH",
    });
    expect(result.toDateString()).toBe(new Date(2026, 2, 15).toDateString());
  });

  it("NEXT_MONTH adds one month", () => {
    const result = applyCalendarKeyboardAction(anchor, { type: "NEXT_MONTH" });
    expect(result.toDateString()).toBe(new Date(2026, 4, 15).toDateString());
  });

  it("PREVIOUS_YEAR subtracts one year", () => {
    const result = applyCalendarKeyboardAction(anchor, {
      type: "PREVIOUS_YEAR",
    });
    expect(result.toDateString()).toBe(new Date(2025, 3, 15).toDateString());
  });

  it("NEXT_YEAR adds one year", () => {
    const result = applyCalendarKeyboardAction(anchor, { type: "NEXT_YEAR" });
    expect(result.toDateString()).toBe(new Date(2027, 3, 15).toDateString());
  });

  it("PREVIOUS_DAY crosses month boundary at the start of a month", () => {
    const firstOfMonth = new Date(2026, 3, 1);
    const result = applyCalendarKeyboardAction(firstOfMonth, {
      type: "PREVIOUS_DAY",
    });
    expect(result.toDateString()).toBe(new Date(2026, 2, 31).toDateString());
  });

  it("NEXT_MONTH handles the Jan 31 → Feb 28 truncation by clamping to the last valid day", () => {
    const jan31 = new Date(2027, 0, 31);
    const result = applyCalendarKeyboardAction(jan31, { type: "NEXT_MONTH" });
    // 2027 is not a leap year → Feb 28
    expect(result.toDateString()).toBe(new Date(2027, 1, 28).toDateString());
  });

  it("preserves the hour and minute of the input", () => {
    const withTime = new Date(2026, 3, 15, 14, 30, 0, 0);
    const result = applyCalendarKeyboardAction(withTime, { type: "NEXT_DAY" });
    expect(result.getHours()).toBe(14);
    expect(result.getMinutes()).toBe(30);
  });
});
