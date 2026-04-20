import type { IEvent, IUser } from "@/types/calendar";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { EventDetailModal } from "../EventDetailModal";

function mockUser(overrides: Partial<IUser> = {}): IUser {
  return {
    id: "user-1",
    name: "Alex Morgan",
    picturePath: null,
    ...overrides,
  };
}

function mockEvent(overrides: Partial<IEvent> = {}): IEvent {
  return {
    id: "event-1",
    title: "Team Standup",
    startDate: new Date(2026, 3, 20, 10, 0).toISOString(),
    endDate: new Date(2026, 3, 20, 11, 0).toISOString(),
    color: "blue",
    description: "Daily team sync",
    isAllDay: false,
    calendarId: "primary",
    user: mockUser(),
    ...overrides,
  };
}

describe("EventDetailModal", () => {
  describe("visibility", () => {
    it("renders the event title when open with an event", () => {
      render(
        <EventDetailModal
          event={mockEvent({ title: "Quarterly Review" })}
          isOpen
          onClose={vi.fn()}
          use24HourFormat
        />
      );

      expect(
        screen.getByRole("heading", { name: "Quarterly Review" })
      ).toBeInTheDocument();
    });

    it("does not render dialog content when closed", () => {
      render(
        <EventDetailModal
          event={mockEvent()}
          isOpen={false}
          onClose={vi.fn()}
          use24HourFormat
        />
      );

      expect(
        screen.queryByRole("heading", { name: "Team Standup" })
      ).not.toBeInTheDocument();
    });

    it("renders nothing when event is null even if isOpen is true", () => {
      render(
        <EventDetailModal
          event={null}
          isOpen
          onClose={vi.fn()}
          use24HourFormat
        />
      );

      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });
  });

  describe("content", () => {
    it("renders the event description when provided", () => {
      render(
        <EventDetailModal
          event={mockEvent({ description: "Sprint planning for Q2" })}
          isOpen
          onClose={vi.fn()}
          use24HourFormat
        />
      );

      expect(screen.getByText("Sprint planning for Q2")).toBeInTheDocument();
    });

    it("omits the description region when description is empty", () => {
      render(
        <EventDetailModal
          event={mockEvent({ description: "" })}
          isOpen
          onClose={vi.fn()}
          use24HourFormat
        />
      );

      expect(
        screen.queryByTestId("event-detail-description")
      ).not.toBeInTheDocument();
    });

    it("renders the assigned user's name", () => {
      render(
        <EventDetailModal
          event={mockEvent({ user: mockUser({ name: "Jordan Taylor" }) })}
          isOpen
          onClose={vi.fn()}
          use24HourFormat
        />
      );

      expect(screen.getByText("Jordan Taylor")).toBeInTheDocument();
    });

    it("renders avatar fallback initials when user has no picture", () => {
      render(
        <EventDetailModal
          event={mockEvent({ user: mockUser({ name: "Sam Lee" }) })}
          isOpen
          onClose={vi.fn()}
          use24HourFormat
        />
      );

      expect(screen.getByText("SL")).toBeInTheDocument();
    });

    it("exposes the event color via a data attribute on the color indicator", () => {
      render(
        <EventDetailModal
          event={mockEvent({ color: "purple" })}
          isOpen
          onClose={vi.fn()}
          use24HourFormat
        />
      );

      const indicator = screen.getByTestId("event-detail-color");
      expect(indicator).toHaveAttribute("data-color", "purple");
    });
  });

  describe("time display", () => {
    it("renders a 24-hour formatted time range when use24HourFormat is true", () => {
      render(
        <EventDetailModal
          event={mockEvent({
            startDate: new Date(2026, 3, 20, 14, 30).toISOString(),
            endDate: new Date(2026, 3, 20, 15, 45).toISOString(),
            isAllDay: false,
          })}
          isOpen
          onClose={vi.fn()}
          use24HourFormat
        />
      );

      expect(screen.getByTestId("event-detail-time")).toHaveTextContent(
        "14:30 – 15:45"
      );
    });

    it("renders a 12-hour formatted time range when use24HourFormat is false", () => {
      render(
        <EventDetailModal
          event={mockEvent({
            startDate: new Date(2026, 3, 20, 14, 30).toISOString(),
            endDate: new Date(2026, 3, 20, 15, 45).toISOString(),
            isAllDay: false,
          })}
          isOpen
          onClose={vi.fn()}
          use24HourFormat={false}
        />
      );

      expect(screen.getByTestId("event-detail-time")).toHaveTextContent(
        "2:30 PM – 3:45 PM"
      );
    });

    it("renders 'All day' for all-day events instead of a time range", () => {
      render(
        <EventDetailModal
          event={mockEvent({ isAllDay: true })}
          isOpen
          onClose={vi.fn()}
          use24HourFormat
        />
      );

      expect(screen.getByTestId("event-detail-time")).toHaveTextContent(
        "All day"
      );
    });

    it("renders the event date in a human-readable format", () => {
      render(
        <EventDetailModal
          event={mockEvent({
            startDate: new Date(2026, 3, 20, 10, 0).toISOString(),
          })}
          isOpen
          onClose={vi.fn()}
          use24HourFormat
        />
      );

      expect(screen.getByTestId("event-detail-date")).toHaveTextContent(
        "Monday, April 20, 2026"
      );
    });
  });

  describe("interaction", () => {
    it("calls onClose when the Close button is activated", async () => {
      const user = userEvent.setup();
      const onClose = vi.fn();

      render(
        <EventDetailModal
          event={mockEvent()}
          isOpen
          onClose={onClose}
          use24HourFormat
        />
      );

      await user.click(screen.getByRole("button", { name: /close/i }));

      expect(onClose).toHaveBeenCalledTimes(1);
    });
  });
});
