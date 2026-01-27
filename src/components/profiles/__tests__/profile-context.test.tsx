/**
 * Tests for ProfileContext and ProfileProvider
 */
import { type ReactNode } from "react";
import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ProfileProvider, useProfile } from "../profile-context";

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
];

// Wrapper component
function wrapper({ children }: { children: ReactNode }) {
  return <ProfileProvider>{children}</ProfileProvider>;
}

describe("ProfileContext", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    mockFetch.mockReset();
  });

  describe("useProfile hook", () => {
    it("throws error when used outside provider", () => {
      // Suppress console.error for this test
      const consoleSpy = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});

      expect(() => {
        renderHook(() => useProfile());
      }).toThrow("useProfile must be used within ProfileProvider");

      consoleSpy.mockRestore();
    });
  });

  describe("ProfileProvider", () => {
    it("fetches profiles on mount", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockProfiles),
      });

      renderHook(() => useProfile(), { wrapper });

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith("/api/profiles");
      });
    });

    it("sets first admin profile as active by default", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockProfiles),
      });

      const { result } = renderHook(() => useProfile(), { wrapper });

      await waitFor(() => {
        expect(result.current.activeProfile).not.toBeNull();
      });

      expect(result.current.activeProfile?.id).toBe("profile-admin-1");
    });

    it("restores last active profile from localStorage", async () => {
      localStorage.setItem("activeProfileId", "profile-standard-1");

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockProfiles),
      });

      const { result } = renderHook(() => useProfile(), { wrapper });

      await waitFor(() => {
        expect(result.current.activeProfile?.id).toBe("profile-standard-1");
      });
    });

    it("provides all profiles", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockProfiles),
      });

      const { result } = renderHook(() => useProfile(), { wrapper });

      await waitFor(() => {
        expect(result.current.allProfiles).toHaveLength(2);
      });
    });

    it("defaults to profile view mode", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockProfiles),
      });

      const { result } = renderHook(() => useProfile(), { wrapper });

      expect(result.current.viewMode).toBe("profile");
    });
  });

  describe("setActiveProfile", () => {
    it("switches to specified profile", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockProfiles),
      });

      const { result } = renderHook(() => useProfile(), { wrapper });

      await waitFor(() => {
        expect(result.current.activeProfile).not.toBeNull();
      });

      await act(async () => {
        await result.current.setActiveProfile("profile-standard-1");
      });

      expect(result.current.activeProfile?.id).toBe("profile-standard-1");
    });

    it("persists active profile to localStorage", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockProfiles),
      });

      const { result } = renderHook(() => useProfile(), { wrapper });

      await waitFor(() => {
        expect(result.current.activeProfile).not.toBeNull();
      });

      await act(async () => {
        await result.current.setActiveProfile("profile-standard-1");
      });

      expect(localStorage.getItem("activeProfileId")).toBe(
        "profile-standard-1"
      );
    });
  });

  describe("setViewMode", () => {
    it("switches to family view", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockProfiles),
      });

      const { result } = renderHook(() => useProfile(), { wrapper });

      act(() => {
        result.current.setViewMode("family");
      });

      expect(result.current.viewMode).toBe("family");
    });

    it("switches back to profile view", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockProfiles),
      });

      const { result } = renderHook(() => useProfile(), { wrapper });

      act(() => {
        result.current.setViewMode("family");
      });

      act(() => {
        result.current.setViewMode("profile");
      });

      expect(result.current.viewMode).toBe("profile");
    });
  });

  describe("isAdmin", () => {
    it("returns true when active profile is admin", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockProfiles),
      });

      const { result } = renderHook(() => useProfile(), { wrapper });

      await waitFor(() => {
        expect(result.current.activeProfile?.type).toBe("admin");
      });

      expect(result.current.isAdmin).toBe(true);
    });

    it("returns false when active profile is standard", async () => {
      localStorage.setItem("activeProfileId", "profile-standard-1");

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockProfiles),
      });

      const { result } = renderHook(() => useProfile(), { wrapper });

      await waitFor(() => {
        expect(result.current.activeProfile?.type).toBe("standard");
      });

      expect(result.current.isAdmin).toBe(false);
    });
  });

  describe("refreshProfiles", () => {
    it("refetches profiles from API", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockProfiles),
      });

      const { result } = renderHook(() => useProfile(), { wrapper });

      await waitFor(() => {
        expect(result.current.allProfiles).toHaveLength(2);
      });

      // Add a new profile to the response
      const updatedProfiles = [
        ...mockProfiles,
        {
          id: "profile-new",
          name: "New Profile",
          type: "standard",
        },
      ];

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(updatedProfiles),
      });

      await act(async () => {
        await result.current.refreshProfiles();
      });

      expect(result.current.allProfiles).toHaveLength(3);
    });
  });

  describe("error handling", () => {
    it("handles fetch failure gracefully", async () => {
      mockFetch.mockRejectedValueOnce(new Error("Network error"));

      const { result } = renderHook(() => useProfile(), { wrapper });

      await waitFor(() => {
        // Should not throw, should have empty profiles
        expect(result.current.allProfiles).toHaveLength(0);
      });
    });

    it("handles non-ok response gracefully", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
      });

      const { result } = renderHook(() => useProfile(), { wrapper });

      await waitFor(() => {
        expect(result.current.allProfiles).toHaveLength(0);
      });
    });
  });
});
