/**
 * Tests for CalendarTransitionSection — the "Off / Fast / Normal / Slow"
 * picker that drives `UserSettings.calendarTransitionSpeed` (issue #283).
 *
 * Contract:
 *   - Renders the four canonical speeds as a togglable group.
 *   - Marks the current selection as pressed.
 *   - Fires `onChange({ calendarTransitionSpeed })` with the new speed when
 *     the user picks a different value.
 *   - Refuses to leave the group empty: clicking the currently-selected
 *     toggle is a no-op (no `onChange` call), so users always have a value.
 */
import { fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { CalendarTransitionSection } from "../calendar-transition-section";

describe("CalendarTransitionSection", () => {
  const onChange = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the section title and helper copy", () => {
    render(
      <CalendarTransitionSection
        values={{ calendarTransitionSpeed: "normal" }}
        onChange={onChange}
      />
    );

    expect(screen.getByText("Calendar Transitions")).toBeInTheDocument();
    expect(screen.getByText(/animations when navigating/i)).toBeInTheDocument();
  });

  it("exposes the four canonical speed options", () => {
    render(
      <CalendarTransitionSection
        values={{ calendarTransitionSpeed: "normal" }}
        onChange={onChange}
      />
    );

    const group = screen.getByTestId("calendar-transition-speed");
    expect(
      within(group).getByRole("radio", { name: "Off" })
    ).toBeInTheDocument();
    expect(
      within(group).getByRole("radio", { name: "Fast" })
    ).toBeInTheDocument();
    expect(
      within(group).getByRole("radio", { name: "Normal" })
    ).toBeInTheDocument();
    expect(
      within(group).getByRole("radio", { name: "Slow" })
    ).toBeInTheDocument();
  });

  it.each(["off", "fast", "normal", "slow"] as const)(
    "marks the %s option as the active selection",
    (speed) => {
      const labelByValue: Record<string, string> = {
        off: "Off",
        fast: "Fast",
        normal: "Normal",
        slow: "Slow",
      };
      render(
        <CalendarTransitionSection
          values={{ calendarTransitionSpeed: speed }}
          onChange={onChange}
        />
      );
      const group = screen.getByTestId("calendar-transition-speed");
      const active = within(group).getByRole("radio", {
        name: labelByValue[speed],
      });
      expect(active).toHaveAttribute("data-state", "on");
    }
  );

  it("fires onChange with the new speed when the user picks a different value", () => {
    render(
      <CalendarTransitionSection
        values={{ calendarTransitionSpeed: "normal" }}
        onChange={onChange}
      />
    );

    fireEvent.click(screen.getByRole("radio", { name: "Off" }));

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith({ calendarTransitionSpeed: "off" });
  });

  it("does not call onChange when the user re-selects the currently-active speed", () => {
    // Radix ToggleGroup type=single will fire onValueChange with "" when the
    // pressed item is clicked again. Squashing that protects callers from
    // having to defend against an empty string.
    render(
      <CalendarTransitionSection
        values={{ calendarTransitionSpeed: "fast" }}
        onChange={onChange}
      />
    );

    fireEvent.click(screen.getByRole("radio", { name: "Fast" }));

    expect(onChange).not.toHaveBeenCalled();
  });

  it("notes the prefers-reduced-motion behaviour for users", () => {
    render(
      <CalendarTransitionSection
        values={{ calendarTransitionSpeed: "normal" }}
        onChange={onChange}
      />
    );

    expect(screen.getByText(/reduce motion/i)).toBeInTheDocument();
  });
});
