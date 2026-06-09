/**
 * Tests for RewardSection component
 * Following TDD - tests are written before implementation
 */
import { type ReactNode } from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PointsProvider } from "../../rewards/points-context";
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

  describe("total-points display", () => {
    const mockFetch = vi.fn();

    function withPointsProvider(profileId: string | null) {
      return function Wrapper({ children }: { children: ReactNode }) {
        return (
          <PointsProvider profileId={profileId}>{children}</PointsProvider>
        );
      };
    }

    beforeEach(() => {
      mockFetch.mockReset();
      global.fetch = mockFetch;
    });

    afterEach(() => {
      vi.clearAllMocks();
    });

    it("shows the active profile's total points when enabled", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            totalPoints: 1250,
            enabled: true,
            defaultTaskPoints: 10,
            showPointsOnCompletion: true,
          }),
      });

      render(
        <RewardSection
          values={{ ...defaultValues, rewardSystemEnabled: true }}
          onChange={mockOnChange}
        />,
        { wrapper: withPointsProvider("profile-1") }
      );

      await waitFor(() => {
        expect(screen.getByText(/1,250/)).toBeInTheDocument();
      });
      expect(screen.getByText(/total points/i)).toBeInTheDocument();
    });

    it("does not render the total-points row when rewards are disabled", () => {
      render(
        <RewardSection
          values={{ ...defaultValues, rewardSystemEnabled: false }}
          onChange={mockOnChange}
        />,
        { wrapper: withPointsProvider("profile-1") }
      );

      expect(screen.queryByText(/total points/i)).not.toBeInTheDocument();
    });

    it("does not break when no PointsProvider is mounted", () => {
      render(
        <RewardSection
          values={{ ...defaultValues, rewardSystemEnabled: true }}
          onChange={mockOnChange}
        />
      );

      // Should not throw — total-points row is skipped silently.
      expect(screen.getByText(/default points per task/i)).toBeInTheDocument();
    });
  });
});
