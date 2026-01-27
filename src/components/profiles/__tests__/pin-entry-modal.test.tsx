/**
 * Tests for PinEntryModal component
 */
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PinEntryModal } from "../pin-entry-modal";

// Mock fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Sample profile for testing
const mockProfile = {
  id: "profile-1",
  name: "Test User",
  avatar: {
    type: "initials" as const,
    value: "TU",
    backgroundColor: "#3b82f6",
  },
  color: "#3b82f6",
};

describe("PinEntryModal", () => {
  const mockOnSuccess = vi.fn();
  const mockOnClose = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockReset();
  });

  describe("rendering", () => {
    it("renders profile avatar", () => {
      render(
        <PinEntryModal
          open
          profile={mockProfile}
          onSuccess={mockOnSuccess}
          onClose={mockOnClose}
        />
      );

      expect(screen.getByText("TU")).toBeInTheDocument();
    });

    it("renders profile name", () => {
      render(
        <PinEntryModal
          open
          profile={mockProfile}
          onSuccess={mockOnSuccess}
          onClose={mockOnClose}
        />
      );

      expect(screen.getByText("Test User")).toBeInTheDocument();
    });

    it("renders PIN display", () => {
      render(
        <PinEntryModal
          open
          profile={mockProfile}
          onSuccess={mockOnSuccess}
          onClose={mockOnClose}
        />
      );

      expect(screen.getByRole("status")).toBeInTheDocument();
    });

    it("renders numeric keypad", () => {
      render(
        <PinEntryModal
          open
          profile={mockProfile}
          onSuccess={mockOnSuccess}
          onClose={mockOnClose}
        />
      );

      // Check for keypad buttons
      for (let i = 0; i <= 9; i++) {
        expect(
          screen.getByRole("button", { name: String(i) })
        ).toBeInTheDocument();
      }
    });

    it("renders cancel button", () => {
      render(
        <PinEntryModal
          open
          profile={mockProfile}
          onSuccess={mockOnSuccess}
          onClose={mockOnClose}
        />
      );

      expect(
        screen.getByRole("button", { name: /cancel/i })
      ).toBeInTheDocument();
    });

    it("does not render when open is false", () => {
      render(
        <PinEntryModal
          open={false}
          profile={mockProfile}
          onSuccess={mockOnSuccess}
          onClose={mockOnClose}
        />
      );

      expect(screen.queryByText("Test User")).not.toBeInTheDocument();
    });
  });

  describe("PIN input", () => {
    it("updates display when keypad clicked", async () => {
      render(
        <PinEntryModal
          open
          profile={mockProfile}
          onSuccess={mockOnSuccess}
          onClose={mockOnClose}
        />
      );

      fireEvent.click(screen.getByRole("button", { name: "1" }));
      fireEvent.click(screen.getByRole("button", { name: "2" }));
      fireEvent.click(screen.getByRole("button", { name: "3" }));

      // Check that 3 dots are filled
      const display = screen.getByRole("status");
      expect(display).toHaveAttribute("aria-label", "3 of 4 digits entered");
    });

    it("removes digit on backspace", async () => {
      render(
        <PinEntryModal
          open
          profile={mockProfile}
          onSuccess={mockOnSuccess}
          onClose={mockOnClose}
        />
      );

      fireEvent.click(screen.getByRole("button", { name: "1" }));
      fireEvent.click(screen.getByRole("button", { name: "2" }));
      fireEvent.click(screen.getByRole("button", { name: /backspace/i }));

      const display = screen.getByRole("status");
      expect(display).toHaveAttribute("aria-label", "1 of 4 digits entered");
    });
  });

  describe("PIN verification", () => {
    it("calls verify-pin API on submit", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ success: true }),
      });

      render(
        <PinEntryModal
          open
          profile={mockProfile}
          onSuccess={mockOnSuccess}
          onClose={mockOnClose}
        />
      );

      // Enter 4 digits
      fireEvent.click(screen.getByRole("button", { name: "1" }));
      fireEvent.click(screen.getByRole("button", { name: "2" }));
      fireEvent.click(screen.getByRole("button", { name: "3" }));
      fireEvent.click(screen.getByRole("button", { name: "4" }));

      // Click submit
      fireEvent.click(screen.getByRole("button", { name: /submit/i }));

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          `/api/profiles/${mockProfile.id}/verify-pin`,
          expect.objectContaining({
            method: "POST",
            body: JSON.stringify({ pin: "1234" }),
          })
        );
      });
    });

    it("calls onSuccess when PIN is correct", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ success: true }),
      });

      render(
        <PinEntryModal
          open
          profile={mockProfile}
          onSuccess={mockOnSuccess}
          onClose={mockOnClose}
        />
      );

      // Enter PIN and submit
      fireEvent.click(screen.getByRole("button", { name: "1" }));
      fireEvent.click(screen.getByRole("button", { name: "2" }));
      fireEvent.click(screen.getByRole("button", { name: "3" }));
      fireEvent.click(screen.getByRole("button", { name: "4" }));
      fireEvent.click(screen.getByRole("button", { name: /submit/i }));

      await waitFor(() => {
        expect(mockOnSuccess).toHaveBeenCalled();
      });
    });

    it("displays error when PIN is incorrect", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: () =>
          Promise.resolve({ error: "Incorrect PIN", attemptsRemaining: 4 }),
      });

      render(
        <PinEntryModal
          open
          profile={mockProfile}
          onSuccess={mockOnSuccess}
          onClose={mockOnClose}
        />
      );

      // Enter PIN and submit
      fireEvent.click(screen.getByRole("button", { name: "1" }));
      fireEvent.click(screen.getByRole("button", { name: "2" }));
      fireEvent.click(screen.getByRole("button", { name: "3" }));
      fireEvent.click(screen.getByRole("button", { name: "4" }));
      fireEvent.click(screen.getByRole("button", { name: /submit/i }));

      await waitFor(() => {
        expect(screen.getByText(/incorrect pin/i)).toBeInTheDocument();
      });
    });

    it("shows attempts remaining when PIN is incorrect", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: () =>
          Promise.resolve({ error: "Incorrect PIN", attemptsRemaining: 3 }),
      });

      render(
        <PinEntryModal
          open
          profile={mockProfile}
          onSuccess={mockOnSuccess}
          onClose={mockOnClose}
        />
      );

      // Enter PIN and submit
      fireEvent.click(screen.getByRole("button", { name: "1" }));
      fireEvent.click(screen.getByRole("button", { name: "2" }));
      fireEvent.click(screen.getByRole("button", { name: "3" }));
      fireEvent.click(screen.getByRole("button", { name: "4" }));
      fireEvent.click(screen.getByRole("button", { name: /submit/i }));

      await waitFor(() => {
        expect(screen.getByText(/3 attempts remaining/i)).toBeInTheDocument();
      });
    });

    it("clears PIN after incorrect attempt", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: () =>
          Promise.resolve({ error: "Incorrect PIN", attemptsRemaining: 4 }),
      });

      render(
        <PinEntryModal
          open
          profile={mockProfile}
          onSuccess={mockOnSuccess}
          onClose={mockOnClose}
        />
      );

      // Enter PIN and submit
      fireEvent.click(screen.getByRole("button", { name: "1" }));
      fireEvent.click(screen.getByRole("button", { name: "2" }));
      fireEvent.click(screen.getByRole("button", { name: "3" }));
      fireEvent.click(screen.getByRole("button", { name: "4" }));
      fireEvent.click(screen.getByRole("button", { name: /submit/i }));

      await waitFor(() => {
        const display = screen.getByRole("status");
        expect(display).toHaveAttribute("aria-label", "0 of 4 digits entered");
      });
    });
  });

  describe("lockout", () => {
    it("displays lockout timer when locked", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 429,
        json: () =>
          Promise.resolve({
            error: "Profile locked due to too many failed attempts",
            lockedFor: 300, // 5 minutes
          }),
      });

      render(
        <PinEntryModal
          open
          profile={mockProfile}
          onSuccess={mockOnSuccess}
          onClose={mockOnClose}
        />
      );

      // Enter PIN and submit
      fireEvent.click(screen.getByRole("button", { name: "1" }));
      fireEvent.click(screen.getByRole("button", { name: "2" }));
      fireEvent.click(screen.getByRole("button", { name: "3" }));
      fireEvent.click(screen.getByRole("button", { name: "4" }));
      fireEvent.click(screen.getByRole("button", { name: /submit/i }));

      await waitFor(() => {
        // Check for the lockout timer message specifically
        expect(screen.getByText(/locked for/i)).toBeInTheDocument();
      });
    });

    it("disables keypad when locked", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 429,
        json: () =>
          Promise.resolve({
            error: "Profile locked",
            lockedFor: 300,
          }),
      });

      render(
        <PinEntryModal
          open
          profile={mockProfile}
          onSuccess={mockOnSuccess}
          onClose={mockOnClose}
        />
      );

      // Enter PIN and submit
      fireEvent.click(screen.getByRole("button", { name: "1" }));
      fireEvent.click(screen.getByRole("button", { name: "2" }));
      fireEvent.click(screen.getByRole("button", { name: "3" }));
      fireEvent.click(screen.getByRole("button", { name: "4" }));
      fireEvent.click(screen.getByRole("button", { name: /submit/i }));

      await waitFor(() => {
        const digitButton = screen.getByRole("button", { name: "1" });
        expect(digitButton).toBeDisabled();
      });
    });
  });

  describe("cancel and close", () => {
    it("calls onClose when cancel clicked", () => {
      render(
        <PinEntryModal
          open
          profile={mockProfile}
          onSuccess={mockOnSuccess}
          onClose={mockOnClose}
        />
      );

      fireEvent.click(screen.getByRole("button", { name: /cancel/i }));

      expect(mockOnClose).toHaveBeenCalled();
    });

    it("resets state when modal closes", async () => {
      const { rerender } = render(
        <PinEntryModal
          open
          profile={mockProfile}
          onSuccess={mockOnSuccess}
          onClose={mockOnClose}
        />
      );

      // Enter some digits
      fireEvent.click(screen.getByRole("button", { name: "1" }));
      fireEvent.click(screen.getByRole("button", { name: "2" }));

      // Close modal
      rerender(
        <PinEntryModal
          open={false}
          profile={mockProfile}
          onSuccess={mockOnSuccess}
          onClose={mockOnClose}
        />
      );

      // Reopen modal
      rerender(
        <PinEntryModal
          open
          profile={mockProfile}
          onSuccess={mockOnSuccess}
          onClose={mockOnClose}
        />
      );

      // Should be reset
      const display = screen.getByRole("status");
      expect(display).toHaveAttribute("aria-label", "0 of 4 digits entered");
    });
  });

  describe("loading state", () => {
    it("disables keypad while verifying", async () => {
      let resolvePromise: (value: unknown) => void;
      const pendingPromise = new Promise((resolve) => {
        resolvePromise = resolve;
      });

      mockFetch.mockReturnValueOnce({
        ok: true,
        json: () => pendingPromise,
      });

      render(
        <PinEntryModal
          open
          profile={mockProfile}
          onSuccess={mockOnSuccess}
          onClose={mockOnClose}
        />
      );

      // Enter PIN and submit
      fireEvent.click(screen.getByRole("button", { name: "1" }));
      fireEvent.click(screen.getByRole("button", { name: "2" }));
      fireEvent.click(screen.getByRole("button", { name: "3" }));
      fireEvent.click(screen.getByRole("button", { name: "4" }));
      fireEvent.click(screen.getByRole("button", { name: /submit/i }));

      // Keypad should be disabled while loading
      await waitFor(() => {
        const digitButton = screen.getByRole("button", { name: "1" });
        expect(digitButton).toBeDisabled();
      });

      // Resolve the promise to clean up
      resolvePromise!({ success: true });
    });
  });

  describe("PIN length", () => {
    it("supports custom PIN length", () => {
      render(
        <PinEntryModal
          open
          profile={mockProfile}
          pinLength={6}
          onSuccess={mockOnSuccess}
          onClose={mockOnClose}
        />
      );

      const display = screen.getByRole("status");
      expect(display).toHaveAttribute("aria-label", "0 of 6 digits entered");
    });
  });
});
