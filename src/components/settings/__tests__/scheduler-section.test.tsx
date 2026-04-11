/**
 * Tests for SchedulerSection component
 */
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SchedulerSection } from "../scheduler-section";

// Mock Slider since Radix UI components don't work in jsdom
vi.mock("@/components/ui/slider", () => ({
  Slider: ({
    value,
    onValueChange,
    id,
  }: {
    value: number[];
    min: number;
    max: number;
    step: number;
    id?: string;
    onValueChange: (value: number[]) => void;
  }) => (
    <input
      type="range"
      data-testid={id ?? "slider"}
      value={value[0]}
      onChange={(e) => onValueChange([parseFloat(e.target.value)])}
    />
  ),
}));

const defaultValues = {
  schedulerIntervalSeconds: 10,
  schedulerPauseOnInteractionSeconds: 30,
};

describe("SchedulerSection", () => {
  const mockOnChange = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders section title and description", () => {
    render(<SchedulerSection values={defaultValues} onChange={mockOnChange} />);

    expect(screen.getByText("Screen Rotation")).toBeInTheDocument();
    expect(
      screen.getByText(/Configure how the scheduler rotates/)
    ).toBeInTheDocument();
  });

  it("renders rotation interval slider with current value", () => {
    render(<SchedulerSection values={defaultValues} onChange={mockOnChange} />);

    expect(screen.getByText("Rotation Interval")).toBeInTheDocument();
    expect(screen.getByText("10s")).toBeInTheDocument();
    expect(screen.getByTestId("scheduler-interval")).toBeInTheDocument();
  });

  it("renders pause on interaction slider with current value", () => {
    render(<SchedulerSection values={defaultValues} onChange={mockOnChange} />);

    expect(screen.getByText("Pause on Interaction")).toBeInTheDocument();
    expect(screen.getByText("30s")).toBeInTheDocument();
    expect(screen.getByTestId("scheduler-pause")).toBeInTheDocument();
  });

  it("formats duration with minutes when >= 60s", () => {
    render(
      <SchedulerSection
        values={{
          schedulerIntervalSeconds: 90,
          schedulerPauseOnInteractionSeconds: 120,
        }}
        onChange={mockOnChange}
      />
    );

    expect(screen.getByText("1m 30s")).toBeInTheDocument();
    expect(screen.getByText("2m")).toBeInTheDocument();
  });

  it("fires onChange when interval slider changes", () => {
    render(<SchedulerSection values={defaultValues} onChange={mockOnChange} />);

    const slider = screen.getByTestId("scheduler-interval");
    // Simulate slider value change
    const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
      window.HTMLInputElement.prototype,
      "value"
    )!.set!;
    nativeInputValueSetter.call(slider, "30");
    slider.dispatchEvent(new Event("change", { bubbles: true }));

    expect(mockOnChange).toHaveBeenCalledWith({
      schedulerIntervalSeconds: 30,
    });
  });

  it("fires onChange when pause slider changes", () => {
    render(<SchedulerSection values={defaultValues} onChange={mockOnChange} />);

    const slider = screen.getByTestId("scheduler-pause");
    const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
      window.HTMLInputElement.prototype,
      "value"
    )!.set!;
    nativeInputValueSetter.call(slider, "60");
    slider.dispatchEvent(new Event("change", { bubbles: true }));

    expect(mockOnChange).toHaveBeenCalledWith({
      schedulerPauseOnInteractionSeconds: 60,
    });
  });

  it("shows help text for both controls", () => {
    render(<SchedulerSection values={defaultValues} onChange={mockOnChange} />);

    expect(
      screen.getByText(/Time between automatic screen rotations/)
    ).toBeInTheDocument();
    expect(
      screen.getByText(/How long to pause rotation after user interaction/)
    ).toBeInTheDocument();
  });
});
