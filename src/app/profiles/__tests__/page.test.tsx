/**
 * Tests for /profiles page
 */
import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import ProfilesPage from "../page";

// Mock fetch for API calls
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Mock useProfile hook
const mockUseProfile = vi.fn();
vi.mock("@/components/profiles/profile-context", () => ({
  useProfile: () => mockUseProfile(),
  ProfileProvider: ({ children }: { children: React.ReactNode }) => (
    <>{children}</>
  ),
}));

// Mock next/navigation
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    back: vi.fn(),
  }),
}));

// Mock profile data
const mockAdminProfile = {
  id: "profile-admin",
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
};

const mockStandardProfile = {
  id: "profile-standard",
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
};

const mockProfiles = [mockAdminProfile, mockStandardProfile];

const mockStats = {
  profileId: "profile-admin",
  totalPoints: 100,
  currentStreak: 5,
  tasksToday: 0,
  tasksCompleted: 0,
  tasksTotal: 0,
  completionRate: 0,
  rank: 1,
};

describe("ProfilesPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockStats),
    });
  });

  describe("rendering", () => {
    it('renders "Manage Profiles" heading', async () => {
      mockUseProfile.mockReturnValue({
        activeProfile: mockAdminProfile,
        allProfiles: mockProfiles,
        isAdmin: true,
        isLoading: false,
        setActiveProfile: vi.fn(),
      });

      render(<ProfilesPage />);

      expect(
        screen.getByRole("heading", { name: /manage profiles/i })
      ).toBeInTheDocument();
    });

    it("renders ProfileGrid", async () => {
      mockUseProfile.mockReturnValue({
        activeProfile: mockAdminProfile,
        allProfiles: mockProfiles,
        isAdmin: true,
        isLoading: false,
        setActiveProfile: vi.fn(),
      });

      render(<ProfilesPage />);

      await waitFor(() => {
        expect(screen.getByText("Admin User")).toBeInTheDocument();
        expect(screen.getByText("Child User")).toBeInTheDocument();
      });
    });
  });

  describe("admin features", () => {
    it('shows "Add New" button for admin users', async () => {
      mockUseProfile.mockReturnValue({
        activeProfile: mockAdminProfile,
        allProfiles: mockProfiles,
        isAdmin: true,
        isLoading: false,
        setActiveProfile: vi.fn(),
      });

      render(<ProfilesPage />);

      await waitFor(() => {
        expect(
          screen.getByRole("button", { name: /add.*profile/i })
        ).toBeInTheDocument();
      });
    });

    it('hides "Add New" button for standard users', async () => {
      mockUseProfile.mockReturnValue({
        activeProfile: mockStandardProfile,
        allProfiles: mockProfiles,
        isAdmin: false,
        isLoading: false,
        setActiveProfile: vi.fn(),
      });

      render(<ProfilesPage />);

      await waitFor(() => {
        expect(
          screen.queryByRole("button", { name: /add.*profile/i })
        ).not.toBeInTheDocument();
      });
    });
  });

  describe("navigation", () => {
    it("has back navigation", async () => {
      mockUseProfile.mockReturnValue({
        activeProfile: mockAdminProfile,
        allProfiles: mockProfiles,
        isAdmin: true,
        isLoading: false,
        setActiveProfile: vi.fn(),
      });

      render(<ProfilesPage />);

      expect(screen.getByRole("button", { name: /back/i })).toBeInTheDocument();
    });
  });

  describe("loading state", () => {
    it("shows loading skeleton when isLoading is true", () => {
      mockUseProfile.mockReturnValue({
        activeProfile: null,
        allProfiles: [],
        isAdmin: false,
        isLoading: true,
        setActiveProfile: vi.fn(),
      });

      render(<ProfilesPage />);

      const skeletons = document.querySelectorAll('[data-slot="skeleton"]');
      expect(skeletons.length).toBeGreaterThan(0);
    });
  });
});
