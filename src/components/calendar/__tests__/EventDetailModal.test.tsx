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

  describe("edit (#265)", () => {
    it("does not render an edit button when no onEdit handler is provided", () => {
      render(
        <EventDetailModal
          event={mockEvent()}
          onClose={vi.fn()}
          use24HourFormat
        />
      );

      expect(
        screen.queryByRole("button", { name: /^edit event$/i })
      ).not.toBeInTheDocument();
    });

    it("renders an edit button when onEdit is provided", () => {
      render(
        <EventDetailModal
          event={mockEvent()}
          onClose={vi.fn()}
          onEdit={vi.fn().mockResolvedValue(undefined)}
          use24HourFormat
        />
      );

      expect(
        screen.getByRole("button", { name: /^edit event$/i })
      ).toBeInTheDocument();
    });

    it("hides the edit button on read-only calendars", () => {
      render(
        <EventDetailModal
          event={mockEvent()}
          onClose={vi.fn()}
          onEdit={vi.fn().mockResolvedValue(undefined)}
          accessRole="reader"
          use24HourFormat
        />
      );

      expect(
        screen.queryByRole("button", { name: /^edit event$/i })
      ).not.toBeInTheDocument();
    });

    it("swaps the read-only body for an edit form when the edit button is clicked", async () => {
      const user = userEvent.setup();

      render(
        <EventDetailModal
          event={mockEvent({
            title: "Quarterly Review",
            description: "Q2 planning",
          })}
          onClose={vi.fn()}
          onEdit={vi.fn().mockResolvedValue(undefined)}
          use24HourFormat
        />
      );

      await user.click(screen.getByRole("button", { name: /^edit event$/i }));

      // The form fields are seeded from the event.
      const titleInput = screen.getByLabelText(/title/i) as HTMLInputElement;
      expect(titleInput.value).toBe("Quarterly Review");
      const descriptionInput = screen.getByLabelText(
        /description/i
      ) as HTMLTextAreaElement;
      expect(descriptionInput.value).toBe("Q2 planning");
      // Save + Cancel replace the Delete + Close affordances while editing.
      expect(screen.getByRole("button", { name: /save/i })).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: /cancel/i })
      ).toBeInTheDocument();
    });

    it("calls onEdit with the new field values on save, then closes the modal on success", async () => {
      const user = userEvent.setup();
      const onEdit = vi.fn().mockResolvedValue(undefined);
      const onClose = vi.fn();
      const event = mockEvent({
        id: "evt-99",
        title: "Quarterly Review",
        calendarId: "primary",
      });

      render(
        <EventDetailModal
          event={event}
          onClose={onClose}
          onEdit={onEdit}
          use24HourFormat
        />
      );

      await user.click(screen.getByRole("button", { name: /^edit event$/i }));

      const titleInput = screen.getByLabelText(/title/i) as HTMLInputElement;
      await user.clear(titleInput);
      await user.type(titleInput, "Q2 Strategy Review");

      await user.click(screen.getByRole("button", { name: /save/i }));

      expect(onEdit).toHaveBeenCalledTimes(1);
      const [calledEvent, patch] = onEdit.mock.calls[0];
      // The modal forwards the source event verbatim so the parent's
      // `editEvent` handler knows which row + calendar to target — it
      // intentionally omits `calendarId` from the patch payload since the
      // route reads it from the URL.
      expect(calledEvent.id).toBe("evt-99");
      expect(calledEvent.calendarId).toBe("primary");
      expect(patch).toMatchObject({
        title: "Q2 Strategy Review",
        color: "blue",
        isAllDay: false,
      });
      expect(patch).not.toHaveProperty("calendarId");
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it("returns to the read-only view when cancel is clicked without invoking onEdit", async () => {
      const user = userEvent.setup();
      const onEdit = vi.fn().mockResolvedValue(undefined);
      const onClose = vi.fn();

      render(
        <EventDetailModal
          event={mockEvent({ title: "Quarterly Review" })}
          onClose={onClose}
          onEdit={onEdit}
          use24HourFormat
        />
      );

      await user.click(screen.getByRole("button", { name: /^edit event$/i }));

      // Make an edit, then cancel — it should be discarded.
      const titleInput = screen.getByLabelText(/title/i) as HTMLInputElement;
      await user.clear(titleInput);
      await user.type(titleInput, "Scratch this");

      await user.click(screen.getByRole("button", { name: /cancel/i }));

      expect(onEdit).not.toHaveBeenCalled();
      expect(onClose).not.toHaveBeenCalled();
      // We're back in the read-only view: the original title shows in the
      // dialog heading and the Edit button is once again visible.
      expect(
        screen.getByRole("heading", { name: "Quarterly Review" })
      ).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: /^edit event$/i })
      ).toBeInTheDocument();
    });

    it("keeps the form open and does not close the modal when onEdit rejects", async () => {
      const user = userEvent.setup();
      const onEdit = vi.fn().mockRejectedValue(new Error("network down"));
      const onClose = vi.fn();

      render(
        <EventDetailModal
          event={mockEvent({ title: "Quarterly Review" })}
          onClose={onClose}
          onEdit={onEdit}
          use24HourFormat
        />
      );

      await user.click(screen.getByRole("button", { name: /^edit event$/i }));
      await user.click(screen.getByRole("button", { name: /save/i }));

      expect(onEdit).toHaveBeenCalledTimes(1);
      expect(onClose).not.toHaveBeenCalled();
      // Still in the form (not the read-only view).
      expect(screen.getByLabelText(/title/i)).toBeInTheDocument();
    });

    it("forwards an all-day toggle and the new YYYY-MM-DD bounds on save", async () => {
      const user = userEvent.setup();
      const onEdit = vi.fn().mockResolvedValue(undefined);
      const event = mockEvent({
        startDate: new Date(2026, 3, 20, 10, 0).toISOString(),
        endDate: new Date(2026, 3, 20, 11, 0).toISOString(),
        isAllDay: false,
      });

      render(
        <EventDetailModal
          event={event}
          onClose={vi.fn()}
          onEdit={onEdit}
          use24HourFormat
        />
      );

      await user.click(screen.getByRole("button", { name: /^edit event$/i }));
      await user.click(screen.getByLabelText(/all day/i));

      await user.click(screen.getByRole("button", { name: /save/i }));

      expect(onEdit).toHaveBeenCalledTimes(1);
      const patch = onEdit.mock.calls[0][1];
      expect(patch.isAllDay).toBe(true);
      // The wire format for all-day events is YYYY-MM-DD strings, not ISO
      // datetimes — same contract as `EventCreateDialog` so the route
      // validator accepts the same body.
      expect(patch.startDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(patch.endDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });

    it("disables the save button while a save is in flight", async () => {
      const user = userEvent.setup();
      let resolveEdit: (() => void) | undefined;
      const onEdit = vi.fn().mockImplementation(
        () =>
          new Promise<void>((resolve) => {
            resolveEdit = resolve;
          })
      );

      render(
        <EventDetailModal
          event={mockEvent()}
          onClose={vi.fn()}
          onEdit={onEdit}
          use24HourFormat
        />
      );

      await user.click(screen.getByRole("button", { name: /^edit event$/i }));
      await user.click(screen.getByRole("button", { name: /save/i }));

      const saveButton = screen.getByRole("button", { name: /saving|save/i });
      expect(saveButton).toBeDisabled();

      resolveEdit?.();
    });

    // The parents (`SimpleCalendar`, `AgendaCalendar`, `AnalogClockView`) keep
    // `<EventDetailModal>` mounted permanently and merely flip the `event`
    // prop between `null` (closed) and an `IEvent` (open). React's state
    // hooks survive a `null` render, so `isEditing` would carry over to the
    // next open if we don't reset it on close — the user would land in the
    // edit form for a different event without ever clicking Edit.
    it("returns to the read-only view when the modal is re-opened with a new event after the user was editing", async () => {
      const user = userEvent.setup();
      const onEdit = vi.fn().mockResolvedValue(undefined);

      const eventA = mockEvent({ id: "evt-A", title: "Event A" });
      const eventB = mockEvent({ id: "evt-B", title: "Event B" });

      const { rerender } = render(
        <EventDetailModal
          event={eventA}
          onClose={vi.fn()}
          onEdit={onEdit}
          use24HourFormat
        />
      );

      // Enter edit mode for Event A.
      await user.click(screen.getByRole("button", { name: /^edit event$/i }));
      expect(screen.getByTestId("event-edit-form")).toBeInTheDocument();

      // Parent closes the modal (e.g. user navigates away). EventDetailModal
      // stays mounted but renders nothing while `event` is null.
      rerender(
        <EventDetailModal
          event={null}
          onClose={vi.fn()}
          onEdit={onEdit}
          use24HourFormat
        />
      );

      // Parent opens a different event.
      rerender(
        <EventDetailModal
          event={eventB}
          onClose={vi.fn()}
          onEdit={onEdit}
          use24HourFormat
        />
      );

      // The new event must open in the read-only view, NOT the edit form.
      expect(screen.queryByTestId("event-edit-form")).not.toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: /^edit event$/i })
      ).toBeInTheDocument();
      expect(
        screen.getByRole("heading", { name: "Event B" })
      ).toBeInTheDocument();
    });
  });

  describe("accessRole gating (#266)", () => {
    it("renders the delete button when accessRole is 'owner'", () => {
      render(
        <EventDetailModal
          event={mockEvent()}
          onClose={vi.fn()}
          onDelete={vi.fn().mockResolvedValue(undefined)}
          accessRole="owner"
          use24HourFormat
        />
      );

      expect(
        screen.getByRole("button", { name: /^delete event$/i })
      ).toBeInTheDocument();
    });

    it("renders the delete button when accessRole is 'writer'", () => {
      render(
        <EventDetailModal
          event={mockEvent()}
          onClose={vi.fn()}
          onDelete={vi.fn().mockResolvedValue(undefined)}
          accessRole="writer"
          use24HourFormat
        />
      );

      expect(
        screen.getByRole("button", { name: /^delete event$/i })
      ).toBeInTheDocument();
    });

    it("hides the delete button when accessRole is 'reader'", () => {
      render(
        <EventDetailModal
          event={mockEvent()}
          onClose={vi.fn()}
          onDelete={vi.fn().mockResolvedValue(undefined)}
          accessRole="reader"
          use24HourFormat
        />
      );

      expect(
        screen.queryByRole("button", { name: /^delete event$/i })
      ).not.toBeInTheDocument();
    });

    it("hides the delete button when accessRole is 'freeBusyReader'", () => {
      render(
        <EventDetailModal
          event={mockEvent()}
          onClose={vi.fn()}
          onDelete={vi.fn().mockResolvedValue(undefined)}
          accessRole="freeBusyReader"
          use24HourFormat
        />
      );

      expect(
        screen.queryByRole("button", { name: /^delete event$/i })
      ).not.toBeInTheDocument();
    });

    it("renders the delete button when accessRole is undefined (treated as writable)", () => {
      // The provider hands out `undefined` whenever the calendar list
      // hasn't loaded yet or the id wasn't in the payload. Hiding the
      // button on `undefined` would be a UX regression — Google's 403
      // remains the backstop. This case locks in that contract.
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

    it("hides the delete confirmation dialog markup entirely on read-only calendars", () => {
      // Even if the modal shipped with an alertdialog rendered
      // pre-mounted via Radix, a read-only event should never be able
      // to surface it. This guards against a future refactor that
      // moves the AlertDialog mount outside the `onDelete` guard.
      render(
        <EventDetailModal
          event={mockEvent()}
          onClose={vi.fn()}
          onDelete={vi.fn().mockResolvedValue(undefined)}
          accessRole="reader"
          use24HourFormat
        />
      );

      expect(
        screen.queryByRole("alertdialog", { name: /delete this event\?/i })
      ).not.toBeInTheDocument();
    });
  });
});
