/**
 * Tests for ProfileGrid component
 */
import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ProfileGrid, ProfileGridSkeleton } from "../profile-grid";

// Mock fetch for stats API
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Mock profile data
const mockProfiles = [
  {
    id: "profile-1",
    userId: "user-1",
    name: "Admin User",
    type: "admin" as const,
    ageGroup: "adult" as const,
    color: "#3b82f6",
    avatar: {
      type: "initials" as const,
      value: "AU",
      backgroundColor: "#3b82f6",
    },
    pinEnabled: false,
    isActive: true,
  },
  {
    id: "profile-2",
    userId: "user-1",
    name: "Child User",
    type: "standard" as const,
    ageGroup: "child" as const,
    color: "#22c55e",
    avatar: {
      type: "emoji" as const,
      value: "👦",
    },
    pinEnabled: false,
    isActive: true,
  },
  {
    id: "profile-3",
    userId: "user-1",
    name: "Teen User",
    type: "standard" as const,
    ageGroup: "teen" as const,
    color: "#a855f7",
    avatar: {
      type: "initials" as const,
      value: "TU",
      backgroundColor: "#a855f7",
    },
    pinEnabled: false,
    isActive: true,
  },
];

const mockStats = {
  profileId: "profile-1",
  totalPoints: 100,
  currentStreak: 5,
  tasksToday: 0,
  tasksCompleted: 0,
  tasksTotal: 0,
  completionRate: 0,
  rank: 1,
};

describe("ProfileGrid", () => {
  const mockSetActiveProfile = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockStats),
    });
  });

  describe("rendering", () => {
    it("renders ProfileCard for each profile", async () => {
      render(
        <ProfileGrid
          profiles={mockProfiles}
          activeProfileId="profile-1"
          setActiveProfile={mockSetActiveProfile}
        />
      );

      await waitFor(() => {
        expect(screen.getByText("Admin User")).toBeInTheDocument();
        expect(screen.getByText("Child User")).toBeInTheDocument();
        expect(screen.getByText("Teen User")).toBeInTheDocument();
      });
    });

    it("renders correct number of profile cards", async () => {
      render(
        <ProfileGrid
          profiles={mockProfiles}
          activeProfileId="profile-1"
          setActiveProfile={mockSetActiveProfile}
        />
      );

      await waitFor(() => {
        const cards = screen.getAllByRole("button");
        expect(cards).toHaveLength(3);
      });
    });

    it("marks active profile card", async () => {
      render(
        <ProfileGrid
          profiles={mockProfiles}
          activeProfileId="profile-2"
          setActiveProfile={mockSetActiveProfile}
        />
      );

      await waitFor(() => {
        // Find the Child User card and verify it has active styling
        const cards = screen.getAllByRole("button");
        const childCard = cards.find((card) =>
          card.textContent?.includes("Child User")
        );
        expect(childCard?.className).toContain("ring");
      });
    });
  });

  describe("empty state", () => {
    it("handles empty profiles array", () => {
      render(
        <ProfileGrid
          profiles={[]}
          activeProfileId={null}
          setActiveProfile={mockSetActiveProfile}
        />
      );

      // Should render empty grid without crashing
      const grid = document.querySelector('[data-testid="profile-grid"]');
      expect(grid).toBeInTheDocument();
      expect(screen.queryByRole("button")).not.toBeInTheDocument();
    });

    it("shows empty message when no profiles", () => {
      render(
        <ProfileGrid
          profiles={[]}
          activeProfileId={null}
          setActiveProfile={mockSetActiveProfile}
        />
      );

      expect(screen.getByText(/no profiles/i)).toBeInTheDocument();
    });
  });

  describe("layout", () => {
    it("uses responsive grid layout", async () => {
      render(
        <ProfileGrid
          profiles={mockProfiles}
          activeProfileId="profile-1"
          setActiveProfile={mockSetActiveProfile}
        />
      );

      const grid = document.querySelector('[data-testid="profile-grid"]');
      expect(grid).toBeInTheDocument();
      expect(grid?.className).toContain("grid");
      expect(grid?.className).toContain("grid-cols-2");
      expect(grid?.className).toContain("md:grid-cols-3");
      expect(grid?.className).toContain("lg:grid-cols-5");
      expect(grid?.className).toContain("gap-4");
    });
  });

  describe("interactions", () => {
    it("passes setActiveProfile to ProfileCards", async () => {
      const mockSetActive = vi.fn();

      render(
        <ProfileGrid
          profiles={mockProfiles}
          activeProfileId="profile-1"
          setActiveProfile={mockSetActive}
        />
      );

      await waitFor(() => {
        expect(screen.getByText("Admin User")).toBeInTheDocument();
      });

      // Click on a profile card
      const cards = screen.getAllByRole("button");
      await cards[1].click();

      expect(mockSetActive).toHaveBeenCalledWith("profile-2");
    });
  });
});

describe("ProfileGridSkeleton", () => {
  it("renders skeleton cards", () => {
    render(<ProfileGridSkeleton count={3} />);

    const skeletons = document.querySelectorAll('[data-slot="skeleton"]');
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it("renders specified number of skeleton cards", () => {
    render(<ProfileGridSkeleton count={4} />);

    const cards = document.querySelectorAll('[data-slot="card"]');
    expect(cards).toHaveLength(4);
  });

  it("uses same grid layout as ProfileGrid", () => {
    render(<ProfileGridSkeleton count={3} />);

    const grid = document.querySelector(
      '[data-testid="profile-grid-skeleton"]'
    );
    expect(grid).toBeInTheDocument();
    expect(grid?.className).toContain("grid");
    expect(grid?.className).toContain("grid-cols-2");
    expect(grid?.className).toContain("md:grid-cols-3");
    expect(grid?.className).toContain("lg:grid-cols-5");
  });
});
