/**
 * Tests for CalendarSection component
 * TDD — tests written before implementation
 */
import { MockSlider } from "@/lib/test-utils/ui-component-mocks";
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { CalendarSection } from "../calendar-section";

vi.mock("@/components/ui/slider", () => ({
  Slider: MockSlider,
}));

const defaultValues = {
  calendarRefreshIntervalMinutes: 15,
  calendarFetchMonthsAhead: 6,
  calendarFetchMonthsBehind: 1,
  calendarMaxEventsPerDay: 3,
};

describe("CalendarSection", () => {
  const mockOnChange = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders section title and description", () => {
    render(<CalendarSection values={defaultValues} onChange={mockOnChange} />);

    expect(screen.getByText("Calendar")).toBeInTheDocument();
    expect(
      screen.getByText(/How often the calendar fetches/i)
    ).toBeInTheDocument();
  });

  it("renders refresh interval control with current value", () => {
    render(<CalendarSection values={defaultValues} onChange={mockOnChange} />);

    expect(screen.getByText("Refresh Interval")).toBeInTheDocument();
    expect(screen.getByText("15 minutes")).toBeInTheDocument();
    expect(screen.getByTestId("calendar-refresh-interval")).toBeInTheDocument();
  });

  it("renders fetch-ahead control with current value", () => {
    render(<CalendarSection values={defaultValues} onChange={mockOnChange} />);

    expect(screen.getByText("Months Ahead")).toBeInTheDocument();
    expect(screen.getByText("6 months")).toBeInTheDocument();
    expect(screen.getByTestId("calendar-fetch-ahead")).toBeInTheDocument();
  });

  it("renders fetch-behind control with current value", () => {
    render(<CalendarSection values={defaultValues} onChange={mockOnChange} />);

    expect(screen.getByText("Months Behind")).toBeInTheDocument();
    expect(screen.getByText("1 month")).toBeInTheDocument();
    expect(screen.getByTestId("calendar-fetch-behind")).toBeInTheDocument();
  });

  it("renders max-events-per-day control with current value", () => {
    render(<CalendarSection values={defaultValues} onChange={mockOnChange} />);

    expect(screen.getByText("Max Events Per Day")).toBeInTheDocument();
    expect(screen.getByText("3 events")).toBeInTheDocument();
    expect(screen.getByTestId("calendar-max-events")).toBeInTheDocument();
  });

  it("uses singular 'event' label when max-events is 1", () => {
    render(
      <CalendarSection
        values={{ ...defaultValues, calendarMaxEventsPerDay: 1 }}
        onChange={mockOnChange}
      />
    );

    expect(screen.getByText("1 event")).toBeInTheDocument();
  });

  it("uses singular 'month' label when fetch-behind is 1", () => {
    render(
      <CalendarSection
        values={{ ...defaultValues, calendarFetchMonthsBehind: 1 }}
        onChange={mockOnChange}
      />
    );

    expect(screen.getByText("1 month")).toBeInTheDocument();
  });

  it("uses plural 'months' label when fetch-behind is 0", () => {
    render(
      <CalendarSection
        values={{ ...defaultValues, calendarFetchMonthsBehind: 0 }}
        onChange={mockOnChange}
      />
    );

    expect(screen.getByText("0 months")).toBeInTheDocument();
  });

  it("fires onChange when refresh interval slider changes", () => {
    render(<CalendarSection values={defaultValues} onChange={mockOnChange} />);

    const slider = screen.getByTestId("calendar-refresh-interval");
    const setter = Object.getOwnPropertyDescriptor(
      window.HTMLInputElement.prototype,
      "value"
    )!.set!;
    setter.call(slider, "30");
    slider.dispatchEvent(new Event("change", { bubbles: true }));

    expect(mockOnChange).toHaveBeenCalledWith({
      calendarRefreshIntervalMinutes: 30,
    });
  });

  it("fires onChange when fetch-ahead slider changes", () => {
    render(<CalendarSection values={defaultValues} onChange={mockOnChange} />);

    const slider = screen.getByTestId("calendar-fetch-ahead");
    const setter = Object.getOwnPropertyDescriptor(
      window.HTMLInputElement.prototype,
      "value"
    )!.set!;
    setter.call(slider, "12");
    slider.dispatchEvent(new Event("change", { bubbles: true }));

    expect(mockOnChange).toHaveBeenCalledWith({
      calendarFetchMonthsAhead: 12,
    });
  });

  it("fires onChange when fetch-behind slider changes", () => {
    render(<CalendarSection values={defaultValues} onChange={mockOnChange} />);

    const slider = screen.getByTestId("calendar-fetch-behind");
    const setter = Object.getOwnPropertyDescriptor(
      window.HTMLInputElement.prototype,
      "value"
    )!.set!;
    setter.call(slider, "3");
    slider.dispatchEvent(new Event("change", { bubbles: true }));

    expect(mockOnChange).toHaveBeenCalledWith({
      calendarFetchMonthsBehind: 3,
    });
  });

  it("fires onChange when max-events slider changes", () => {
    render(<CalendarSection values={defaultValues} onChange={mockOnChange} />);

    const slider = screen.getByTestId("calendar-max-events");
    const setter = Object.getOwnPropertyDescriptor(
      window.HTMLInputElement.prototype,
      "value"
    )!.set!;
    setter.call(slider, "5");
    slider.dispatchEvent(new Event("change", { bubbles: true }));

    expect(mockOnChange).toHaveBeenCalledWith({
      calendarMaxEventsPerDay: 5,
    });
  });
});
