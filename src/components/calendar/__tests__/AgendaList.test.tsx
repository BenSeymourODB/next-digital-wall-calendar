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
import userEvent from "@testing-library/user-event";
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

  it("renders an empty-state when no events fall within the range", () => {
    renderList({
      events: [],
      rangeStart: new Date("2026-05-04T00:00:00.000Z"),
      rangeEnd: new Date("2026-05-04T23:59:59.999Z"),
      emptyLabel: "Nothing scheduled today",
    });

    expect(screen.getByText("Nothing scheduled today")).toBeInTheDocument();
  });

  describe("search input (#264 — fold AgendaCalendar search into day/week agenda mode)", () => {
    const morning = makeEvent(
      "morning",
      "2026-05-04T09:00:00.000Z",
      "2026-05-04T10:00:00.000Z",
      {
        title: "Dentist Appointment",
        description: "Annual cleaning",
        user: user("u1", "Emma"),
      }
    );
    const afternoon = makeEvent(
      "afternoon",
      "2026-05-04T14:00:00.000Z",
      "2026-05-04T15:00:00.000Z",
      {
        title: "Soccer Practice",
        description: "Bring water bottle",
        user: user("u2", "Dad"),
      }
    );
    const range = {
      rangeStart: new Date("2026-05-04T00:00:00.000Z"),
      rangeEnd: new Date("2026-05-04T23:59:59.999Z"),
    };

    it("renders the search input when events are in range", () => {
      renderList({ events: [morning, afternoon], ...range });
      expect(
        screen.getByTestId("agenda-list-search-input")
      ).toBeInTheDocument();
    });

    it("does not render the search input when no events are in range", () => {
      renderList({ events: [], ...range });
      expect(screen.queryByTestId("agenda-list-search-input")).toBeNull();
    });

    it("filters events by title (case-insensitive substring)", async () => {
      const user = userEvent.setup();
      renderList({ events: [morning, afternoon], ...range });

      await user.type(screen.getByTestId("agenda-list-search-input"), "soccer");

      const titles = screen
        .getAllByTestId("agenda-list-event-title")
        .map((el) => el.textContent);
      expect(titles).toEqual(["Soccer Practice"]);
    });

    it("filters events by description (case-insensitive substring)", async () => {
      const user = userEvent.setup();
      renderList({ events: [morning, afternoon], ...range });

      await user.type(
        screen.getByTestId("agenda-list-search-input"),
        "cleaning"
      );

      const titles = screen
        .getAllByTestId("agenda-list-event-title")
        .map((el) => el.textContent);
      expect(titles).toEqual(["Dentist Appointment"]);
    });

    it("filters events by attendee (user) name", async () => {
      const user = userEvent.setup();
      renderList({ events: [morning, afternoon], ...range });

      await user.type(screen.getByTestId("agenda-list-search-input"), "Emma");

      const titles = screen
        .getAllByTestId("agenda-list-event-title")
        .map((el) => el.textContent);
      expect(titles).toEqual(["Dentist Appointment"]);
    });

    it("renders a 'no matches' empty state when the query matches nothing in range, and restores the list on clear", async () => {
      const user = userEvent.setup();
      renderList({ events: [morning, afternoon], ...range });

      await user.type(
        screen.getByTestId("agenda-list-search-input"),
        "nothing-matches"
      );

      expect(screen.queryByTestId("agenda-list-group")).toBeNull();
      expect(
        screen.getByTestId("agenda-list-search-no-matches")
      ).toHaveTextContent(/nothing-matches/);
      // The contextual range-empty state must not also appear.
      expect(screen.queryByTestId("agenda-list-empty")).toBeNull();

      // Clearing a non-matching query brings the original events back.
      await user.click(screen.getByTestId("agenda-list-search-clear"));
      expect(screen.queryByTestId("agenda-list-search-no-matches")).toBeNull();
      const titles = screen
        .getAllByTestId("agenda-list-event-title")
        .map((el) => el.textContent);
      expect(titles.sort()).toEqual(["Dentist Appointment", "Soccer Practice"]);
    });

    it("filters events by query when grouped by color", async () => {
      const user = userEvent.setup();
      renderList(
        { events: [morning, afternoon], ...range },
        { agendaModeGroupBy: "color" }
      );

      await user.type(screen.getByTestId("agenda-list-search-input"), "soccer");

      const titles = screen
        .getAllByTestId("agenda-list-event-title")
        .map((el) => el.textContent);
      expect(titles).toEqual(["Soccer Practice"]);
    });

    it("shows and uses the clear-search control once a query is typed", async () => {
      const user = userEvent.setup();
      renderList({ events: [morning, afternoon], ...range });

      // Clear button starts hidden
      expect(screen.queryByTestId("agenda-list-search-clear")).toBeNull();

      await user.type(screen.getByTestId("agenda-list-search-input"), "soccer");

      const clear = screen.getByTestId("agenda-list-search-clear");
      await user.click(clear);

      // Both events visible again after clearing.
      const titles = screen
        .getAllByTestId("agenda-list-event-title")
        .map((el) => el.textContent);
      expect(titles.sort()).toEqual(["Dentist Appointment", "Soccer Practice"]);
      expect(screen.queryByTestId("agenda-list-search-clear")).toBeNull();
    });

    it("renders a match count and an sr-only live region announcing it", async () => {
      const user = userEvent.setup();
      renderList({ events: [morning, afternoon], ...range });

      await user.type(screen.getByTestId("agenda-list-search-input"), "soccer");

      expect(
        screen.getByTestId("agenda-list-search-match-count")
      ).toHaveTextContent("1 match");
      expect(screen.getByTestId("agenda-list-search-status")).toHaveTextContent(
        /1 event matches "soccer"/
      );
    });
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
