/**
 * Tests for PinSetupModal component
 */
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PinSetupModal } from "../pin-setup-modal";

// Mock fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Sample profile for testing
const mockProfile = {
  id: "profile-1",
  name: "Test User",
  pinEnabled: false,
};

describe("PinSetupModal", () => {
  const mockOnSuccess = vi.fn();
  const mockOnClose = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockReset();
  });

  describe("rendering", () => {
    it("renders step 1 (create) initially", () => {
      render(
        <PinSetupModal
          open
          profile={mockProfile}
          onSuccess={mockOnSuccess}
          onClose={mockOnClose}
        />
      );

      expect(screen.getByText(/create a pin/i)).toBeInTheDocument();
    });

    it("renders keypad", () => {
      render(
        <PinSetupModal
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
        <PinSetupModal
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
        <PinSetupModal
          open={false}
          profile={mockProfile}
          onSuccess={mockOnSuccess}
          onClose={mockOnClose}
        />
      );

      expect(screen.queryByText(/create a pin/i)).not.toBeInTheDocument();
    });

    it("shows change title when updating existing PIN", () => {
      render(
        <PinSetupModal
          open
          profile={{ ...mockProfile, pinEnabled: true }}
          onSuccess={mockOnSuccess}
          onClose={mockOnClose}
        />
      );

      expect(screen.getByText(/change pin/i)).toBeInTheDocument();
    });
  });

  describe("step 1 - create PIN", () => {
    it("enables Next button when 4+ digits entered", () => {
      render(
        <PinSetupModal
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

      // Next/Submit button should be enabled
      const submitButton = screen.getByRole("button", { name: /submit/i });
      expect(submitButton).not.toBeDisabled();
    });

    it("disables Next button when less than 4 digits", () => {
      render(
        <PinSetupModal
          open
          profile={mockProfile}
          onSuccess={mockOnSuccess}
          onClose={mockOnClose}
        />
      );

      // Enter only 3 digits
      fireEvent.click(screen.getByRole("button", { name: "1" }));
      fireEvent.click(screen.getByRole("button", { name: "2" }));
      fireEvent.click(screen.getByRole("button", { name: "3" }));

      // Next/Submit button should be disabled
      const submitButton = screen.getByRole("button", { name: /submit/i });
      expect(submitButton).toBeDisabled();
    });

    it("advances to step 2 on Next", async () => {
      render(
        <PinSetupModal
          open
          profile={mockProfile}
          onSuccess={mockOnSuccess}
          onClose={mockOnClose}
        />
      );

      // Enter PIN
      fireEvent.click(screen.getByRole("button", { name: "1" }));
      fireEvent.click(screen.getByRole("button", { name: "2" }));
      fireEvent.click(screen.getByRole("button", { name: "3" }));
      fireEvent.click(screen.getByRole("button", { name: "4" }));

      // Click Next (submit button)
      fireEvent.click(screen.getByRole("button", { name: /submit/i }));

      // Should show step 2
      await waitFor(() => {
        expect(screen.getByText(/confirm your pin/i)).toBeInTheDocument();
      });
    });
  });

  describe("step 2 - confirm PIN", () => {
    it("shows error when PINs do not match", async () => {
      render(
        <PinSetupModal
          open
          profile={mockProfile}
          onSuccess={mockOnSuccess}
          onClose={mockOnClose}
        />
      );

      // Step 1: Enter PIN 1234
      fireEvent.click(screen.getByRole("button", { name: "1" }));
      fireEvent.click(screen.getByRole("button", { name: "2" }));
      fireEvent.click(screen.getByRole("button", { name: "3" }));
      fireEvent.click(screen.getByRole("button", { name: "4" }));
      fireEvent.click(screen.getByRole("button", { name: /submit/i }));

      // Wait for step 2
      await waitFor(() => {
        expect(screen.getByText(/confirm your pin/i)).toBeInTheDocument();
      });

      // Step 2: Enter different PIN 5678
      fireEvent.click(screen.getByRole("button", { name: "5" }));
      fireEvent.click(screen.getByRole("button", { name: "6" }));
      fireEvent.click(screen.getByRole("button", { name: "7" }));
      fireEvent.click(screen.getByRole("button", { name: "8" }));
      fireEvent.click(screen.getByRole("button", { name: /submit/i }));

      // Should show mismatch error
      await waitFor(() => {
        expect(screen.getByText(/pins do not match/i)).toBeInTheDocument();
      });
    });

    it("goes back to step 1 on Back button", async () => {
      render(
        <PinSetupModal
          open
          profile={mockProfile}
          onSuccess={mockOnSuccess}
          onClose={mockOnClose}
        />
      );

      // Step 1: Enter PIN
      fireEvent.click(screen.getByRole("button", { name: "1" }));
      fireEvent.click(screen.getByRole("button", { name: "2" }));
      fireEvent.click(screen.getByRole("button", { name: "3" }));
      fireEvent.click(screen.getByRole("button", { name: "4" }));
      fireEvent.click(screen.getByRole("button", { name: /submit/i }));

      // Wait for step 2
      await waitFor(() => {
        expect(screen.getByText(/confirm your pin/i)).toBeInTheDocument();
      });

      // Click Back button
      fireEvent.click(screen.getByRole("button", { name: "Back" }));

      // Should go back to step 1
      await waitFor(() => {
        expect(screen.getByText(/create a pin/i)).toBeInTheDocument();
      });
    });

    it("clears confirmation PIN after mismatch error", async () => {
      render(
        <PinSetupModal
          open
          profile={mockProfile}
          onSuccess={mockOnSuccess}
          onClose={mockOnClose}
        />
      );

      // Step 1: Enter PIN
      fireEvent.click(screen.getByRole("button", { name: "1" }));
      fireEvent.click(screen.getByRole("button", { name: "2" }));
      fireEvent.click(screen.getByRole("button", { name: "3" }));
      fireEvent.click(screen.getByRole("button", { name: "4" }));
      fireEvent.click(screen.getByRole("button", { name: /submit/i }));

      // Wait for step 2
      await waitFor(() => {
        expect(screen.getByText(/confirm your pin/i)).toBeInTheDocument();
      });

      // Step 2: Enter wrong PIN
      fireEvent.click(screen.getByRole("button", { name: "9" }));
      fireEvent.click(screen.getByRole("button", { name: "9" }));
      fireEvent.click(screen.getByRole("button", { name: "9" }));
      fireEvent.click(screen.getByRole("button", { name: "9" }));
      fireEvent.click(screen.getByRole("button", { name: /submit/i }));

      // Should show error and clear PIN
      await waitFor(() => {
        expect(screen.getByText(/pins do not match/i)).toBeInTheDocument();
        const display = screen.getByRole("status");
        expect(display).toHaveAttribute("aria-label", "0 of 4 digits entered");
      });
    });
  });

  describe("API calls", () => {
    it("calls set-pin API when PINs match", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ success: true }),
      });

      render(
        <PinSetupModal
          open
          profile={mockProfile}
          onSuccess={mockOnSuccess}
          onClose={mockOnClose}
        />
      );

      // Step 1: Enter PIN
      fireEvent.click(screen.getByRole("button", { name: "1" }));
      fireEvent.click(screen.getByRole("button", { name: "2" }));
      fireEvent.click(screen.getByRole("button", { name: "3" }));
      fireEvent.click(screen.getByRole("button", { name: "4" }));
      fireEvent.click(screen.getByRole("button", { name: /submit/i }));

      // Wait for step 2
      await waitFor(() => {
        expect(screen.getByText(/confirm your pin/i)).toBeInTheDocument();
      });

      // Step 2: Enter same PIN
      fireEvent.click(screen.getByRole("button", { name: "1" }));
      fireEvent.click(screen.getByRole("button", { name: "2" }));
      fireEvent.click(screen.getByRole("button", { name: "3" }));
      fireEvent.click(screen.getByRole("button", { name: "4" }));
      fireEvent.click(screen.getByRole("button", { name: /submit/i }));

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          `/api/profiles/${mockProfile.id}/set-pin`,
          expect.objectContaining({
            method: "POST",
            body: JSON.stringify({ pin: "1234" }),
          })
        );
      });
    });

    it("calls onSuccess on successful save", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ success: true }),
      });

      render(
        <PinSetupModal
          open
          profile={mockProfile}
          onSuccess={mockOnSuccess}
          onClose={mockOnClose}
        />
      );

      // Step 1: Enter PIN
      fireEvent.click(screen.getByRole("button", { name: "1" }));
      fireEvent.click(screen.getByRole("button", { name: "2" }));
      fireEvent.click(screen.getByRole("button", { name: "3" }));
      fireEvent.click(screen.getByRole("button", { name: "4" }));
      fireEvent.click(screen.getByRole("button", { name: /submit/i }));

      // Wait for step 2
      await waitFor(() => {
        expect(screen.getByText(/confirm your pin/i)).toBeInTheDocument();
      });

      // Step 2: Enter same PIN
      fireEvent.click(screen.getByRole("button", { name: "1" }));
      fireEvent.click(screen.getByRole("button", { name: "2" }));
      fireEvent.click(screen.getByRole("button", { name: "3" }));
      fireEvent.click(screen.getByRole("button", { name: "4" }));
      fireEvent.click(screen.getByRole("button", { name: /submit/i }));

      await waitFor(() => {
        expect(mockOnSuccess).toHaveBeenCalled();
      });
    });

    it("shows API error when save fails", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: () => Promise.resolve({ error: "Failed to set PIN" }),
      });

      render(
        <PinSetupModal
          open
          profile={mockProfile}
          onSuccess={mockOnSuccess}
          onClose={mockOnClose}
        />
      );

      // Step 1: Enter PIN
      fireEvent.click(screen.getByRole("button", { name: "1" }));
      fireEvent.click(screen.getByRole("button", { name: "2" }));
      fireEvent.click(screen.getByRole("button", { name: "3" }));
      fireEvent.click(screen.getByRole("button", { name: "4" }));
      fireEvent.click(screen.getByRole("button", { name: /submit/i }));

      // Wait for step 2
      await waitFor(() => {
        expect(screen.getByText(/confirm your pin/i)).toBeInTheDocument();
      });

      // Step 2: Enter same PIN
      fireEvent.click(screen.getByRole("button", { name: "1" }));
      fireEvent.click(screen.getByRole("button", { name: "2" }));
      fireEvent.click(screen.getByRole("button", { name: "3" }));
      fireEvent.click(screen.getByRole("button", { name: "4" }));
      fireEvent.click(screen.getByRole("button", { name: /submit/i }));

      await waitFor(() => {
        expect(screen.getByText(/failed to set pin/i)).toBeInTheDocument();
      });
    });
  });

  describe("cancel behavior", () => {
    it("calls onClose when Cancel clicked on step 1", () => {
      render(
        <PinSetupModal
          open
          profile={mockProfile}
          onSuccess={mockOnSuccess}
          onClose={mockOnClose}
        />
      );

      fireEvent.click(screen.getByRole("button", { name: /cancel/i }));

      expect(mockOnClose).toHaveBeenCalled();
    });

    it("prevents cancel for required admin profiles", () => {
      render(
        <PinSetupModal
          open
          profile={mockProfile}
          required
          onSuccess={mockOnSuccess}
          onClose={mockOnClose}
        />
      );

      // Cancel button should not be visible
      expect(
        screen.queryByRole("button", { name: /cancel/i })
      ).not.toBeInTheDocument();
    });

    it("shows required message when required prop is true", () => {
      render(
        <PinSetupModal
          open
          profile={mockProfile}
          required
          onSuccess={mockOnSuccess}
          onClose={mockOnClose}
        />
      );

      expect(screen.getByText(/pin is required/i)).toBeInTheDocument();
    });
  });

  describe("state reset", () => {
    it("resets state when modal closes", async () => {
      const { rerender } = render(
        <PinSetupModal
          open
          profile={mockProfile}
          onSuccess={mockOnSuccess}
          onClose={mockOnClose}
        />
      );

      // Enter some digits and advance to step 2
      fireEvent.click(screen.getByRole("button", { name: "1" }));
      fireEvent.click(screen.getByRole("button", { name: "2" }));
      fireEvent.click(screen.getByRole("button", { name: "3" }));
      fireEvent.click(screen.getByRole("button", { name: "4" }));
      fireEvent.click(screen.getByRole("button", { name: /submit/i }));

      await waitFor(() => {
        expect(screen.getByText(/confirm your pin/i)).toBeInTheDocument();
      });

      // Close modal
      rerender(
        <PinSetupModal
          open={false}
          profile={mockProfile}
          onSuccess={mockOnSuccess}
          onClose={mockOnClose}
        />
      );

      // Reopen modal
      rerender(
        <PinSetupModal
          open
          profile={mockProfile}
          onSuccess={mockOnSuccess}
          onClose={mockOnClose}
        />
      );

      // Should be back to step 1
      expect(screen.getByText(/create a pin/i)).toBeInTheDocument();
      const display = screen.getByRole("status");
      expect(display).toHaveAttribute("aria-label", "0 of 4 digits entered");
    });
  });

  describe("PIN tips", () => {
    it("shows PIN tips on step 1", () => {
      render(
        <PinSetupModal
          open
          profile={mockProfile}
          onSuccess={mockOnSuccess}
          onClose={mockOnClose}
        />
      );

      expect(screen.getByText(/4-6 digits/i)).toBeInTheDocument();
    });
  });
});
