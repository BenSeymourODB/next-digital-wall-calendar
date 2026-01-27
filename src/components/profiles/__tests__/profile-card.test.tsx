/**
 * Tests for ProfileCard component
 */
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ProfileCard, ProfileCardSkeleton } from "../profile-card";

// Mock fetch for stats API
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Mock profile data
const mockProfile = {
  id: "profile-1",
  userId: "user-1",
  name: "Test User",
  type: "standard" as const,
  ageGroup: "adult" as const,
  color: "#3b82f6",
  avatar: {
    type: "initials" as const,
    value: "TU",
    backgroundColor: "#3b82f6",
  },
  pinEnabled: false,
  isActive: true,
};

const mockAdminProfile = {
  ...mockProfile,
  id: "profile-admin",
  name: "Admin User",
  type: "admin" as const,
  avatar: {
    type: "initials" as const,
    value: "AU",
    backgroundColor: "#3b82f6",
  },
};

const mockStats = {
  profileId: "profile-1",
  totalPoints: 150,
  currentStreak: 7,
  tasksToday: 3,
  tasksCompleted: 2,
  tasksTotal: 5,
  completionRate: 40,
  rank: 2,
};

describe("ProfileCard", () => {
  const mockSetActiveProfile = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockStats),
    });
  });

  describe("rendering", () => {
    it("renders profile name", async () => {
      render(
        <ProfileCard
          profile={mockProfile}
          setActiveProfile={mockSetActiveProfile}
        />
      );

      await waitFor(() => {
        expect(screen.getByText("Test User")).toBeInTheDocument();
      });
    });

    it("renders profile avatar", async () => {
      render(
        <ProfileCard
          profile={mockProfile}
          setActiveProfile={mockSetActiveProfile}
        />
      );

      await waitFor(() => {
        expect(screen.getByText("TU")).toBeInTheDocument();
      });
    });

    it("renders admin badge for admin profiles", async () => {
      render(
        <ProfileCard
          profile={mockAdminProfile}
          setActiveProfile={mockSetActiveProfile}
        />
      );

      await waitFor(() => {
        expect(screen.getByText("Admin")).toBeInTheDocument();
      });
    });

    it("does not render admin badge for standard profiles", async () => {
      render(
        <ProfileCard
          profile={mockProfile}
          setActiveProfile={mockSetActiveProfile}
        />
      );

      await waitFor(() => {
        expect(screen.queryByText("Admin")).not.toBeInTheDocument();
      });
    });
  });

  describe("stats display", () => {
    it("fetches stats from API", async () => {
      render(
        <ProfileCard
          profile={mockProfile}
          setActiveProfile={mockSetActiveProfile}
        />
      );

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith("/api/profiles/profile-1/stats");
      });
    });

    it("displays total points", async () => {
      render(
        <ProfileCard
          profile={mockProfile}
          setActiveProfile={mockSetActiveProfile}
        />
      );

      await waitFor(() => {
        expect(screen.getByText("150")).toBeInTheDocument();
        expect(screen.getByText(/points/i)).toBeInTheDocument();
      });
    });

    it("displays current streak", async () => {
      render(
        <ProfileCard
          profile={mockProfile}
          setActiveProfile={mockSetActiveProfile}
        />
      );

      await waitFor(() => {
        expect(screen.getByText("7")).toBeInTheDocument();
        expect(screen.getByText(/streak/i)).toBeInTheDocument();
      });
    });

    it("displays task progress", async () => {
      render(
        <ProfileCard
          profile={mockProfile}
          setActiveProfile={mockSetActiveProfile}
        />
      );

      await waitFor(() => {
        expect(screen.getByText("2/5")).toBeInTheDocument();
        expect(screen.getByText(/tasks/i)).toBeInTheDocument();
      });
    });

    it("displays rank", async () => {
      render(
        <ProfileCard
          profile={mockProfile}
          setActiveProfile={mockSetActiveProfile}
        />
      );

      await waitFor(() => {
        expect(screen.getByText("#2")).toBeInTheDocument();
      });
    });

    it("displays rank 1 with trophy icon", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ ...mockStats, rank: 1 }),
      });

      render(
        <ProfileCard
          profile={mockProfile}
          setActiveProfile={mockSetActiveProfile}
        />
      );

      await waitFor(() => {
        expect(screen.getByText("#1")).toBeInTheDocument();
        expect(screen.getByTestId("rank-trophy")).toBeInTheDocument();
      });
    });

    it("renders progress bar", async () => {
      render(
        <ProfileCard
          profile={mockProfile}
          setActiveProfile={mockSetActiveProfile}
        />
      );

      await waitFor(() => {
        const progressBar = screen.getByRole("progressbar");
        expect(progressBar).toBeInTheDocument();
      });
    });
  });

  describe("loading state", () => {
    it("shows skeleton while fetching stats", () => {
      // Delay the fetch response
      mockFetch.mockImplementation(
        () =>
          new Promise((resolve) =>
            setTimeout(
              () =>
                resolve({
                  ok: true,
                  json: () => Promise.resolve(mockStats),
                }),
              100
            )
          )
      );

      render(
        <ProfileCard
          profile={mockProfile}
          setActiveProfile={mockSetActiveProfile}
        />
      );

      // Should show skeleton elements during loading
      const skeletons = document.querySelectorAll('[data-slot="skeleton"]');
      expect(skeletons.length).toBeGreaterThan(0);
    });
  });

  describe("error handling", () => {
    it("handles stats fetch failure gracefully", async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 500,
      });

      render(
        <ProfileCard
          profile={mockProfile}
          setActiveProfile={mockSetActiveProfile}
        />
      );

      // Should still render the card without crashing
      await waitFor(() => {
        expect(screen.getByText("Test User")).toBeInTheDocument();
      });

      // Should show zero values on error (both points and streak show 0)
      const zeroElements = screen.getAllByText("0");
      expect(zeroElements.length).toBeGreaterThanOrEqual(2);
    });

    it("handles network errors gracefully", async () => {
      mockFetch.mockRejectedValue(new Error("Network error"));

      render(
        <ProfileCard
          profile={mockProfile}
          setActiveProfile={mockSetActiveProfile}
        />
      );

      // Should still render the card without crashing
      await waitFor(() => {
        expect(screen.getByText("Test User")).toBeInTheDocument();
      });
    });
  });

  describe("interactions", () => {
    it("calls setActiveProfile when clicked", async () => {
      const user = userEvent.setup();

      render(
        <ProfileCard
          profile={mockProfile}
          setActiveProfile={mockSetActiveProfile}
        />
      );

      await waitFor(() => {
        expect(screen.getByText("Test User")).toBeInTheDocument();
      });

      const card = screen.getByRole("button");
      await user.click(card);

      expect(mockSetActiveProfile).toHaveBeenCalledWith("profile-1");
    });

    it("calls setActiveProfile when pressing Enter", async () => {
      const user = userEvent.setup();

      render(
        <ProfileCard
          profile={mockProfile}
          setActiveProfile={mockSetActiveProfile}
        />
      );

      await waitFor(() => {
        expect(screen.getByText("Test User")).toBeInTheDocument();
      });

      const card = screen.getByRole("button");
      card.focus();
      await user.keyboard("{Enter}");

      expect(mockSetActiveProfile).toHaveBeenCalledWith("profile-1");
    });
  });

  describe("accessibility", () => {
    it("has button role", async () => {
      render(
        <ProfileCard
          profile={mockProfile}
          setActiveProfile={mockSetActiveProfile}
        />
      );

      await waitFor(() => {
        const card = screen.getByRole("button");
        expect(card).toBeInTheDocument();
      });
    });

    it("has accessible name", async () => {
      render(
        <ProfileCard
          profile={mockProfile}
          setActiveProfile={mockSetActiveProfile}
        />
      );

      await waitFor(() => {
        const card = screen.getByRole("button", {
          name: /test user/i,
        });
        expect(card).toBeInTheDocument();
      });
    });

    it("is focusable", async () => {
      render(
        <ProfileCard
          profile={mockProfile}
          setActiveProfile={mockSetActiveProfile}
        />
      );

      await waitFor(() => {
        const card = screen.getByRole("button");
        expect(card).toHaveAttribute("tabIndex", "0");
      });
    });
  });

  describe("active state", () => {
    it("shows active indicator when isActive is true", async () => {
      render(
        <ProfileCard
          profile={mockProfile}
          setActiveProfile={mockSetActiveProfile}
          isActive
        />
      );

      await waitFor(() => {
        const card = screen.getByRole("button");
        expect(card.className).toContain("ring");
      });
    });

    it("does not show active indicator when isActive is false", async () => {
      render(
        <ProfileCard
          profile={mockProfile}
          setActiveProfile={mockSetActiveProfile}
          isActive={false}
        />
      );

      await waitFor(() => {
        const card = screen.getByRole("button");
        // Check that there's no active ring class (should only have focus-visible:ring-2)
        // Split classes and check that "ring-2" is not a standalone class
        const hasActiveRing = card.className.split(" ").includes("ring-2");
        expect(hasActiveRing).toBe(false);
      });
    });
  });
});

describe("ProfileCardSkeleton", () => {
  it("renders skeleton elements", () => {
    render(<ProfileCardSkeleton />);

    const skeletons = document.querySelectorAll('[data-slot="skeleton"]');
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it("has card structure", () => {
    render(<ProfileCardSkeleton />);

    const card = document.querySelector('[data-slot="card"]');
    expect(card).toBeInTheDocument();
  });
});
