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
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { AddEventButton } from "../AddEventButton";

// `useEventCreate` is wired through to `CalendarContext.createEvent`, so the
// tests below drive the integration through the context mock and assert on
// the input we forward — no need to mock the hook itself.

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

/**
 * Tests for AddEventButton — the "smart" wrapper around EventCreateDialog
 * that owns the dialog's open state and bridges its submission payload into
 * the optimistic-create flow on the calendar context.
 *
 * After #116 the button calls `createEvent` (Promise) rather than the
 * legacy `addEvent`. These tests assert the new contract: the optimistic
 * `IEvent` and the wire `CreateEventInput` arrive together so the provider
 * can roll back the same row on failure.
 */

function makeContext(
  overrides: Partial<ICalendarContext> = {}
): ICalendarContext {
  return {
    selectedDate: new Date(2026, 3, 20),
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
    createEvent: vi
      .fn()
      .mockImplementation((event: IEvent) => Promise.resolve(event)),
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

function renderWithContext(overrides: Partial<ICalendarContext> = {}) {
  const ctx = makeContext(overrides);
  return {
    ...render(
      <CalendarContext.Provider value={ctx}>
        <AddEventButton />
      </CalendarContext.Provider>
    ),
    ctx,
  };
}

describe("AddEventButton", () => {
  it("renders a button labelled 'Add event'", () => {
    renderWithContext();
    expect(
      screen.getByRole("button", { name: /add event/i })
    ).toBeInTheDocument();
  });

  it("does not open the dialog until the button is clicked", () => {
    renderWithContext();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("opens the create-event dialog when the button is clicked", async () => {
    const user = userEvent.setup();
    renderWithContext();

    await user.click(screen.getByRole("button", { name: /add event/i }));

    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: /create event/i })
    ).toBeInTheDocument();
  });

  it("calls createEvent with the optimistic event and the wire input, then closes the dialog", async () => {
    const user = userEvent.setup();
    const { ctx } = renderWithContext();

    await user.click(screen.getByRole("button", { name: /add event/i }));

    await user.type(screen.getByLabelText(/title/i), "Dentist");
    await user.click(screen.getByRole("radio", { name: /red/i }));

    await user.click(screen.getByRole("button", { name: /create event/i }));

    await waitFor(() => {
      expect(ctx.createEvent).toHaveBeenCalledTimes(1);
    });

    const [optimistic, input] = vi.mocked(ctx.createEvent).mock.calls[0];

    // Optimistic event — what the provider inserts into local state right
    // away. Has a generated id and the placeholder local user.
    expect(optimistic.title).toBe("Dentist");
    expect(optimistic.color).toBe("red");
    expect(optimistic.isAllDay).toBe(false);
    expect(typeof optimistic.id).toBe("string");
    expect(optimistic.id.length).toBeGreaterThan(0);
    expect(optimistic.user).toMatchObject({ id: expect.any(String) });
    expect(optimistic.calendarId).toBe("primary");
    expect(() => new Date(optimistic.startDate).toISOString()).not.toThrow();
    expect(() => new Date(optimistic.endDate).toISOString()).not.toThrow();
    expect(new Date(optimistic.endDate).getTime()).toBeGreaterThan(
      new Date(optimistic.startDate).getTime()
    );

    // Wire input — what the server sees. Must match the optimistic event
    // for fields the user supplied so the provider can reconcile cleanly.
    expect(input.title).toBe("Dentist");
    expect(input.color).toBe("red");
    expect(input.isAllDay).toBe(false);
    expect(input.calendarId).toBe("primary");
    expect(input.startDate).toBe(optimistic.startDate);
    expect(input.endDate).toBe(optimistic.endDate);

    // Dialog closes after submit
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("does not call createEvent when the dialog is cancelled", async () => {
    const user = userEvent.setup();
    const { ctx } = renderWithContext();

    await user.click(screen.getByRole("button", { name: /add event/i }));
    await user.type(screen.getByLabelText(/title/i), "Never mind");
    await user.click(screen.getByRole("button", { name: /cancel/i }));

    expect(ctx.createEvent).not.toHaveBeenCalled();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("seeds the dialog with the currently selected date", async () => {
    const user = userEvent.setup();
    const selectedDate = new Date(2026, 6, 4, 14, 0);
    const { ctx } = renderWithContext({ selectedDate });

    await user.click(screen.getByRole("button", { name: /add event/i }));
    await user.type(screen.getByLabelText(/title/i), "Picnic");
    await user.click(screen.getByRole("button", { name: /create event/i }));

    await waitFor(() => {
      expect(ctx.createEvent).toHaveBeenCalledTimes(1);
    });
    const [optimistic] = vi.mocked(ctx.createEvent).mock.calls[0];
    const start = new Date(optimistic.startDate);
    expect(start.getFullYear()).toBe(2026);
    // Month is 0-indexed
    expect(start.getMonth()).toBe(6);
    expect(start.getDate()).toBe(4);
  });
});
