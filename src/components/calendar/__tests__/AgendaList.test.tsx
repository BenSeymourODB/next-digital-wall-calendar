/**
 * Component tests for AgendaList — the reusable agenda renderer extracted
 * from AgendaCalendar so DayCalendar and WeekCalendar can render their
 * date-range as a chronological list when `agendaMode` is on (issue #150).
 */
import {
  CalendarContext,
  type ICalendarContext,
} from "@/components/providers/CalendarProvider";
import type { IEvent, IUser, TEventColor } from "@/types/calendar";
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
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
  return {
    selectedDate: new Date("2026-05-04T00:00:00.000Z"),
    view: "day",
    setView: vi.fn(),
    agendaMode: true,
    setAgendaMode: vi.fn(),
    agendaModeGroupBy: "date",
    setAgendaModeGroupBy: vi.fn(),
    use24HourFormat: true,
    toggleTimeFormat: vi.fn(),
    setSelectedDate: vi.fn(),
    selectedUserId: "all",
    setSelectedUserId: vi.fn(),
    badgeVariant: "colored",
    setBadgeVariant: vi.fn(),
    selectedColors: [] as TEventColor[],
    filterEventsBySelectedColors: vi.fn(),
    filterEventsBySelectedUser: vi.fn(),
    users: [] as IUser[],
    events: [] as IEvent[],
    addEvent: vi.fn(),
    updateEvent: vi.fn(),
    removeEvent: vi.fn(),
    clearFilter: vi.fn(),
    refreshEvents: vi.fn(),
    isLoading: false,
    isAuthenticated: true,
    maxEventsPerDay: 3,
    weekStartDay: 0,
    setWeekStartDay: vi.fn(),
    ...overrides,
  };
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
