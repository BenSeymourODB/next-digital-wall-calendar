import type { WritableCalendar } from "@/hooks/use-writable-calendars";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { EventCreateDialog, type EventCreateInput } from "../EventCreateDialog";

function makeCalendar(overrides: Partial<WritableCalendar>): WritableCalendar {
  return {
    id: "primary",
    summary: "Primary",
    backgroundColor: "#4285f4",
    foregroundColor: "#ffffff",
    primary: true,
    selected: true,
    accessRole: "owner",
    ...overrides,
  };
}

/**
 * Tests for EventCreateDialog — issue #82.
 *
 * The dialog is a controlled component: the parent owns `open` and receives
 * the submitted event via `onCreate`. The dialog does not mutate context
 * itself (that's the caller's responsibility), which keeps it easy to reuse.
 */

function renderOpen(
  overrides: {
    onCreate?: (event: EventCreateInput) => void;
    onOpenChange?: (open: boolean) => void;
    defaultDate?: Date;
    calendars?: WritableCalendar[];
    defaultCalendarId?: string;
  } = {}
) {
  const onCreate = overrides.onCreate ?? vi.fn();
  const onOpenChange = overrides.onOpenChange ?? vi.fn();

  render(
    <EventCreateDialog
      open
      onOpenChange={onOpenChange}
      onCreate={onCreate}
      defaultDate={overrides.defaultDate}
      calendars={overrides.calendars}
      defaultCalendarId={overrides.defaultCalendarId}
    />
  );

  return { onCreate, onOpenChange };
}

describe("EventCreateDialog", () => {
  describe("visibility", () => {
    it("renders a dialog when open is true", () => {
      renderOpen();
      expect(screen.getByRole("dialog")).toBeInTheDocument();
      expect(
        screen.getByRole("heading", { name: /create event/i })
      ).toBeInTheDocument();
    });

    it("does not render a dialog when open is false", () => {
      render(
        <EventCreateDialog
          open={false}
          onOpenChange={vi.fn()}
          onCreate={vi.fn()}
        />
      );
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });
  });

  describe("form fields", () => {
    it("renders a required title input", () => {
      renderOpen();
      const title = screen.getByLabelText(/title/i);
      expect(title).toBeInTheDocument();
      expect(title).toBeRequired();
    });

    it("renders start and end date-time inputs", () => {
      renderOpen();
      expect(screen.getByLabelText(/^start/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/^end/i)).toBeInTheDocument();
    });

    it("renders an all-day checkbox", () => {
      renderOpen();
      const allDay = screen.getByRole("checkbox", { name: /all day/i });
      expect(allDay).toBeInTheDocument();
      expect(allDay).not.toBeChecked();
    });

    it("renders a description textarea", () => {
      renderOpen();
      expect(screen.getByLabelText(/description/i)).toBeInTheDocument();
    });

    it("renders a color picker with all six supported colors", () => {
      renderOpen();
      for (const color of [
        "blue",
        "green",
        "red",
        "yellow",
        "purple",
        "orange",
      ] as const) {
        expect(
          screen.getByRole("radio", { name: new RegExp(color, "i") })
        ).toBeInTheDocument();
      }
    });

    it("defaults the selected color to blue", () => {
      renderOpen();
      const blue = screen.getByRole("radio", { name: /blue/i });
      expect(blue).toBeChecked();
    });
  });

  describe("all-day behavior", () => {
    it("switches the start/end inputs from datetime-local to date when all-day is checked", async () => {
      const user = userEvent.setup();
      renderOpen();

      const start = screen.getByLabelText(/^start/i) as HTMLInputElement;
      const end = screen.getByLabelText(/^end/i) as HTMLInputElement;

      expect(start.type).toBe("datetime-local");
      expect(end.type).toBe("datetime-local");

      await user.click(screen.getByRole("checkbox", { name: /all day/i }));

      expect(start.type).toBe("date");
      expect(end.type).toBe("date");
    });

    it("does not show an order error for an all-day single-day event", async () => {
      const user = userEvent.setup();
      renderOpen({ defaultDate: new Date(2026, 3, 20) });

      await user.type(screen.getByLabelText(/title/i), "Day off");
      await user.click(screen.getByRole("checkbox", { name: /all day/i }));

      // Start and end default to the same date — valid single-day all-day
      expect(
        screen.queryByText(/end must be after start/i)
      ).not.toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: /create event/i })
      ).toBeEnabled();
    });

    it("shows the order error when the all-day end date is before the start date", async () => {
      const user = userEvent.setup();
      renderOpen({ defaultDate: new Date(2026, 3, 20) });

      await user.type(screen.getByLabelText(/title/i), "Backwards");
      await user.click(screen.getByRole("checkbox", { name: /all day/i }));

      const start = screen.getByLabelText(/^start/i);
      const end = screen.getByLabelText(/^end/i);

      await user.clear(start);
      await user.type(start, "2026-04-20");
      await user.clear(end);
      await user.type(end, "2026-04-19");
      await user.tab();

      expect(screen.getByText(/end must be after start/i)).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: /create event/i })
      ).toBeDisabled();
    });

    it("submits a multi-day all-day event with endDate on the end day, not the start day", async () => {
      const user = userEvent.setup();
      const onCreate = vi.fn();
      renderOpen({ onCreate, defaultDate: new Date(2026, 3, 20) });

      await user.type(screen.getByLabelText(/title/i), "Conference");
      await user.click(screen.getByRole("checkbox", { name: /all day/i }));

      const start = screen.getByLabelText(/^start/i);
      const end = screen.getByLabelText(/^end/i);

      await user.clear(start);
      await user.type(start, "2026-04-20");
      await user.clear(end);
      await user.type(end, "2026-04-22");

      await user.click(screen.getByRole("button", { name: /create event/i }));

      expect(onCreate).toHaveBeenCalledTimes(1);
      const payload = onCreate.mock.calls[0][0] as EventCreateInput;
      expect(payload.isAllDay).toBe(true);

      // With the YYYY-MM-DD wire format (#267), startDate/endDate are plain
      // date strings — no UTC conversion needed.
      expect(payload.startDate).toBe("2026-04-20");
      // End must be on the 22nd, not the 20th
      expect(payload.endDate).toBe("2026-04-22");
      // And the end date string is lexicographically after the start
      expect(payload.endDate > payload.startDate).toBe(true);
    });
  });

  describe("validation", () => {
    it("disables the Create button when title is empty", () => {
      renderOpen();
      const create = screen.getByRole("button", { name: /create event/i });
      expect(create).toBeDisabled();
    });

    it("enables the Create button once title has non-whitespace content", async () => {
      const user = userEvent.setup();
      renderOpen();

      const title = screen.getByLabelText(/title/i);
      const create = screen.getByRole("button", { name: /create event/i });

      expect(create).toBeDisabled();

      await user.type(title, "Team Meeting");
      expect(create).toBeEnabled();
    });

    it("shows an inline error when end is before start", async () => {
      const user = userEvent.setup();
      renderOpen({ defaultDate: new Date(2026, 3, 20, 10, 0) });

      await user.type(screen.getByLabelText(/title/i), "Bad Times");

      const start = screen.getByLabelText(/^start/i);
      const end = screen.getByLabelText(/^end/i);

      await user.clear(end);
      await user.type(end, "2026-04-20T09:00");
      await user.clear(start);
      await user.type(start, "2026-04-20T10:00");

      // Force a blur to trigger validation
      await user.tab();

      expect(screen.getByText(/end must be after start/i)).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: /create event/i })
      ).toBeDisabled();
    });
  });

  describe("submission", () => {
    it("calls onCreate with the form payload and closes on submit", async () => {
      const user = userEvent.setup();
      const onCreate = vi.fn();
      const onOpenChange = vi.fn();
      const defaultDate = new Date(2026, 3, 20, 10, 0);

      renderOpen({ onCreate, onOpenChange, defaultDate });

      await user.type(screen.getByLabelText(/title/i), "Sprint Planning");
      await user.type(screen.getByLabelText(/description/i), "Next two weeks");
      await user.click(screen.getByRole("radio", { name: /green/i }));

      await user.click(screen.getByRole("button", { name: /create event/i }));

      expect(onCreate).toHaveBeenCalledTimes(1);
      const payload = onCreate.mock.calls[0][0];
      expect(payload.title).toBe("Sprint Planning");
      expect(payload.description).toBe("Next two weeks");
      expect(payload.color).toBe("green");
      expect(payload.isAllDay).toBe(false);
      expect(new Date(payload.endDate).getTime()).toBeGreaterThan(
        new Date(payload.startDate).getTime()
      );

      expect(onOpenChange).toHaveBeenCalledWith(false);
    });

    it("submits an all-day event when the all-day checkbox is checked", async () => {
      const user = userEvent.setup();
      const onCreate = vi.fn();

      renderOpen({
        onCreate,
        defaultDate: new Date(2026, 3, 20, 10, 0),
      });

      await user.type(screen.getByLabelText(/title/i), "Holiday");
      await user.click(screen.getByRole("checkbox", { name: /all day/i }));
      await user.click(screen.getByRole("button", { name: /create event/i }));

      expect(onCreate).toHaveBeenCalledTimes(1);
      const payload = onCreate.mock.calls[0][0];
      expect(payload.isAllDay).toBe(true);
      expect(payload.title).toBe("Holiday");
    });

    /**
     * Wire-format test for #267: all-day events must send YYYY-MM-DD strings,
     * not ISO datetime strings. Sending ISO strings causes UTC-offset skew on
     * positive-offset clients (e.g. NZST UTC+12) where local Apr-20 midnight
     * is Apr-19 in UTC.
     */
    it("emits YYYY-MM-DD strings for startDate/endDate on all-day events, not ISO datetime strings", async () => {
      const user = userEvent.setup();
      const onCreate = vi.fn();

      renderOpen({
        onCreate,
        defaultDate: new Date(2026, 3, 20, 10, 0),
      });

      await user.type(screen.getByLabelText(/title/i), "Day off");
      await user.click(screen.getByRole("checkbox", { name: /all day/i }));

      const start = screen.getByLabelText(/^start/i);
      const end = screen.getByLabelText(/^end/i);

      await user.clear(start);
      await user.type(start, "2026-04-20");
      await user.clear(end);
      await user.type(end, "2026-04-22");

      await user.click(screen.getByRole("button", { name: /create event/i }));

      expect(onCreate).toHaveBeenCalledTimes(1);
      const payload = onCreate.mock.calls[0][0] as EventCreateInput;
      expect(payload.isAllDay).toBe(true);

      // Must be plain YYYY-MM-DD strings — not ISO datetime strings
      expect(payload.startDate).toBe("2026-04-20");
      expect(payload.endDate).toBe("2026-04-22");
    });

    it("trims whitespace from title and description on submit", async () => {
      const user = userEvent.setup();
      const onCreate = vi.fn();

      renderOpen({ onCreate });

      await user.type(
        screen.getByLabelText(/title/i),
        "   Whitespace Event   "
      );
      await user.type(screen.getByLabelText(/description/i), "   Notes   ");
      await user.click(screen.getByRole("button", { name: /create event/i }));

      const payload = onCreate.mock.calls[0][0];
      expect(payload.title).toBe("Whitespace Event");
      expect(payload.description).toBe("Notes");
    });

    it("resets the form when the dialog is reopened", async () => {
      const user = userEvent.setup();
      const { rerender } = render(
        <EventCreateDialog open onOpenChange={vi.fn()} onCreate={vi.fn()} />
      );

      await user.type(screen.getByLabelText(/title/i), "First Attempt");
      expect((screen.getByLabelText(/title/i) as HTMLInputElement).value).toBe(
        "First Attempt"
      );

      // Close the dialog
      rerender(
        <EventCreateDialog
          open={false}
          onOpenChange={vi.fn()}
          onCreate={vi.fn()}
        />
      );

      // Reopen
      rerender(
        <EventCreateDialog open onOpenChange={vi.fn()} onCreate={vi.fn()} />
      );

      expect((screen.getByLabelText(/title/i) as HTMLInputElement).value).toBe(
        ""
      );
    });
  });

  describe("calendar picker (#268)", () => {
    it("does not render the picker when no calendars are provided", () => {
      renderOpen();
      expect(screen.queryByLabelText(/^calendar/i)).not.toBeInTheDocument();
    });

    it("does not render the picker when only one writable calendar exists", () => {
      renderOpen({
        calendars: [makeCalendar({ id: "primary", summary: "you@x.com" })],
      });
      expect(screen.queryByLabelText(/^calendar/i)).not.toBeInTheDocument();
    });

    it("submits primary calendarId by default when no calendars are passed", async () => {
      const user = userEvent.setup();
      const onCreate = vi.fn();
      renderOpen({ onCreate });

      await user.type(screen.getByLabelText(/title/i), "Solo");
      await user.click(screen.getByRole("button", { name: /create event/i }));

      const payload = onCreate.mock.calls[0][0] as EventCreateInput;
      expect(payload.calendarId).toBe("primary");
    });

    it("submits the only-calendar id when one writable calendar exists", async () => {
      const user = userEvent.setup();
      const onCreate = vi.fn();
      renderOpen({
        onCreate,
        calendars: [
          makeCalendar({ id: "only@cal", summary: "Only", primary: true }),
        ],
      });

      await user.type(screen.getByLabelText(/title/i), "Single");
      await user.click(screen.getByRole("button", { name: /create event/i }));

      const payload = onCreate.mock.calls[0][0] as EventCreateInput;
      expect(payload.calendarId).toBe("only@cal");
    });

    it("renders the picker with all writable calendars when more than one", async () => {
      const user = userEvent.setup();
      renderOpen({
        calendars: [
          makeCalendar({ id: "primary", summary: "you@x.com", primary: true }),
          makeCalendar({
            id: "family@cal",
            summary: "Family",
            primary: false,
            accessRole: "writer",
          }),
        ],
      });

      const trigger = screen.getByLabelText(/^calendar/i);
      expect(trigger).toBeInTheDocument();

      // Open the listbox to inspect options
      await user.click(trigger);
      const listbox = await screen.findByRole("listbox");
      expect(within(listbox).getByText("you@x.com")).toBeInTheDocument();
      expect(within(listbox).getByText("Family")).toBeInTheDocument();
    });

    it("defaults selection to the primary calendar when defaultCalendarId is not provided", async () => {
      const user = userEvent.setup();
      const onCreate = vi.fn();
      renderOpen({
        onCreate,
        calendars: [
          makeCalendar({ id: "primary", summary: "you@x.com", primary: true }),
          makeCalendar({
            id: "family@cal",
            summary: "Family",
            primary: false,
            accessRole: "writer",
          }),
        ],
      });

      await user.type(screen.getByLabelText(/title/i), "Default");
      await user.click(screen.getByRole("button", { name: /create event/i }));

      const payload = onCreate.mock.calls[0][0] as EventCreateInput;
      expect(payload.calendarId).toBe("primary");
    });

    it("defaults selection to defaultCalendarId when present in the writable list", async () => {
      const user = userEvent.setup();
      const onCreate = vi.fn();
      renderOpen({
        onCreate,
        defaultCalendarId: "family@cal",
        calendars: [
          makeCalendar({ id: "primary", summary: "you@x.com", primary: true }),
          makeCalendar({
            id: "family@cal",
            summary: "Family",
            primary: false,
            accessRole: "writer",
          }),
        ],
      });

      await user.type(screen.getByLabelText(/title/i), "Family event");
      await user.click(screen.getByRole("button", { name: /create event/i }));

      const payload = onCreate.mock.calls[0][0] as EventCreateInput;
      expect(payload.calendarId).toBe("family@cal");
    });

    it("falls back to the primary calendar when defaultCalendarId is no longer writable", async () => {
      const user = userEvent.setup();
      const onCreate = vi.fn();
      renderOpen({
        onCreate,
        defaultCalendarId: "stale@cal",
        calendars: [
          makeCalendar({ id: "primary", summary: "you@x.com", primary: true }),
          makeCalendar({
            id: "family@cal",
            summary: "Family",
            primary: false,
            accessRole: "writer",
          }),
        ],
      });

      await user.type(screen.getByLabelText(/title/i), "Stale fallback");
      await user.click(screen.getByRole("button", { name: /create event/i }));

      const payload = onCreate.mock.calls[0][0] as EventCreateInput;
      expect(payload.calendarId).toBe("primary");
    });

    it("reconciles a stale persisted id when the writable list arrives mid-dialog", async () => {
      // Simulate the loading window: the dialog mounts before
      // useWritableCalendars resolves. The persisted id ("revoked@cal") is no
      // longer in the writable list — without the mid-dialog reconciliation
      // guard, the dialog would submit "revoked@cal" and Google would 403.
      const onCreate = vi.fn();
      const writableList = [
        makeCalendar({ id: "primary", summary: "you@x.com", primary: true }),
        makeCalendar({
          id: "family@cal",
          summary: "Family",
          primary: false,
          accessRole: "writer",
        }),
      ];

      const { rerender } = render(
        <EventCreateDialog
          open
          onOpenChange={vi.fn()}
          onCreate={onCreate}
          defaultCalendarId="revoked@cal"
          calendars={[]}
        />
      );

      // Now the writable list resolves while the dialog is still open.
      rerender(
        <EventCreateDialog
          open
          onOpenChange={vi.fn()}
          onCreate={onCreate}
          defaultCalendarId="revoked@cal"
          calendars={writableList}
        />
      );

      const user = userEvent.setup();
      await user.type(screen.getByLabelText(/title/i), "Reconciled");
      await user.click(screen.getByRole("button", { name: /create event/i }));

      const payload = onCreate.mock.calls[0][0] as EventCreateInput;
      // Stale "revoked@cal" must be replaced with the primary fallback once
      // the writable list shows it's no longer valid.
      expect(payload.calendarId).toBe("primary");
    });

    it("preserves a still-valid persisted id when the writable list arrives mid-dialog", async () => {
      // Companion to the stale-id test: if the persisted id is in the
      // late-arriving list, no reconciliation should happen — we don't want
      // to clobber the user's preference with the primary fallback.
      const onCreate = vi.fn();
      const writableList = [
        makeCalendar({ id: "primary", summary: "you@x.com", primary: true }),
        makeCalendar({
          id: "family@cal",
          summary: "Family",
          primary: false,
          accessRole: "writer",
        }),
      ];

      const { rerender } = render(
        <EventCreateDialog
          open
          onOpenChange={vi.fn()}
          onCreate={onCreate}
          defaultCalendarId="family@cal"
          calendars={[]}
        />
      );

      rerender(
        <EventCreateDialog
          open
          onOpenChange={vi.fn()}
          onCreate={onCreate}
          defaultCalendarId="family@cal"
          calendars={writableList}
        />
      );

      const user = userEvent.setup();
      await user.type(screen.getByLabelText(/title/i), "Preserved");
      await user.click(screen.getByRole("button", { name: /create event/i }));

      const payload = onCreate.mock.calls[0][0] as EventCreateInput;
      expect(payload.calendarId).toBe("family@cal");
    });

    it("submits the user's chosen calendarId after they switch the picker", async () => {
      const user = userEvent.setup();
      const onCreate = vi.fn();
      renderOpen({
        onCreate,
        calendars: [
          makeCalendar({ id: "primary", summary: "you@x.com", primary: true }),
          makeCalendar({
            id: "family@cal",
            summary: "Family",
            primary: false,
            accessRole: "writer",
          }),
        ],
      });

      await user.type(screen.getByLabelText(/title/i), "Switch then submit");
      await user.click(screen.getByLabelText(/^calendar/i));
      await user.click(await screen.findByRole("option", { name: "Family" }));
      await user.click(screen.getByRole("button", { name: /create event/i }));

      const payload = onCreate.mock.calls[0][0] as EventCreateInput;
      expect(payload.calendarId).toBe("family@cal");
    });
  });

  describe("cancellation", () => {
    it("calls onOpenChange(false) when the Cancel button is clicked without calling onCreate", async () => {
      const user = userEvent.setup();
      const onCreate = vi.fn();
      const onOpenChange = vi.fn();

      renderOpen({ onCreate, onOpenChange });

      await user.type(screen.getByLabelText(/title/i), "Never Mind");
      await user.click(screen.getByRole("button", { name: /cancel/i }));

      expect(onCreate).not.toHaveBeenCalled();
      expect(onOpenChange).toHaveBeenCalledWith(false);
    });
  });
});
