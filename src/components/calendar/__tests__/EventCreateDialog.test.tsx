import type { TEventColor } from "@/types/calendar";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { EventCreateDialog } from "../EventCreateDialog";

/**
 * Tests for EventCreateDialog — issue #82.
 *
 * The dialog is a controlled component: the parent owns `open` and receives
 * the submitted event via `onCreate`. The dialog does not mutate context
 * itself (that's the caller's responsibility), which keeps it easy to reuse.
 */

function renderOpen(
  overrides: {
    onCreate?: (event: {
      title: string;
      startDate: string;
      endDate: string;
      color: TEventColor;
      description: string;
      isAllDay: boolean;
    }) => void;
    onOpenChange?: (open: boolean) => void;
    defaultDate?: Date;
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
