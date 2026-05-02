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
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { AddEventButton } from "../AddEventButton";

/**
 * Tests for AddEventButton — the "smart" wrapper around EventCreateDialog
 * that owns the dialog's open state and bridges its submission payload into
 * an `IEvent` on the calendar context.
 *
 * The button is the single public entry point for event creation from the
 * calendar toolbar. Tests focus on the integration between the button, the
 * dialog, and the context — the dialog's own form behaviour is covered by
 * EventCreateDialog.test.tsx.
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

  it("calls addEvent with the submitted payload and closes the dialog", async () => {
    const user = userEvent.setup();
    const { ctx } = renderWithContext();

    await user.click(screen.getByRole("button", { name: /add event/i }));

    await user.type(screen.getByLabelText(/title/i), "Dentist");
    await user.click(screen.getByRole("radio", { name: /red/i }));

    await user.click(screen.getByRole("button", { name: /create event/i }));

    expect(ctx.addEvent).toHaveBeenCalledTimes(1);

    const event = vi.mocked(ctx.addEvent).mock.calls[0][0];
    expect(event.title).toBe("Dentist");
    expect(event.color).toBe("red");
    expect(event.isAllDay).toBe(false);
    expect(typeof event.id).toBe("string");
    expect(event.id.length).toBeGreaterThan(0);
    expect(event.user).toMatchObject({ id: expect.any(String) });
    expect(() => new Date(event.startDate).toISOString()).not.toThrow();
    expect(() => new Date(event.endDate).toISOString()).not.toThrow();
    expect(new Date(event.endDate).getTime()).toBeGreaterThan(
      new Date(event.startDate).getTime()
    );

    // Dialog closes after submit
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("does not call addEvent when the dialog is cancelled", async () => {
    const user = userEvent.setup();
    const { ctx } = renderWithContext();

    await user.click(screen.getByRole("button", { name: /add event/i }));
    await user.type(screen.getByLabelText(/title/i), "Never mind");
    await user.click(screen.getByRole("button", { name: /cancel/i }));

    expect(ctx.addEvent).not.toHaveBeenCalled();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("seeds the dialog with the currently selected date", async () => {
    const user = userEvent.setup();
    const selectedDate = new Date(2026, 6, 4, 14, 0);
    const { ctx } = renderWithContext({ selectedDate });

    await user.click(screen.getByRole("button", { name: /add event/i }));
    await user.type(screen.getByLabelText(/title/i), "Picnic");
    await user.click(screen.getByRole("button", { name: /create event/i }));

    const event = vi.mocked(ctx.addEvent).mock.calls[0][0];
    const start = new Date(event.startDate);
    expect(start.getFullYear()).toBe(2026);
    // Month is 0-indexed
    expect(start.getMonth()).toBe(6);
    expect(start.getDate()).toBe(4);
  });
});
