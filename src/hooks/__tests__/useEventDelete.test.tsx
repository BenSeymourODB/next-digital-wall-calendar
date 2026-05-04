/**
 * Tests for useEventDelete:
 *
 * Pins the toast contract that EventDetailModal relies on:
 *  - success → green toast, promise resolves
 *  - failure → red toast with the error message, promise re-throws so the
 *    modal stays open
 */
import { CalendarContext } from "@/components/providers/CalendarProvider";
import type { ICalendarContext } from "@/components/providers/CalendarProvider";
import { useEventDelete } from "@/hooks/useEventDelete";
import type { IEvent } from "@/types/calendar";
import type { ReactNode } from "react";
import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockToast = vi.hoisted(() => ({
  success: vi.fn(),
  error: vi.fn(),
}));
vi.mock("sonner", () => ({ toast: mockToast }));

function makeEvent(overrides: Partial<IEvent> = {}): IEvent {
  return {
    id: "evt-1",
    title: "Standup",
    startDate: new Date(2026, 4, 1, 9, 0).toISOString(),
    endDate: new Date(2026, 4, 1, 9, 30).toISOString(),
    color: "blue",
    description: "",
    isAllDay: false,
    calendarId: "primary",
    user: { id: "u1", name: "Alice", picturePath: null },
    ...overrides,
  };
}

function renderWithDelete(deleteEvent: ICalendarContext["deleteEvent"]) {
  const value = { deleteEvent } as unknown as ICalendarContext;
  const wrapper = ({ children }: { children: ReactNode }) => (
    <CalendarContext.Provider value={value}>
      {children}
    </CalendarContext.Provider>
  );
  return renderHook(() => useEventDelete(), { wrapper });
}

describe("useEventDelete", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("calls deleteEvent with the event id and calendarId on success", async () => {
    const deleteEvent = vi.fn().mockResolvedValue(undefined);
    const { result } = renderWithDelete(deleteEvent);

    const event = makeEvent({ id: "evt-42", calendarId: "work@example.com" });
    await result.current(event);

    expect(deleteEvent).toHaveBeenCalledWith("evt-42", "work@example.com");
    expect(mockToast.success).toHaveBeenCalledWith("Event deleted");
    expect(mockToast.error).not.toHaveBeenCalled();
  });

  it("surfaces the error message via toast and re-throws so callers can react", async () => {
    const deleteEvent = vi
      .fn()
      .mockRejectedValue(new Error("You do not have permission"));
    const { result } = renderWithDelete(deleteEvent);

    await expect(result.current(makeEvent())).rejects.toThrow(
      "You do not have permission"
    );
    expect(mockToast.error).toHaveBeenCalledWith("You do not have permission");
    expect(mockToast.success).not.toHaveBeenCalled();
  });

  it("falls back to a generic message when the rejection isn't an Error", async () => {
    const deleteEvent = vi.fn().mockRejectedValue("nope");
    const { result } = renderWithDelete(deleteEvent);

    await expect(result.current(makeEvent())).rejects.toBe("nope");
    expect(mockToast.error).toHaveBeenCalledWith("Failed to delete event");
  });
});
