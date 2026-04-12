/**
 * Tests for DisplaySection component
 * Following TDD - tests are written before implementation
 */
import { MockSlider } from "@/lib/test-utils/ui-component-mocks";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DisplaySection } from "../display-section";

// Mock Slider since Radix UI components don't work in jsdom
vi.mock("@/components/ui/slider", () => ({
  Slider: MockSlider,
}));

// Mock next-themes
const mockSetTheme = vi.fn();

vi.mock("next-themes", () => ({
  useTheme: () => ({
    theme: "light",
    setTheme: mockSetTheme,
  }),
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
    expect(screen.getByLabelText(/system/i)).toBeInTheDocument();
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

  it("onChange fires and setTheme is called when theme changes", async () => {
    const user = userEvent.setup();

    render(<DisplaySection values={defaultValues} onChange={mockOnChange} />);

    const darkRadio = screen.getByLabelText(/dark/i);
    await user.click(darkRadio);

    expect(mockOnChange).toHaveBeenCalledWith(
      expect.objectContaining({ theme: "dark" })
    );
    expect(mockSetTheme).toHaveBeenCalledWith("dark");
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

  it("maps legacy 'auto' theme value to 'system' for display", () => {
    render(
      <DisplaySection
        values={{ ...defaultValues, theme: "auto" }}
        onChange={mockOnChange}
      />
    );

    const systemRadio = screen.getByLabelText(/system/i);
    expect(systemRadio).toBeChecked();
  });

  it("calls setTheme with 'system' when system option is clicked", async () => {
    const user = userEvent.setup();

    render(<DisplaySection values={defaultValues} onChange={mockOnChange} />);

    const systemRadio = screen.getByLabelText(/system/i);
    await user.click(systemRadio);

    expect(mockSetTheme).toHaveBeenCalledWith("system");
    expect(mockOnChange).toHaveBeenCalledWith(
      expect.objectContaining({ theme: "system" })
    );
  });
});
