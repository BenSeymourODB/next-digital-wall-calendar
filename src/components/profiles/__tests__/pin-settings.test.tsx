/**
 * Tests for PinSettings component
 */
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PinSettings } from "../pin-settings";

// Mock fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Mock profiles
const standardProfileWithoutPin = {
  id: "profile-standard-1",
  name: "Child User",
  type: "standard" as const,
  pinEnabled: false,
  color: "#22c55e",
  avatar: { type: "emoji" as const, value: "👦" },
};

const standardProfileWithPin = {
  id: "profile-standard-2",
  name: "Teen User",
  type: "standard" as const,
  pinEnabled: true,
  color: "#a855f7",
  avatar: {
    type: "initials" as const,
    value: "TU",
    backgroundColor: "#a855f7",
  },
};

const adminProfile = {
  id: "profile-admin-1",
  name: "Admin User",
  type: "admin" as const,
  pinEnabled: true,
  color: "#3b82f6",
  avatar: {
    type: "initials" as const,
    value: "AU",
    backgroundColor: "#3b82f6",
  },
};

describe("PinSettings", () => {
  const mockOnPinChange = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockReset();
  });

  describe("standard profile without PIN", () => {
    it("shows 'Set up PIN' button when no PIN", () => {
      render(
        <PinSettings
          profile={standardProfileWithoutPin}
          onPinChange={mockOnPinChange}
        />
      );

      expect(
        screen.getByRole("button", { name: /set up pin/i })
      ).toBeInTheDocument();
    });

    it("does not show 'Change PIN' button when no PIN", () => {
      render(
        <PinSettings
          profile={standardProfileWithoutPin}
          onPinChange={mockOnPinChange}
        />
      );

      expect(
        screen.queryByRole("button", { name: /change pin/i })
      ).not.toBeInTheDocument();
    });

    it("does not show 'Remove PIN' button when no PIN", () => {
      render(
        <PinSettings
          profile={standardProfileWithoutPin}
          onPinChange={mockOnPinChange}
        />
      );

      expect(
        screen.queryByRole("button", { name: /remove pin/i })
      ).not.toBeInTheDocument();
    });
  });

  describe("standard profile with PIN", () => {
    it("shows 'Change PIN' button when has PIN", () => {
      render(
        <PinSettings
          profile={standardProfileWithPin}
          onPinChange={mockOnPinChange}
        />
      );

      expect(
        screen.getByRole("button", { name: /change pin/i })
      ).toBeInTheDocument();
    });

    it("shows 'Remove PIN' button when has PIN", () => {
      render(
        <PinSettings
          profile={standardProfileWithPin}
          onPinChange={mockOnPinChange}
        />
      );

      expect(
        screen.getByRole("button", { name: /remove pin/i })
      ).toBeInTheDocument();
    });

    it("does not show 'Set up PIN' button when has PIN", () => {
      render(
        <PinSettings
          profile={standardProfileWithPin}
          onPinChange={mockOnPinChange}
        />
      );

      expect(
        screen.queryByRole("button", { name: /set up pin/i })
      ).not.toBeInTheDocument();
    });
  });

  describe("admin profile with PIN", () => {
    it("shows 'Change PIN' button for admin", () => {
      render(
        <PinSettings profile={adminProfile} onPinChange={mockOnPinChange} />
      );

      expect(
        screen.getByRole("button", { name: /change pin/i })
      ).toBeInTheDocument();
    });

    it("does not show 'Remove PIN' button for admin", () => {
      render(
        <PinSettings profile={adminProfile} onPinChange={mockOnPinChange} />
      );

      expect(
        screen.queryByRole("button", { name: /remove pin/i })
      ).not.toBeInTheDocument();
    });

    it("shows explanation why admin cannot remove PIN", () => {
      render(
        <PinSettings profile={adminProfile} onPinChange={mockOnPinChange} />
      );

      expect(
        screen.getByText(/admin profiles require a pin/i)
      ).toBeInTheDocument();
    });
  });

  describe("admin viewing child profile", () => {
    it("shows 'Reset PIN' button for admin viewing child", () => {
      render(
        <PinSettings
          profile={standardProfileWithPin}
          viewingAsAdmin={adminProfile}
          onPinChange={mockOnPinChange}
        />
      );

      expect(
        screen.getByRole("button", { name: /reset pin/i })
      ).toBeInTheDocument();
    });

    it("does not show 'Reset PIN' when not viewing as admin", () => {
      render(
        <PinSettings
          profile={standardProfileWithPin}
          onPinChange={mockOnPinChange}
        />
      );

      expect(
        screen.queryByRole("button", { name: /reset pin/i })
      ).not.toBeInTheDocument();
    });
  });

  describe("modal interactions", () => {
    it("opens PinSetupModal on 'Set up PIN' click", async () => {
      render(
        <PinSettings
          profile={standardProfileWithoutPin}
          onPinChange={mockOnPinChange}
        />
      );

      fireEvent.click(screen.getByRole("button", { name: /set up pin/i }));

      await waitFor(() => {
        expect(screen.getByText(/create a pin/i)).toBeInTheDocument();
      });
    });

    it("opens PinSetupModal on 'Change PIN' click", async () => {
      render(
        <PinSettings
          profile={standardProfileWithPin}
          onPinChange={mockOnPinChange}
        />
      );

      fireEvent.click(screen.getByRole("button", { name: /change pin/i }));

      await waitFor(() => {
        // Check for the dialog's heading (h2 in DialogTitle)
        expect(
          screen.getByRole("heading", { name: /change pin/i })
        ).toBeInTheDocument();
      });
    });

    it("shows confirmation dialog on 'Remove PIN' click", async () => {
      render(
        <PinSettings
          profile={standardProfileWithPin}
          onPinChange={mockOnPinChange}
        />
      );

      fireEvent.click(screen.getByRole("button", { name: /remove pin/i }));

      await waitFor(() => {
        expect(screen.getByText(/are you sure/i)).toBeInTheDocument();
      });
    });

    it("opens admin PIN verification on 'Reset PIN' click", async () => {
      render(
        <PinSettings
          profile={standardProfileWithPin}
          viewingAsAdmin={adminProfile}
          onPinChange={mockOnPinChange}
        />
      );

      fireEvent.click(screen.getByRole("button", { name: /reset pin/i }));

      await waitFor(() => {
        // Check for the dialog's heading (h2 in DialogTitle)
        expect(
          screen.getByRole("heading", { name: /enter your admin pin/i })
        ).toBeInTheDocument();
      });
    });
  });

  describe("PIN status display", () => {
    it("shows PIN enabled status when PIN is set", () => {
      render(
        <PinSettings
          profile={standardProfileWithPin}
          onPinChange={mockOnPinChange}
        />
      );

      expect(screen.getByText(/pin enabled/i)).toBeInTheDocument();
    });

    it("shows PIN not set status when no PIN", () => {
      render(
        <PinSettings
          profile={standardProfileWithoutPin}
          onPinChange={mockOnPinChange}
        />
      );

      expect(screen.getByText(/pin not set/i)).toBeInTheDocument();
    });
  });
});
