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
          onClose={vi.fn()}
          use24HourFormat
        />
      );

      expect(
        screen.getByRole("heading", { name: "Quarterly Review" })
      ).toBeInTheDocument();
    });

    it("renders nothing when event is null and no event has been shown yet", () => {
      render(
        <EventDetailModal event={null} onClose={vi.fn()} use24HourFormat />
      );

      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });
  });

  describe("content", () => {
    it("renders the event description when provided", () => {
      render(
        <EventDetailModal
          event={mockEvent({ description: "Sprint planning for Q2" })}
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
          onClose={vi.fn()}
          use24HourFormat
        />
      );

      expect(
        screen.queryByTestId("event-detail-description")
      ).not.toBeInTheDocument();
    });

    it("omits the description region when description is only whitespace", () => {
      render(
        <EventDetailModal
          event={mockEvent({ description: "   \n\t  " })}
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
          onClose={vi.fn()}
          use24HourFormat
        />
      );

      expect(screen.getByText("Jordan Taylor")).toBeInTheDocument();
    });

    it("renders avatar fallback initials from first and last name", () => {
      render(
        <EventDetailModal
          event={mockEvent({ user: mockUser({ name: "Sam Lee" }) })}
          onClose={vi.fn()}
          use24HourFormat
        />
      );

      expect(screen.getByText("SL")).toBeInTheDocument();
    });

    it("renders the first two characters when the user name is a single word", () => {
      render(
        <EventDetailModal
          event={mockEvent({ user: mockUser({ name: "Madonna" }) })}
          onClose={vi.fn()}
          use24HourFormat
        />
      );

      expect(screen.getByText("MA")).toBeInTheDocument();
    });

    it("renders '?' when the user name is empty or whitespace", () => {
      render(
        <EventDetailModal
          event={mockEvent({ user: mockUser({ name: "   " }) })}
          onClose={vi.fn()}
          use24HourFormat
        />
      );

      expect(screen.getByText("?")).toBeInTheDocument();
    });

    it("exposes the event color via a data attribute on the color indicator", () => {
      render(
        <EventDetailModal
          event={mockEvent({ color: "purple" })}
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
            endDate: new Date(2026, 3, 20, 11, 0).toISOString(),
          })}
          onClose={vi.fn()}
          use24HourFormat
        />
      );

      expect(screen.getByTestId("event-detail-date")).toHaveTextContent(
        "Monday, April 20, 2026"
      );
    });

    it("renders a date range for multi-day timed events", () => {
      render(
        <EventDetailModal
          event={mockEvent({
            title: "Conference",
            startDate: new Date(2026, 3, 20, 9, 0).toISOString(),
            endDate: new Date(2026, 3, 22, 17, 0).toISOString(),
            isAllDay: false,
          })}
          onClose={vi.fn()}
          use24HourFormat
        />
      );

      expect(screen.getByTestId("event-detail-date")).toHaveTextContent(
        "Mon, Apr 20 – Wed, Apr 22, 2026"
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
          onClose={onClose}
          use24HourFormat
        />
      );

      await user.click(screen.getByRole("button", { name: /close/i }));

      expect(onClose).toHaveBeenCalledTimes(1);
    });
  });

  describe("delete (#115)", () => {
    it("does not render a delete button when no onDelete handler is provided", () => {
      render(
        <EventDetailModal
          event={mockEvent()}
          onClose={vi.fn()}
          use24HourFormat
        />
      );

      expect(
        screen.queryByRole("button", { name: /^delete event$/i })
      ).not.toBeInTheDocument();
    });

    it("renders a delete button when onDelete is provided", () => {
      render(
        <EventDetailModal
          event={mockEvent()}
          onClose={vi.fn()}
          onDelete={vi.fn().mockResolvedValue(undefined)}
          use24HourFormat
        />
      );

      expect(
        screen.getByRole("button", { name: /^delete event$/i })
      ).toBeInTheDocument();
    });

    it("opens a confirmation dialog when the delete button is clicked", async () => {
      const user = userEvent.setup();

      render(
        <EventDetailModal
          event={mockEvent({ title: "Quarterly Review" })}
          onClose={vi.fn()}
          onDelete={vi.fn().mockResolvedValue(undefined)}
          use24HourFormat
        />
      );

      await user.click(screen.getByRole("button", { name: /^delete event$/i }));

      expect(
        screen.getByRole("alertdialog", { name: /delete this event\?/i })
      ).toBeInTheDocument();
      // The confirmation should reference the event title to prevent confusion
      // when multiple modals/popovers can be visible.
      expect(screen.getByRole("alertdialog")).toHaveTextContent(
        "Quarterly Review"
      );
    });

    it("calls onDelete with the event when confirmation is accepted, then closes the modal", async () => {
      const user = userEvent.setup();
      const onDelete = vi.fn().mockResolvedValue(undefined);
      const onClose = vi.fn();
      const event = mockEvent({ id: "evt-99", calendarId: "primary" });

      render(
        <EventDetailModal
          event={event}
          onClose={onClose}
          onDelete={onDelete}
          use24HourFormat
        />
      );

      await user.click(screen.getByRole("button", { name: /^delete event$/i }));
      await user.click(screen.getByRole("button", { name: /yes, delete/i }));

      expect(onDelete).toHaveBeenCalledTimes(1);
      expect(onDelete).toHaveBeenCalledWith(event);
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it("does not call onDelete when the user cancels the confirmation", async () => {
      const user = userEvent.setup();
      const onDelete = vi.fn().mockResolvedValue(undefined);
      const onClose = vi.fn();

      render(
        <EventDetailModal
          event={mockEvent()}
          onClose={onClose}
          onDelete={onDelete}
          use24HourFormat
        />
      );

      await user.click(screen.getByRole("button", { name: /^delete event$/i }));
      await user.click(screen.getByRole("button", { name: /cancel/i }));

      expect(onDelete).not.toHaveBeenCalled();
      expect(onClose).not.toHaveBeenCalled();
    });

    it("keeps the modal open and does not throw when onDelete rejects", async () => {
      const user = userEvent.setup();
      const onDelete = vi.fn().mockRejectedValue(new Error("network down"));
      const onClose = vi.fn();

      render(
        <EventDetailModal
          event={mockEvent({ title: "Quarterly Review" })}
          onClose={onClose}
          onDelete={onDelete}
          use24HourFormat
        />
      );

      await user.click(screen.getByRole("button", { name: /^delete event$/i }));
      await user.click(screen.getByRole("button", { name: /yes, delete/i }));

      // The modal stays open so the user can retry / read the toast.
      expect(onClose).not.toHaveBeenCalled();
      expect(onDelete).toHaveBeenCalledTimes(1);
    });
  });
});
