/**
 * Tests for /profiles/[id]/settings page
 */
import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
// Import after mocks
import ProfileSettingsPage from "../page";

// Mock fetch for API calls
const mockFetch = vi.fn();
global.fetch = mockFetch;

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
  pinEnabled: true,
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

// Mock useProfile hook
const mockUseProfile = vi.fn();
vi.mock("@/components/profiles/profile-context", () => ({
  useProfile: () => mockUseProfile(),
  ProfileProvider: ({ children }: { children: React.ReactNode }) => (
    <>{children}</>
  ),
}));

// Mock next/navigation
const mockPush = vi.fn();
const mockBack = vi.fn();
let mockParamsId = "profile-admin";
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: mockPush,
    back: mockBack,
  }),
  useParams: () => ({ id: mockParamsId }),
}));

describe("ProfileSettingsPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockAdminProfile),
    });
  });

  describe("rendering", () => {
    it("renders profile settings heading", async () => {
      mockUseProfile.mockReturnValue({
        activeProfile: mockAdminProfile,
        allProfiles: mockProfiles,
        isAdmin: true,
        isLoading: false,
        refreshProfiles: vi.fn(),
      });

      render(<ProfileSettingsPage />);

      await waitFor(() => {
        expect(
          screen.getByRole("heading", { name: /profile settings/i })
        ).toBeInTheDocument();
      });
    });

    it("renders profile avatar and name", async () => {
      mockUseProfile.mockReturnValue({
        activeProfile: mockAdminProfile,
        allProfiles: mockProfiles,
        isAdmin: true,
        isLoading: false,
        refreshProfiles: vi.fn(),
      });

      render(<ProfileSettingsPage />);

      await waitFor(() => {
        expect(screen.getByText("Admin User")).toBeInTheDocument();
        expect(screen.getByText("AU")).toBeInTheDocument(); // Avatar initials
      });
    });

    it("renders PIN settings section", async () => {
      mockUseProfile.mockReturnValue({
        activeProfile: mockAdminProfile,
        allProfiles: mockProfiles,
        isAdmin: true,
        isLoading: false,
        refreshProfiles: vi.fn(),
      });

      render(<ProfileSettingsPage />);

      await waitFor(() => {
        expect(screen.getByText(/pin security/i)).toBeInTheDocument();
      });
    });

    it("renders back navigation", async () => {
      mockUseProfile.mockReturnValue({
        activeProfile: mockAdminProfile,
        allProfiles: mockProfiles,
        isAdmin: true,
        isLoading: false,
        refreshProfiles: vi.fn(),
      });

      render(<ProfileSettingsPage />);

      expect(screen.getByRole("button", { name: /back/i })).toBeInTheDocument();
    });
  });

  describe("profile display", () => {
    it("shows admin badge for admin profiles", async () => {
      mockUseProfile.mockReturnValue({
        activeProfile: mockAdminProfile,
        allProfiles: mockProfiles,
        isAdmin: true,
        isLoading: false,
        refreshProfiles: vi.fn(),
      });

      render(<ProfileSettingsPage />);

      await waitFor(() => {
        expect(screen.getByText("Admin")).toBeInTheDocument();
      });
    });

    it("does not show admin badge for standard profiles", async () => {
      // Set params to standard profile
      mockParamsId = "profile-standard";

      mockUseProfile.mockReturnValue({
        activeProfile: mockStandardProfile,
        allProfiles: mockProfiles,
        isAdmin: false,
        isLoading: false,
        refreshProfiles: vi.fn(),
      });

      render(<ProfileSettingsPage />);

      await waitFor(() => {
        expect(screen.getByText("Child User")).toBeInTheDocument();
      });

      // Admin badge should not be present
      expect(screen.queryByText("Admin")).not.toBeInTheDocument();

      // Reset params
      mockParamsId = "profile-admin";
    });
  });

  describe("loading state", () => {
    it("shows loading skeleton when profile not found", () => {
      mockUseProfile.mockReturnValue({
        activeProfile: null,
        allProfiles: [],
        isAdmin: false,
        isLoading: true,
        refreshProfiles: vi.fn(),
      });

      render(<ProfileSettingsPage />);

      const skeletons = document.querySelectorAll('[data-slot="skeleton"]');
      expect(skeletons.length).toBeGreaterThan(0);
    });
  });

  describe("profile not found", () => {
    it("redirects when profile not found after loading", async () => {
      // Set params to a non-existent profile
      mockParamsId = "nonexistent-profile";

      mockUseProfile.mockReturnValue({
        activeProfile: mockAdminProfile,
        allProfiles: mockProfiles, // Profile list exists but requested ID isn't in it
        isAdmin: true,
        isLoading: false,
        refreshProfiles: vi.fn(),
      });

      render(<ProfileSettingsPage />);

      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith("/profiles");
      });

      // Reset params
      mockParamsId = "profile-admin";
    });
  });

  describe("PIN management", () => {
    it("shows PIN enabled status when profile has PIN", async () => {
      mockUseProfile.mockReturnValue({
        activeProfile: mockAdminProfile,
        allProfiles: mockProfiles,
        isAdmin: true,
        isLoading: false,
        refreshProfiles: vi.fn(),
      });

      render(<ProfileSettingsPage />);

      await waitFor(() => {
        expect(screen.getByText(/pin enabled/i)).toBeInTheDocument();
      });
    });

    it("shows PIN not set status when profile has no PIN", async () => {
      // Set params to standard profile
      mockParamsId = "profile-standard";

      mockUseProfile.mockReturnValue({
        activeProfile: mockStandardProfile,
        allProfiles: mockProfiles,
        isAdmin: false,
        isLoading: false,
        refreshProfiles: vi.fn(),
      });

      render(<ProfileSettingsPage />);

      await waitFor(() => {
        expect(screen.getByText(/pin not set/i)).toBeInTheDocument();
      });

      // Reset params
      mockParamsId = "profile-admin";
    });
  });

  describe("accessibility", () => {
    it("has proper heading hierarchy", async () => {
      mockUseProfile.mockReturnValue({
        activeProfile: mockAdminProfile,
        allProfiles: mockProfiles,
        isAdmin: true,
        isLoading: false,
        refreshProfiles: vi.fn(),
      });

      render(<ProfileSettingsPage />);

      await waitFor(() => {
        const h1 = screen.getByRole("heading", { level: 1 });
        expect(h1).toBeInTheDocument();
      });
    });
  });
});
