import {
  CalendarContext,
  type ICalendarContext,
} from "@/components/providers/CalendarProvider";
import type {
  IEvent,
  IUser,
  TCalendarView,
  TEventColor,
} from "@/types/calendar";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { CalendarFilterPanel } from "../CalendarFilterPanel";

function createMockContext(
  overrides: Partial<ICalendarContext> = {}
): ICalendarContext {
  return {
    selectedDate: new Date(),
    view: "month" as TCalendarView,
    setView: vi.fn(),
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
    deleteEvent: vi.fn().mockResolvedValue(undefined),
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

function renderPanel(overrides: Partial<ICalendarContext> = {}) {
  const contextValue = createMockContext(overrides);
  return {
    ...render(
      <CalendarContext.Provider value={contextValue}>
        <CalendarFilterPanel />
      </CalendarContext.Provider>
    ),
    contextValue,
  };
}

const mom: IUser = { id: "parent-1", name: "Mom", picturePath: null };
const jack: IUser = { id: "kid-2", name: "Jack", picturePath: null };
const emma: IUser = { id: "kid-1", name: "Emma", picturePath: null };

describe("CalendarFilterPanel", () => {
  describe("root", () => {
    it("renders the root with both trigger buttons", () => {
      renderPanel();
      expect(screen.getByTestId("calendar-filter-panel")).toBeInTheDocument();
      expect(
        screen.getByTestId("filter-panel-color-trigger")
      ).toBeInTheDocument();
      expect(
        screen.getByTestId("filter-panel-user-trigger")
      ).toBeInTheDocument();
    });

    it("does not render the Clear filters action when no filters are active", () => {
      renderPanel();
      expect(
        screen.queryByTestId("filter-panel-clear")
      ).not.toBeInTheDocument();
    });
  });

  describe("color filter", () => {
    it("lists all six color options in the popover", async () => {
      const user = userEvent.setup();
      renderPanel();

      await user.click(screen.getByTestId("filter-panel-color-trigger"));
      const popover = await screen.findByTestId("filter-panel-color-popover");

      const allColors: TEventColor[] = [
        "blue",
        "green",
        "red",
        "yellow",
        "purple",
        "orange",
      ];
      for (const color of allColors) {
        expect(
          within(popover).getByTestId(`filter-panel-color-option-${color}`)
        ).toBeInTheDocument();
      }
    });

    it("shows each color as unchecked by default", async () => {
      const user = userEvent.setup();
      renderPanel();

      await user.click(screen.getByTestId("filter-panel-color-trigger"));
      const popover = await screen.findByTestId("filter-panel-color-popover");
      const blueCheckbox = within(popover).getByTestId(
        "filter-panel-color-checkbox-blue"
      );
      expect(blueCheckbox).toHaveAttribute("data-state", "unchecked");
    });

    it("calls filterEventsBySelectedColors when an option is clicked", async () => {
      const user = userEvent.setup();
      const { contextValue } = renderPanel();

      await user.click(screen.getByTestId("filter-panel-color-trigger"));
      const popover = await screen.findByTestId("filter-panel-color-popover");

      await user.click(
        within(popover).getByTestId("filter-panel-color-option-red")
      );

      expect(contextValue.filterEventsBySelectedColors).toHaveBeenCalledWith(
        "red"
      );
    });

    it("marks selected colors as checked in the popover", async () => {
      const user = userEvent.setup();
      renderPanel({ selectedColors: ["red", "green"] });

      await user.click(screen.getByTestId("filter-panel-color-trigger"));
      const popover = await screen.findByTestId("filter-panel-color-popover");
      expect(
        within(popover).getByTestId("filter-panel-color-checkbox-red")
      ).toHaveAttribute("data-state", "checked");
      expect(
        within(popover).getByTestId("filter-panel-color-checkbox-green")
      ).toHaveAttribute("data-state", "checked");
      expect(
        within(popover).getByTestId("filter-panel-color-checkbox-blue")
      ).toHaveAttribute("data-state", "unchecked");
    });

    it("shows an active-count badge on the trigger when colors are selected", () => {
      renderPanel({ selectedColors: ["red", "green", "blue"] });
      const badge = screen.getByTestId("filter-panel-color-count");
      expect(badge).toHaveTextContent("3");
    });

    it("does not show the active-count badge when no colors are selected", () => {
      renderPanel();
      expect(
        screen.queryByTestId("filter-panel-color-count")
      ).not.toBeInTheDocument();
    });
  });

  describe("user filter", () => {
    it('lists an "All" option and one row per user', async () => {
      const user = userEvent.setup();
      renderPanel({ users: [mom, emma, jack] });

      await user.click(screen.getByTestId("filter-panel-user-trigger"));
      const popover = await screen.findByTestId("filter-panel-user-popover");

      expect(
        within(popover).getByTestId("filter-panel-user-option-all")
      ).toBeInTheDocument();
      expect(
        within(popover).getByTestId(`filter-panel-user-option-${mom.id}`)
      ).toHaveTextContent(mom.name);
      expect(
        within(popover).getByTestId(`filter-panel-user-option-${emma.id}`)
      ).toHaveTextContent(emma.name);
      expect(
        within(popover).getByTestId(`filter-panel-user-option-${jack.id}`)
      ).toHaveTextContent(jack.name);
    });

    it("calls setSelectedUserId with the user id when a user row is clicked", async () => {
      const user = userEvent.setup();
      const { contextValue } = renderPanel({ users: [mom, emma] });

      await user.click(screen.getByTestId("filter-panel-user-trigger"));
      const popover = await screen.findByTestId("filter-panel-user-popover");
      await user.click(
        within(popover).getByTestId(`filter-panel-user-option-${emma.id}`)
      );

      expect(contextValue.setSelectedUserId).toHaveBeenCalledWith(emma.id);
    });

    it('calls setSelectedUserId("all") when the All option is clicked', async () => {
      const user = userEvent.setup();
      const { contextValue } = renderPanel({
        users: [mom, emma],
        selectedUserId: mom.id,
      });

      await user.click(screen.getByTestId("filter-panel-user-trigger"));
      const popover = await screen.findByTestId("filter-panel-user-popover");
      await user.click(
        within(popover).getByTestId("filter-panel-user-option-all")
      );

      expect(contextValue.setSelectedUserId).toHaveBeenCalledWith("all");
    });

    it("marks the currently selected user option as active", async () => {
      const user = userEvent.setup();
      renderPanel({ users: [mom, emma], selectedUserId: mom.id });

      await user.click(screen.getByTestId("filter-panel-user-trigger"));
      const popover = await screen.findByTestId("filter-panel-user-popover");
      expect(
        within(popover).getByTestId(`filter-panel-user-option-${mom.id}`)
      ).toHaveAttribute("data-selected", "true");
      expect(
        within(popover).getByTestId("filter-panel-user-option-all")
      ).toHaveAttribute("data-selected", "false");
    });

    it("shows an empty-state message when users is empty", async () => {
      const user = userEvent.setup();
      renderPanel({ users: [] });

      await user.click(screen.getByTestId("filter-panel-user-trigger"));
      const popover = await screen.findByTestId("filter-panel-user-popover");

      // All is always present
      expect(
        within(popover).getByTestId("filter-panel-user-option-all")
      ).toBeInTheDocument();
      expect(
        within(popover).getByTestId("filter-panel-user-empty")
      ).toBeInTheDocument();
    });

    it("displays initials for the selected user on the trigger", () => {
      // Use a two-word name so the assertion proves the multi-word initials
      // branch (first+last) — not just that the name happens to start with
      // the asserted letter.
      const jackSmith: IUser = {
        id: "kid-2",
        name: "Jack Smith",
        picturePath: null,
      };
      renderPanel({
        users: [mom, jackSmith],
        selectedUserId: jackSmith.id,
      });
      const trigger = screen.getByTestId("filter-panel-user-trigger");
      // "Jack Smith" → "JS" — this substring does not appear anywhere in
      // "Jack Smith" itself, so matching it confirms it came from the
      // AvatarFallback initials.
      expect(trigger).toHaveTextContent("JS");
    });
  });

  describe("clear filters", () => {
    it("renders the Clear filters button when a color filter is active", () => {
      renderPanel({ selectedColors: ["red"] });
      expect(screen.getByTestId("filter-panel-clear")).toBeInTheDocument();
    });

    it("renders the Clear filters button when a user filter is active", () => {
      renderPanel({ users: [mom], selectedUserId: mom.id });
      expect(screen.getByTestId("filter-panel-clear")).toBeInTheDocument();
    });

    it("calls clearFilter when the clear button is clicked", async () => {
      const user = userEvent.setup();
      const { contextValue } = renderPanel({ selectedColors: ["red"] });

      await user.click(screen.getByTestId("filter-panel-clear"));

      expect(contextValue.clearFilter).toHaveBeenCalledTimes(1);
    });
  });
});
