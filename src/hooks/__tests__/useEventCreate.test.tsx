import {
  CalendarContext,
  type ICalendarContext,
} from "@/components/providers/CalendarProvider";
import { useEventCreate } from "@/hooks/useEventCreate";
import type {
  IEvent,
  IUser,
  TCalendarView,
  TEventColor,
} from "@/types/calendar";
import { type ReactNode } from "react";
import { renderHook } from "@testing-library/react";
import { toast } from "sonner";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

function makeEvent(overrides: Partial<IEvent> = {}): IEvent {
  return {
    id: "optimistic-1",
    title: "Team offsite",
    description: "",
    color: "blue",
    isAllDay: false,
    startDate: "2026-05-01T14:00:00.000Z",
    endDate: "2026-05-01T15:00:00.000Z",
    calendarId: "primary",
    user: { id: "local", name: "You", picturePath: null } as IUser,
    ...overrides,
  };
}

function makeContext(
  overrides: Partial<ICalendarContext> = {}
): ICalendarContext {
  return {
    selectedDate: new Date(2026, 4, 1),
    view: "month" as TCalendarView,
    setView: vi.fn(),
    agendaMode: false,
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
    createEvent: vi.fn(),
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

function wrapper(ctx: ICalendarContext) {
  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <CalendarContext.Provider value={ctx}>
        {children}
      </CalendarContext.Provider>
    );
  }
  return Wrapper;
}

describe("useEventCreate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("forwards optimistic event and input to context.createEvent", async () => {
    const optimistic = makeEvent();
    const reconciled = makeEvent({ id: "google-id-1" });
    const ctx = makeContext({
      createEvent: vi.fn().mockResolvedValue(reconciled),
    });

    const { result } = renderHook(() => useEventCreate(), {
      wrapper: wrapper(ctx),
    });

    const created = await result.current(optimistic, {
      title: optimistic.title,
      description: optimistic.description,
      color: optimistic.color,
      isAllDay: optimistic.isAllDay,
      startDate: optimistic.startDate,
      endDate: optimistic.endDate,
    });

    expect(created.id).toBe("google-id-1");
    expect(ctx.createEvent).toHaveBeenCalledTimes(1);
    const [forwardedOptimistic, forwardedInput] = vi.mocked(ctx.createEvent)
      .mock.calls[0];
    expect(forwardedOptimistic).toBe(optimistic);
    // Default calendarId is "primary"
    expect(forwardedInput.calendarId).toBe("primary");
  });

  it("uses defaultCalendarId when supplied via options", async () => {
    const optimistic = makeEvent();
    const ctx = makeContext({
      createEvent: vi.fn().mockResolvedValue(optimistic),
    });

    const { result } = renderHook(
      () => useEventCreate({ defaultCalendarId: "work@example.com" }),
      { wrapper: wrapper(ctx) }
    );

    await result.current(optimistic, {
      title: optimistic.title,
      description: "",
      color: "blue",
      isAllDay: false,
      startDate: optimistic.startDate,
      endDate: optimistic.endDate,
    });

    const [, forwardedInput] = vi.mocked(ctx.createEvent).mock.calls[0];
    expect(forwardedInput.calendarId).toBe("work@example.com");
  });

  it("prefers an explicit calendarId in the input over the default", async () => {
    const optimistic = makeEvent();
    const ctx = makeContext({
      createEvent: vi.fn().mockResolvedValue(optimistic),
    });

    const { result } = renderHook(
      () => useEventCreate({ defaultCalendarId: "primary" }),
      { wrapper: wrapper(ctx) }
    );

    await result.current(optimistic, {
      title: optimistic.title,
      description: "",
      color: "blue",
      isAllDay: false,
      startDate: optimistic.startDate,
      endDate: optimistic.endDate,
      calendarId: "family@group.calendar.google.com",
    });

    const [, forwardedInput] = vi.mocked(ctx.createEvent).mock.calls[0];
    expect(forwardedInput.calendarId).toBe("family@group.calendar.google.com");
  });

  it("toasts success when createEvent resolves", async () => {
    const optimistic = makeEvent();
    const ctx = makeContext({
      createEvent: vi.fn().mockResolvedValue(optimistic),
    });

    const { result } = renderHook(() => useEventCreate(), {
      wrapper: wrapper(ctx),
    });

    await result.current(optimistic, {
      title: optimistic.title,
      description: "",
      color: "blue",
      isAllDay: false,
      startDate: optimistic.startDate,
      endDate: optimistic.endDate,
    });

    expect(toast.success).toHaveBeenCalledWith("Event created");
    expect(toast.error).not.toHaveBeenCalled();
  });

  it("toasts and rejects when createEvent rejects", async () => {
    const optimistic = makeEvent();
    const ctx = makeContext({
      createEvent: vi.fn().mockRejectedValue(new Error("Calendar not found")),
    });

    const { result } = renderHook(() => useEventCreate(), {
      wrapper: wrapper(ctx),
    });

    await expect(
      result.current(optimistic, {
        title: optimistic.title,
        description: "",
        color: "blue",
        isAllDay: false,
        startDate: optimistic.startDate,
        endDate: optimistic.endDate,
      })
    ).rejects.toThrow("Calendar not found");

    expect(toast.error).toHaveBeenCalledWith("Calendar not found");
    expect(toast.success).not.toHaveBeenCalled();
  });

  it("falls back to a generic error message when the rejection is not an Error", async () => {
    const optimistic = makeEvent();
    const ctx = makeContext({
      createEvent: vi.fn().mockRejectedValue("not-an-error"),
    });

    const { result } = renderHook(() => useEventCreate(), {
      wrapper: wrapper(ctx),
    });

    await expect(
      result.current(optimistic, {
        title: optimistic.title,
        description: "",
        color: "blue",
        isAllDay: false,
        startDate: optimistic.startDate,
        endDate: optimistic.endDate,
      })
    ).rejects.toBe("not-an-error");

    expect(toast.error).toHaveBeenCalledWith("Failed to create event");
  });
});
