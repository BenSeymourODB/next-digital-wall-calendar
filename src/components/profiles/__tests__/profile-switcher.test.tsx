/**
 * Tests for ProfileSwitcher component
 */
import { type ReactNode } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ProfileProvider } from "../profile-context";
import { ProfileSwitcher } from "../profile-switcher";

// Mock fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Mock localStorage
const mockLocalStorage: Record<string, string> = {};
vi.stubGlobal("localStorage", {
  getItem: (key: string) => mockLocalStorage[key] || null,
  setItem: (key: string, value: string) => {
    mockLocalStorage[key] = value;
  },
  removeItem: (key: string) => {
    delete mockLocalStorage[key];
  },
  clear: () => {
    Object.keys(mockLocalStorage).forEach(
      (key) => delete mockLocalStorage[key]
    );
  },
});

// Mock profiles data
const mockProfiles = [
  {
    id: "profile-admin-1",
    userId: "user-1",
    name: "Admin User",
    type: "admin",
    ageGroup: "adult",
    color: "#3b82f6",
    avatar: { type: "initials", value: "AU" },
    pinEnabled: true,
    isActive: true,
  },
  {
    id: "profile-standard-1",
    userId: "user-1",
    name: "Child User",
    type: "standard",
    ageGroup: "child",
    color: "#22c55e",
    avatar: { type: "emoji", value: "👦" },
    pinEnabled: false,
    isActive: true,
  },
  {
    id: "profile-teen-1",
    userId: "user-1",
    name: "Teen User",
    type: "standard",
    ageGroup: "teen",
    color: "#a855f7",
    avatar: { type: "initials", value: "TU" },
    pinEnabled: true,
    isActive: true,
  },
];

function renderWithProvider(component: ReactNode) {
  return render(<ProfileProvider>{component}</ProfileProvider>);
}

describe("ProfileSwitcher", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    mockFetch.mockReset();
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockProfiles),
    });
  });

  describe("rendering", () => {
    it("shows current profile name", async () => {
      renderWithProvider(<ProfileSwitcher />);

      // Wait for profiles to load
      const profileButton = await screen.findByRole("button", {
        name: /admin user/i,
      });
      expect(profileButton).toBeInTheDocument();
    });

    it("shows current profile avatar", async () => {
      renderWithProvider(<ProfileSwitcher />);

      // Wait for profiles to load and check for avatar initials
      await screen.findByText("AU");
    });

    it("renders nothing when no active profile", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve([]),
      });

      const { container } = renderWithProvider(<ProfileSwitcher />);

      // Wait a bit for fetch to complete
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Should render nothing
      expect(container.firstChild).toBeNull();
    });
  });

  describe("dropdown behavior", () => {
    it("opens dropdown on click", async () => {
      renderWithProvider(<ProfileSwitcher />);

      const button = await screen.findByRole("button", { name: /admin user/i });
      fireEvent.click(button);

      // Dropdown should show all profile names
      expect(screen.getByText("Child User")).toBeInTheDocument();
      expect(screen.getByText("Teen User")).toBeInTheDocument();
    });

    it("closes dropdown on outside click", async () => {
      renderWithProvider(<ProfileSwitcher />);

      const button = await screen.findByRole("button", { name: /admin user/i });
      fireEvent.click(button);

      // Verify dropdown is open
      expect(screen.getByText("Child User")).toBeInTheDocument();

      // Click outside
      fireEvent.click(document.body);

      // Dropdown should close - items should not be visible
      await new Promise((resolve) => setTimeout(resolve, 100));
      expect(screen.queryByText("Child User")).not.toBeInTheDocument();
    });

    it("shows admin badge for admin profiles", async () => {
      renderWithProvider(<ProfileSwitcher />);

      const button = await screen.findByRole("button", { name: /admin user/i });
      fireEvent.click(button);

      // Admin profile should have crown emoji
      const adminOption = screen.getByText("Admin User").closest("button");
      expect(adminOption?.textContent).toContain("👑");
    });

    it("shows lock icon for PIN-protected profiles", async () => {
      renderWithProvider(<ProfileSwitcher />);

      const button = await screen.findByRole("button", { name: /admin user/i });
      fireEvent.click(button);

      // PIN-protected profiles should show lock
      const adminOption = screen.getByText("Admin User").closest("button");
      const teenOption = screen.getByText("Teen User").closest("button");

      expect(adminOption?.textContent).toContain("🔒");
      expect(teenOption?.textContent).toContain("🔒");
    });

    it("does not show lock icon for profiles without PIN", async () => {
      renderWithProvider(<ProfileSwitcher />);

      const button = await screen.findByRole("button", { name: /admin user/i });
      fireEvent.click(button);

      // Child User has no PIN
      const childOption = screen.getByText("Child User").closest("button");
      expect(childOption?.textContent).not.toContain("🔒");
    });
  });

  describe("profile switching", () => {
    it("switches profile when clicked", async () => {
      renderWithProvider(<ProfileSwitcher />);

      const button = await screen.findByRole("button", { name: /admin user/i });
      fireEvent.click(button);

      // Click on Child User
      const childOption = screen.getByText("Child User");
      fireEvent.click(childOption);

      // Button should now show Child User
      await screen.findByRole("button", { name: /child user/i });
    });

    it("closes dropdown after switching", async () => {
      renderWithProvider(<ProfileSwitcher />);

      const button = await screen.findByRole("button", { name: /admin user/i });
      fireEvent.click(button);

      // Click on Child User
      const childOption = screen.getByText("Child User");
      fireEvent.click(childOption);

      // Dropdown should be closed
      await new Promise((resolve) => setTimeout(resolve, 100));
      expect(screen.queryByText("Teen User")).not.toBeInTheDocument();
    });

    it("highlights current profile in dropdown", async () => {
      renderWithProvider(<ProfileSwitcher />);

      const button = await screen.findByRole("button", { name: /admin user/i });
      fireEvent.click(button);

      // Current profile option should have highlight class
      const adminOption = screen.getByText("Admin User").closest("button");
      expect(adminOption?.className).toContain("bg-blue-50");
    });
  });

  describe("family view", () => {
    it("shows family view option in dropdown", async () => {
      renderWithProvider(<ProfileSwitcher />);

      const button = await screen.findByRole("button", { name: /admin user/i });
      fireEvent.click(button);

      expect(screen.getByText("Family View")).toBeInTheDocument();
    });

    it("shows family view icon", async () => {
      renderWithProvider(<ProfileSwitcher />);

      const button = await screen.findByRole("button", { name: /admin user/i });
      fireEvent.click(button);

      const familyOption = screen.getByText("Family View").closest("button");
      expect(familyOption?.textContent).toContain("👨‍👩‍👧‍👦");
    });
  });

  describe("manage profiles link", () => {
    it("shows manage profiles option", async () => {
      renderWithProvider(<ProfileSwitcher />);

      const button = await screen.findByRole("button", { name: /admin user/i });
      fireEvent.click(button);

      expect(screen.getByText("Manage Profiles")).toBeInTheDocument();
    });

    it("manage profiles links to /profiles page", async () => {
      renderWithProvider(<ProfileSwitcher />);

      const button = await screen.findByRole("button", { name: /admin user/i });
      fireEvent.click(button);

      const manageLink = screen.getByText("Manage Profiles").closest("a");
      expect(manageLink).toHaveAttribute("href", "/profiles");
    });
  });

  describe("PIN integration", () => {
    it("switches without modal to profiles without PIN", async () => {
      renderWithProvider(<ProfileSwitcher />);

      const button = await screen.findByRole("button", { name: /admin user/i });
      fireEvent.click(button);

      // Click on Child User (no PIN)
      const childOption = screen.getByText("Child User");
      fireEvent.click(childOption);

      // Should switch immediately without showing PIN modal
      await screen.findByRole("button", { name: /child user/i });

      // PIN modal should not be visible
      expect(screen.queryByText(/enter your pin/i)).not.toBeInTheDocument();
    });

    it("shows PinEntryModal for PIN-protected profiles", async () => {
      renderWithProvider(<ProfileSwitcher />);

      const button = await screen.findByRole("button", { name: /admin user/i });
      fireEvent.click(button);

      // Click on Teen User (has PIN)
      const teenOption = screen.getByText("Teen User");
      fireEvent.click(teenOption);

      // PIN modal should appear
      await waitFor(() => {
        expect(screen.getByText(/enter your pin/i)).toBeInTheDocument();
      });
    });

    it("switches after successful PIN entry", async () => {
      // Mock verify-pin to succeed
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockProfiles),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ success: true }),
        });

      renderWithProvider(<ProfileSwitcher />);

      const button = await screen.findByRole("button", { name: /admin user/i });
      fireEvent.click(button);

      // Click on Teen User (has PIN)
      const teenOption = screen.getByText("Teen User");
      fireEvent.click(teenOption);

      // Wait for PIN modal
      await waitFor(() => {
        expect(screen.getByText(/enter your pin/i)).toBeInTheDocument();
      });

      // Enter PIN
      fireEvent.click(screen.getByRole("button", { name: "1" }));
      fireEvent.click(screen.getByRole("button", { name: "2" }));
      fireEvent.click(screen.getByRole("button", { name: "3" }));
      fireEvent.click(screen.getByRole("button", { name: "4" }));
      fireEvent.click(screen.getByRole("button", { name: /submit/i }));

      // Should switch to Teen User
      await screen.findByRole("button", { name: /teen user/i });
    });

    it("stays on current profile after modal cancel", async () => {
      renderWithProvider(<ProfileSwitcher />);

      const button = await screen.findByRole("button", { name: /admin user/i });
      fireEvent.click(button);

      // Click on Teen User (has PIN)
      const teenOption = screen.getByText("Teen User");
      fireEvent.click(teenOption);

      // Wait for PIN modal
      await waitFor(() => {
        expect(screen.getByText(/enter your pin/i)).toBeInTheDocument();
      });

      // Click Cancel
      fireEvent.click(screen.getByRole("button", { name: /cancel/i }));

      // Should still show Admin User (original profile)
      await screen.findByRole("button", { name: /admin user/i });
    });
  });
});
