/**
 * Tests for DisplaySection component
 * Following TDD - tests are written before implementation
 */
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DisplaySection } from "../display-section";

// Mock Slider since Radix UI components don't work in jsdom
vi.mock("@/components/ui/slider", () => ({
  Slider: ({
    value,
    onValueChange,
  }: {
    value: number[];
    min: number;
    max: number;
    step: number;
    onValueChange: (value: number[]) => void;
  }) => (
    <input
      type="range"
      data-testid="zoom-slider"
      value={value[0]}
      onChange={(e) => onValueChange([parseFloat(e.target.value)])}
    />
  ),
}));

const defaultValues = {
  theme: "light",
  timeFormat: "12h",
  dateFormat: "MM/DD/YYYY",
  defaultZoomLevel: 1.0,
};

describe("DisplaySection", () => {
  const mockOnChange = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders theme options", () => {
    render(<DisplaySection values={defaultValues} onChange={mockOnChange} />);

    expect(screen.getByLabelText(/light/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/dark/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/auto/i)).toBeInTheDocument();
  });

  it("renders time format options", () => {
    render(<DisplaySection values={defaultValues} onChange={mockOnChange} />);

    expect(screen.getByLabelText(/12-hour/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/24-hour/i)).toBeInTheDocument();
  });

  it("renders zoom slider", () => {
    render(<DisplaySection values={defaultValues} onChange={mockOnChange} />);

    expect(screen.getByText(/zoom/i)).toBeInTheDocument();
    // Slider should show percentage
    expect(screen.getByText(/100%/)).toBeInTheDocument();
  });

  it("onChange fires when theme changes", async () => {
    const user = userEvent.setup();

    render(<DisplaySection values={defaultValues} onChange={mockOnChange} />);

    const darkRadio = screen.getByLabelText(/dark/i);
    await user.click(darkRadio);

    expect(mockOnChange).toHaveBeenCalledWith(
      expect.objectContaining({ theme: "dark" })
    );
  });

  it("onChange fires when time format changes", async () => {
    const user = userEvent.setup();

    render(<DisplaySection values={defaultValues} onChange={mockOnChange} />);

    const twentyFourHour = screen.getByLabelText(/24-hour/i);
    await user.click(twentyFourHour);

    expect(mockOnChange).toHaveBeenCalledWith(
      expect.objectContaining({ timeFormat: "24h" })
    );
  });

  it("shows correct initial theme selection", () => {
    render(
      <DisplaySection
        values={{ ...defaultValues, theme: "dark" }}
        onChange={mockOnChange}
      />
    );

    const darkRadio = screen.getByLabelText(/dark/i);
    expect(darkRadio).toBeChecked();
  });

  it("shows correct initial time format selection", () => {
    render(
      <DisplaySection
        values={{ ...defaultValues, timeFormat: "24h" }}
        onChange={mockOnChange}
      />
    );

    const twentyFourHour = screen.getByLabelText(/24-hour/i);
    expect(twentyFourHour).toBeChecked();
  });
});
