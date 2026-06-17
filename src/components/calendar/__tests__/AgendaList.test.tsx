/**
 * Component tests for AgendaList — the reusable agenda renderer extracted
 * from AgendaCalendar so DayCalendar and WeekCalendar can render their
 * date-range as a chronological list when `agendaMode` is on (issue #150).
 */
import {
  CalendarContext,
  type ICalendarContext,
} from "@/components/providers/CalendarProvider";
import { makeCalendarContext } from "@/test/fixtures/calendar-context";
import type { IEvent, IUser, TEventColor } from "@/types/calendar";
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { AgendaList } from "../AgendaList";

function user(id: string, name = "Tester"): IUser {
  return { id, name, picturePath: null };
}

function makeEvent(
  id: string,
  startISO: string,
  endISO: string,
  overrides: Partial<IEvent> = {}
): IEvent {
  return {
    id,
    title: id,
    description: "",
    startDate: startISO,
    endDate: endISO,
    color: "blue" as TEventColor,
    isAllDay: false,
    calendarId: "primary",
    user: user("u1"),
    ...overrides,
  };
}

function makeContext(
  overrides: Partial<ICalendarContext> = {}
): ICalendarContext {
  return makeCalendarContext({
    view: "day",
    agendaMode: true,
    selectedDate: new Date("2026-05-04T00:00:00.000Z"),
    ...overrides,
  });
}

function renderList(
  props: React.ComponentProps<typeof AgendaList>,
  ctx: Partial<ICalendarContext> = {}
) {
  return render(
    <CalendarContext.Provider value={makeContext(ctx)}>
      <AgendaList {...props} />
    </CalendarContext.Provider>
  );
}

describe("AgendaList", () => {
  it("renders the events that fall within the date range, in chronological order", () => {
    const events: IEvent[] = [
      makeEvent(
        "afternoon",
        "2026-05-04T14:00:00.000Z",
        "2026-05-04T15:00:00.000Z",
        { title: "Afternoon" }
      ),
      makeEvent(
        "morning",
        "2026-05-04T09:00:00.000Z",
        "2026-05-04T10:00:00.000Z",
        { title: "Morning" }
      ),
    ];

    renderList({
      events,
      rangeStart: new Date("2026-05-04T00:00:00.000Z"),
      rangeEnd: new Date("2026-05-04T23:59:59.999Z"),
    });

    const titles = screen
      .getAllByTestId("agenda-list-event-title")
      .map((el) => el.textContent);
    expect(titles).toEqual(["Morning", "Afternoon"]);
  });

  it("excludes events that fall outside the date range", () => {
    const events: IEvent[] = [
      makeEvent(
        "in-range",
        "2026-05-04T09:00:00.000Z",
        "2026-05-04T10:00:00.000Z",
        { title: "InRange" }
      ),
      makeEvent(
        "out-of-range",
        "2026-05-10T09:00:00.000Z",
        "2026-05-10T10:00:00.000Z",
        { title: "OutOfRange" }
      ),
    ];

    renderList({
      events,
      rangeStart: new Date("2026-05-04T00:00:00.000Z"),
      rangeEnd: new Date("2026-05-04T23:59:59.999Z"),
    });

    expect(screen.getByText("InRange")).toBeInTheDocument();
    expect(screen.queryByText("OutOfRange")).not.toBeInTheDocument();
  });

  it("groups week-range events by day with date headers when groupBy is 'date'", () => {
    const events: IEvent[] = [
      makeEvent("mon", "2026-05-04T10:00:00.000Z", "2026-05-04T11:00:00.000Z", {
        title: "MondayEvent",
      }),
      makeEvent("wed", "2026-05-06T10:00:00.000Z", "2026-05-06T11:00:00.000Z", {
        title: "WednesdayEvent",
      }),
    ];

    renderList(
      {
        events,
        rangeStart: new Date("2026-05-03T00:00:00.000Z"),
        rangeEnd: new Date("2026-05-09T23:59:59.999Z"),
      },
      { agendaModeGroupBy: "date" }
    );

    const groups = screen.getAllByTestId("agenda-list-group");
    expect(groups.length).toBe(2);
    // Both events visible, in their respective groups.
    expect(within(groups[0]).getByText("MondayEvent")).toBeInTheDocument();
    expect(within(groups[1]).getByText("WednesdayEvent")).toBeInTheDocument();
  });

  it("groups events by category with 'Uncategorised' last when groupBy is 'category' (#211)", () => {
    const events: IEvent[] = [
      makeEvent("w1", "2026-05-04T09:00:00.000Z", "2026-05-04T10:00:00.000Z", {
        title: "Standup",
        category: "Work",
      }),
      makeEvent("f1", "2026-05-04T11:00:00.000Z", "2026-05-04T12:00:00.000Z", {
        title: "School Pickup",
        category: "Family",
      }),
      makeEvent("u1", "2026-05-04T13:00:00.000Z", "2026-05-04T14:00:00.000Z", {
        title: "Coffee with Sam",
        // No category — should land under "Uncategorised"
      }),
    ];

    renderList(
      {
        events,
        rangeStart: new Date("2026-05-04T00:00:00.000Z"),
        rangeEnd: new Date("2026-05-04T23:59:59.999Z"),
      },
      { agendaModeGroupBy: "category" }
    );

    const groups = screen.getAllByTestId("agenda-list-group");
    expect(groups.length).toBe(3);
    // Alphabetical Family → Work, then Uncategorised pinned last.
    const headers = groups.map(
      (group) =>
        within(group).getByRole("heading", { level: 3 }).textContent?.trim() ??
        ""
    );
    expect(headers).toEqual(["Family", "Work", "Uncategorised"]);
    expect(within(groups[0]).getByText("School Pickup")).toBeInTheDocument();
    expect(within(groups[1]).getByText("Standup")).toBeInTheDocument();
    expect(within(groups[2]).getByText("Coffee with Sam")).toBeInTheDocument();
  });

  it("renders an empty-state when no events fall within the range", () => {
    renderList({
      events: [],
      rangeStart: new Date("2026-05-04T00:00:00.000Z"),
      rangeEnd: new Date("2026-05-04T23:59:59.999Z"),
      emptyLabel: "Nothing scheduled today",
    });

    expect(screen.getByText("Nothing scheduled today")).toBeInTheDocument();
  });

  it("collapses empty time gaps — does not render any hour-grid scaffolding", () => {
    const events: IEvent[] = [
      makeEvent(
        "morning",
        "2026-05-04T09:00:00.000Z",
        "2026-05-04T09:30:00.000Z",
        { title: "Morning" }
      ),
      makeEvent(
        "evening",
        "2026-05-04T19:00:00.000Z",
        "2026-05-04T20:00:00.000Z",
        { title: "Evening" }
      ),
    ];

    const { container } = renderList({
      events,
      rangeStart: new Date("2026-05-04T00:00:00.000Z"),
      rangeEnd: new Date("2026-05-04T23:59:59.999Z"),
    });

    // No hour cells, no time-grid scaffolding — confirms collapse.
    expect(
      container.querySelector("[data-testid='day-calendar-grid']")
    ).toBeNull();
    expect(
      container.querySelector("[data-testid='week-calendar-multi-day-row']")
    ).toBeNull();
  });
});
