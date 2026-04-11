/**
 * Tests for TransitionSection component
 */
import type { TransitionConfig } from "@/components/scheduler/types";
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { TransitionSection } from "../transition-section";

// Mock Slider since Radix UI components don't work in jsdom
// Use a button-based mock that triggers onValueChange on click
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
    <button
      type="button"
      data-testid={id ?? "slider"}
      data-value={value[0]}
      onClick={() => onValueChange([600])}
    >
      {value[0]}
    </button>
  ),
}));

// Mock Switch since Radix UI components don't work in jsdom
vi.mock("@/components/ui/switch", () => ({
  Switch: ({
    checked,
    onCheckedChange,
    id,
  }: {
    checked: boolean;
    id?: string;
    onCheckedChange: (checked: boolean) => void;
  }) => (
    <input
      type="checkbox"
      data-testid={id ?? "switch"}
      checked={checked}
      onChange={(e) => onCheckedChange(e.target.checked)}
    />
  ),
}));

// Mock Select since Radix UI components don't work in jsdom
vi.mock("@/components/ui/select", () => ({
  Select: ({
    value,
    onValueChange,
    children,
  }: {
    value: string;
    onValueChange: (value: string) => void;
    children: React.ReactNode;
  }) => (
    <select
      data-testid="transition-type-select"
      value={value}
      onChange={(e) => onValueChange(e.target.value)}
    >
      {children}
    </select>
  ),
  SelectTrigger: ({ children }: { children: React.ReactNode; id?: string }) => (
    <>{children}</>
  ),
  SelectContent: ({ children }: { children: React.ReactNode }) => (
    <>{children}</>
  ),
  SelectItem: ({
    value,
    children,
  }: {
    value: string;
    children: React.ReactNode;
  }) => <option value={value}>{children}</option>,
  SelectValue: ({ placeholder }: { placeholder?: string }) => (
    <span>{placeholder}</span>
  ),
}));

const enabledConfig: TransitionConfig = { type: "slide", durationMs: 400 };
const disabledConfig: TransitionConfig = { type: "none", durationMs: 400 };

describe("TransitionSection", () => {
  const mockOnChange = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders section title and description", () => {
    render(
      <TransitionSection values={enabledConfig} onChange={mockOnChange} />
    );

    expect(screen.getByText("Page Transitions")).toBeInTheDocument();
    expect(
      screen.getByText(/Configure animated transitions/)
    ).toBeInTheDocument();
  });

  it("renders toggle switch checked when transitions enabled", () => {
    render(
      <TransitionSection values={enabledConfig} onChange={mockOnChange} />
    );

    const toggle = screen.getByTestId("transition-toggle");
    expect(toggle).toBeChecked();
  });

  it("renders toggle switch unchecked when type is none", () => {
    render(
      <TransitionSection values={disabledConfig} onChange={mockOnChange} />
    );

    const toggle = screen.getByTestId("transition-toggle");
    expect(toggle).not.toBeChecked();
  });

  it("calls onChange with type none when toggle is disabled", () => {
    render(
      <TransitionSection values={enabledConfig} onChange={mockOnChange} />
    );

    const toggle = screen.getByTestId("transition-toggle");
    fireEvent.click(toggle);

    expect(mockOnChange).toHaveBeenCalledWith({
      type: "none",
      durationMs: 400,
    });
  });

  it("calls onChange with slide when toggle is enabled from disabled", () => {
    render(
      <TransitionSection values={disabledConfig} onChange={mockOnChange} />
    );

    const toggle = screen.getByTestId("transition-toggle");
    fireEvent.click(toggle);

    expect(mockOnChange).toHaveBeenCalledWith({
      type: "slide",
      durationMs: 400,
    });
  });

  it("shows type and duration controls when enabled", () => {
    render(
      <TransitionSection values={enabledConfig} onChange={mockOnChange} />
    );

    expect(screen.getByText("Transition Type")).toBeInTheDocument();
    expect(screen.getByText("Duration")).toBeInTheDocument();
    expect(screen.getByText("400ms")).toBeInTheDocument();
  });

  it("hides type and duration controls when disabled", () => {
    render(
      <TransitionSection values={disabledConfig} onChange={mockOnChange} />
    );

    expect(screen.queryByText("Transition Type")).not.toBeInTheDocument();
    expect(screen.queryByText("Duration")).not.toBeInTheDocument();
  });

  it("fires onChange when duration slider changes", () => {
    render(
      <TransitionSection values={enabledConfig} onChange={mockOnChange} />
    );

    const slider = screen.getByTestId("transition-duration");
    fireEvent.click(slider);

    expect(mockOnChange).toHaveBeenCalledWith({
      type: "slide",
      durationMs: 600,
    });
  });

  it("fires onChange when transition type changes", () => {
    render(
      <TransitionSection values={enabledConfig} onChange={mockOnChange} />
    );

    const select = screen.getByTestId("transition-type-select");
    fireEvent.change(select, { target: { value: "fade" } });

    expect(mockOnChange).toHaveBeenCalledWith({
      type: "fade",
      durationMs: 400,
    });
  });

  it("shows reduced motion notice", () => {
    render(
      <TransitionSection values={enabledConfig} onChange={mockOnChange} />
    );

    expect(screen.getByText(/reduce motion/)).toBeInTheDocument();
  });
});
