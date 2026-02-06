/**
 * Tests for RewardSection component
 * Following TDD - tests are written before implementation
 */
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { RewardSection } from "../reward-section";

const defaultValues = {
  rewardSystemEnabled: false,
  defaultTaskPoints: 10,
  showPointsOnCompletion: true,
};

describe("RewardSection", () => {
  const mockOnChange = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders enable toggle", () => {
    render(<RewardSection values={defaultValues} onChange={mockOnChange} />);

    expect(screen.getByText(/enable reward system/i)).toBeInTheDocument();
  });

  it("hides options when reward system is disabled", () => {
    render(<RewardSection values={defaultValues} onChange={mockOnChange} />);

    expect(
      screen.queryByText(/default points per task/i)
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText(/show points on completion/i)
    ).not.toBeInTheDocument();
  });

  it("shows options when reward system is enabled", () => {
    render(
      <RewardSection
        values={{ ...defaultValues, rewardSystemEnabled: true }}
        onChange={mockOnChange}
      />
    );

    expect(screen.getByText(/default points per task/i)).toBeInTheDocument();
    expect(screen.getByText(/show points on completion/i)).toBeInTheDocument();
  });

  it("onChange fires when toggle is clicked", async () => {
    const user = userEvent.setup();

    render(<RewardSection values={defaultValues} onChange={mockOnChange} />);

    const toggle = screen.getByRole("switch");
    await user.click(toggle);

    expect(mockOnChange).toHaveBeenCalledWith(
      expect.objectContaining({ rewardSystemEnabled: true })
    );
  });

  it("displays current points value when enabled", () => {
    render(
      <RewardSection
        values={{
          ...defaultValues,
          rewardSystemEnabled: true,
          defaultTaskPoints: 25,
        }}
        onChange={mockOnChange}
      />
    );

    const input = screen.getByDisplayValue("25");
    expect(input).toBeInTheDocument();
  });
});
