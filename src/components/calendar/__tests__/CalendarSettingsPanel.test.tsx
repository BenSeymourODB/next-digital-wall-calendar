/**
 * Component tests for CalendarSettingsPanel (#86).
 *
 * Drives the panel through the real MockCalendarProvider so we also
 * verify that the panel wires into the context setters correctly and
 * that the displayed state reflects the provider.
 */
import { MockCalendarProvider } from "@/components/providers/MockCalendarProvider";
import type { TWeekStartDay } from "@/types/calendar";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { CalendarSettingsPanel } from "../CalendarSettingsPanel";

interface ProviderOpts {
  badge?: "dot" | "colored";
  use24HourFormat?: boolean;
  weekStartDay?: TWeekStartDay;
  agendaModeGroupBy?: "date" | "color";
}

function renderPanel(opts: ProviderOpts = {}) {
  return render(
    <MockCalendarProvider
      badge={opts.badge}
      use24HourFormat={opts.use24HourFormat}
      weekStartDay={opts.weekStartDay}
      agendaModeGroupBy={opts.agendaModeGroupBy}
    >
      <CalendarSettingsPanel />
    </MockCalendarProvider>
  );
}

async function openPanel() {
  const user = userEvent.setup();
  await user.click(screen.getByTestId("calendar-settings-trigger"));
  const panel = await screen.findByTestId("calendar-settings-panel");
  return { user, panel };
}

describe("CalendarSettingsPanel", () => {
  it("renders a gear trigger with an accessible label", () => {
    renderPanel();
    const trigger = screen.getByTestId("calendar-settings-trigger");
    expect(trigger).toHaveAccessibleName(/calendar settings/i);
  });

  it("opens a popover with all four setting controls when the trigger is clicked", async () => {
    renderPanel();
    const { panel } = await openPanel();

    // Badge style toggle
    expect(
      within(panel).getByTestId("setting-badge-style")
    ).toBeInTheDocument();
    // 24-hour toggle
    expect(within(panel).getByTestId("setting-24hour")).toBeInTheDocument();
    // Agenda group-by control
    expect(
      within(panel).getByTestId("setting-agenda-group-by")
    ).toBeInTheDocument();
    // Week start day control
    expect(
      within(panel).getByTestId("setting-week-start-day")
    ).toBeInTheDocument();
  });

  it("reflects the provider's initial values", async () => {
    renderPanel({
      badge: "dot",
      use24HourFormat: false,
      weekStartDay: 1,
      agendaModeGroupBy: "color",
    });

    const { panel } = await openPanel();

    // Badge style: switch 'unchecked' maps to 'dot', 'checked' maps to 'colored'
    const badge = within(panel).getByTestId("setting-badge-style");
    expect(badge).toHaveAttribute("aria-checked", "false");

    // 24-hour: false
    const hour = within(panel).getByTestId("setting-24hour");
    expect(hour).toHaveAttribute("aria-checked", "false");

    // Week start day: Monday
    const monday = within(panel).getByTestId("setting-week-start-day-monday");
    expect(monday).toHaveAttribute("aria-checked", "true");

    // Agenda group-by: color
    const groupColor = within(panel).getByTestId(
      "setting-agenda-group-by-color"
    );
    expect(groupColor).toHaveAttribute("aria-checked", "true");
  });

  it("toggles badge variant when the badge switch is clicked", async () => {
    renderPanel({ badge: "colored" });
    const { user, panel } = await openPanel();

    const badge = within(panel).getByTestId("setting-badge-style");
    expect(badge).toHaveAttribute("aria-checked", "true");

    await user.click(badge);

    expect(badge).toHaveAttribute("aria-checked", "false");
  });

  it("toggles 24-hour format when the hour switch is clicked", async () => {
    renderPanel({ use24HourFormat: true });
    const { user, panel } = await openPanel();

    const hour = within(panel).getByTestId("setting-24hour");
    expect(hour).toHaveAttribute("aria-checked", "true");

    await user.click(hour);

    expect(hour).toHaveAttribute("aria-checked", "false");
  });

  it("switches week start day to Monday when the Monday option is selected", async () => {
    renderPanel({ weekStartDay: 0 });
    const { user, panel } = await openPanel();

    const sunday = within(panel).getByTestId("setting-week-start-day-sunday");
    const monday = within(panel).getByTestId("setting-week-start-day-monday");

    expect(sunday).toHaveAttribute("aria-checked", "true");
    expect(monday).toHaveAttribute("aria-checked", "false");

    await user.click(monday);

    expect(monday).toHaveAttribute("aria-checked", "true");
    expect(sunday).toHaveAttribute("aria-checked", "false");
  });

  it("switches agenda group-by to color when the color option is selected", async () => {
    renderPanel({ agendaModeGroupBy: "date" });
    const { user, panel } = await openPanel();

    const byColor = within(panel).getByTestId("setting-agenda-group-by-color");
    expect(byColor).toHaveAttribute("aria-checked", "false");

    await user.click(byColor);

    expect(byColor).toHaveAttribute("aria-checked", "true");
  });
});
