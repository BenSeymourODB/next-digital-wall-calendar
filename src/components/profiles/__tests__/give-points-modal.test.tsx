/**
 * Tests for GivePointsModal component
 */
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { GivePointsModal } from "../give-points-modal";
import type { Profile } from "../profile-context";

// Mock fetch for API calls
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Mock profiles
const mockAdminProfile: Profile = {
  id: "admin-1",
  userId: "user-1",
  name: "Admin User",
  type: "admin",
  ageGroup: "adult",
  color: "#3b82f6",
  avatar: {
    type: "initials",
    value: "AU",
    backgroundColor: "#3b82f6",
  },
  pinEnabled: true,
  isActive: true,
};

const mockStandardProfile: Profile = {
  id: "child-1",
  userId: "user-1",
  name: "Child User",
  type: "standard",
  ageGroup: "child",
  color: "#22c55e",
  avatar: {
    type: "emoji",
    value: "👦",
  },
  pinEnabled: false,
  isActive: true,
};

const mockProfiles: Profile[] = [mockAdminProfile, mockStandardProfile];

describe("GivePointsModal", () => {
  const mockOnSuccess = vi.fn();
  const mockOnClose = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ success: true, newTotal: 150 }),
    });
  });

  describe("rendering", () => {
    it("renders nothing when not open", () => {
      render(
        <GivePointsModal
          open={false}
          profiles={mockProfiles}
          adminProfile={mockAdminProfile}
          onSuccess={mockOnSuccess}
          onClose={mockOnClose}
        />
      );

      expect(screen.queryByText("Give Bonus Points")).not.toBeInTheDocument();
    });

    it("renders modal when open", () => {
      render(
        <GivePointsModal
          open={true}
          profiles={mockProfiles}
          adminProfile={mockAdminProfile}
          onSuccess={mockOnSuccess}
          onClose={mockOnClose}
        />
      );

      expect(screen.getByText("Give Bonus Points")).toBeInTheDocument();
    });

    it("renders profile selection dropdown", () => {
      render(
        <GivePointsModal
          open={true}
          profiles={mockProfiles}
          adminProfile={mockAdminProfile}
          onSuccess={mockOnSuccess}
          onClose={mockOnClose}
        />
      );

      expect(screen.getByLabelText(/select profile/i)).toBeInTheDocument();
    });

    it("renders points input field", () => {
      render(
        <GivePointsModal
          open={true}
          profiles={mockProfiles}
          adminProfile={mockAdminProfile}
          onSuccess={mockOnSuccess}
          onClose={mockOnClose}
        />
      );

      expect(screen.getByLabelText(/points to award/i)).toBeInTheDocument();
    });

    it("renders optional note field", () => {
      render(
        <GivePointsModal
          open={true}
          profiles={mockProfiles}
          adminProfile={mockAdminProfile}
          onSuccess={mockOnSuccess}
          onClose={mockOnClose}
        />
      );

      expect(screen.getByLabelText(/reason/i)).toBeInTheDocument();
    });

    it("renders submit and cancel buttons", () => {
      render(
        <GivePointsModal
          open={true}
          profiles={mockProfiles}
          adminProfile={mockAdminProfile}
          onSuccess={mockOnSuccess}
          onClose={mockOnClose}
        />
      );

      expect(
        screen.getByRole("button", { name: /give points/i })
      ).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: /cancel/i })
      ).toBeInTheDocument();
    });
  });

  describe("profile selection", () => {
    it("renders select trigger with profile options", () => {
      render(
        <GivePointsModal
          open={true}
          profiles={mockProfiles}
          adminProfile={mockAdminProfile}
          onSuccess={mockOnSuccess}
          onClose={mockOnClose}
        />
      );

      // The select should be rendered and accessible
      const select = screen.getByLabelText(/select profile/i);
      expect(select).toBeInTheDocument();
      // The first non-admin profile should be pre-selected and visible
      expect(screen.getByText("Child User")).toBeInTheDocument();
    });

    it("pre-selects first non-admin profile if available", () => {
      render(
        <GivePointsModal
          open={true}
          profiles={mockProfiles}
          adminProfile={mockAdminProfile}
          onSuccess={mockOnSuccess}
          onClose={mockOnClose}
        />
      );

      // The dropdown should show the first non-admin profile by default
      expect(screen.getByText("Child User")).toBeInTheDocument();
    });
  });

  describe("points input", () => {
    it("accepts numeric input", async () => {
      const user = userEvent.setup();

      render(
        <GivePointsModal
          open={true}
          profiles={mockProfiles}
          adminProfile={mockAdminProfile}
          onSuccess={mockOnSuccess}
          onClose={mockOnClose}
        />
      );

      const input = screen.getByLabelText(/points to award/i);
      await user.clear(input);
      await user.type(input, "50");

      expect(input).toHaveValue(50);
    });

    it("does not accept negative values", async () => {
      const user = userEvent.setup();

      render(
        <GivePointsModal
          open={true}
          profiles={mockProfiles}
          adminProfile={mockAdminProfile}
          onSuccess={mockOnSuccess}
          onClose={mockOnClose}
        />
      );

      const input = screen.getByLabelText(/points to award/i);
      await user.clear(input);
      await user.type(input, "-10");

      // HTML input type="number" with min="1" should prevent negative
      expect(input).toHaveAttribute("min", "1");
    });
  });

  describe("form submission", () => {
    it("calls API with correct data on submit", async () => {
      const user = userEvent.setup();

      render(
        <GivePointsModal
          open={true}
          profiles={mockProfiles}
          adminProfile={mockAdminProfile}
          onSuccess={mockOnSuccess}
          onClose={mockOnClose}
        />
      );

      // Enter points
      const pointsInput = screen.getByLabelText(/points to award/i);
      await user.clear(pointsInput);
      await user.type(pointsInput, "25");

      // Enter note
      const noteInput = screen.getByLabelText(/reason/i);
      await user.type(noteInput, "Great job!");

      // Submit
      const submitButton = screen.getByRole("button", { name: /give points/i });
      await user.click(submitButton);

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          `/api/profiles/${mockStandardProfile.id}/give-points`,
          expect.objectContaining({
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              points: 25,
              awardedByProfileId: mockAdminProfile.id,
              note: "Great job!",
            }),
          })
        );
      });
    });

    it("calls onSuccess after successful submission", async () => {
      const user = userEvent.setup();

      render(
        <GivePointsModal
          open={true}
          profiles={mockProfiles}
          adminProfile={mockAdminProfile}
          onSuccess={mockOnSuccess}
          onClose={mockOnClose}
        />
      );

      const pointsInput = screen.getByLabelText(/points to award/i);
      await user.clear(pointsInput);
      await user.type(pointsInput, "25");

      const submitButton = screen.getByRole("button", { name: /give points/i });
      await user.click(submitButton);

      await waitFor(() => {
        expect(mockOnSuccess).toHaveBeenCalled();
      });
    });

    it("displays error message on API failure", async () => {
      const user = userEvent.setup();
      mockFetch.mockResolvedValue({
        ok: false,
        json: () => Promise.resolve({ error: "Failed to award points" }),
      });

      render(
        <GivePointsModal
          open={true}
          profiles={mockProfiles}
          adminProfile={mockAdminProfile}
          onSuccess={mockOnSuccess}
          onClose={mockOnClose}
        />
      );

      const pointsInput = screen.getByLabelText(/points to award/i);
      await user.clear(pointsInput);
      await user.type(pointsInput, "25");

      const submitButton = screen.getByRole("button", { name: /give points/i });
      await user.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText(/failed/i)).toBeInTheDocument();
      });
    });

    it("disables submit button while submitting", async () => {
      const user = userEvent.setup();

      // Create a delayed promise to simulate API call
      let resolvePromise: (value: unknown) => void;
      mockFetch.mockImplementation(
        () =>
          new Promise((resolve) => {
            resolvePromise = resolve;
          })
      );

      render(
        <GivePointsModal
          open={true}
          profiles={mockProfiles}
          adminProfile={mockAdminProfile}
          onSuccess={mockOnSuccess}
          onClose={mockOnClose}
        />
      );

      const pointsInput = screen.getByLabelText(/points to award/i);
      await user.clear(pointsInput);
      await user.type(pointsInput, "25");

      const submitButton = screen.getByRole("button", { name: /give points/i });
      await user.click(submitButton);

      // Button should be disabled while loading
      expect(submitButton).toBeDisabled();

      // Resolve the promise
      resolvePromise!({
        ok: true,
        json: () => Promise.resolve({ success: true, newTotal: 150 }),
      });
    });

    it("disables submit button when points is empty or zero", () => {
      render(
        <GivePointsModal
          open={true}
          profiles={mockProfiles}
          adminProfile={mockAdminProfile}
          onSuccess={mockOnSuccess}
          onClose={mockOnClose}
        />
      );

      const submitButton = screen.getByRole("button", { name: /give points/i });
      // Default value should be empty or 0, so button should be disabled
      expect(submitButton).toBeDisabled();
    });
  });

  describe("cancel behavior", () => {
    it("calls onClose when cancel button clicked", async () => {
      const user = userEvent.setup();

      render(
        <GivePointsModal
          open={true}
          profiles={mockProfiles}
          adminProfile={mockAdminProfile}
          onSuccess={mockOnSuccess}
          onClose={mockOnClose}
        />
      );

      const cancelButton = screen.getByRole("button", { name: /cancel/i });
      await user.click(cancelButton);

      expect(mockOnClose).toHaveBeenCalled();
    });

    it("resets form when reopened", async () => {
      const user = userEvent.setup();

      const { rerender } = render(
        <GivePointsModal
          open={true}
          profiles={mockProfiles}
          adminProfile={mockAdminProfile}
          onSuccess={mockOnSuccess}
          onClose={mockOnClose}
        />
      );

      // Enter some data
      const pointsInput = screen.getByLabelText(/points to award/i);
      await user.clear(pointsInput);
      await user.type(pointsInput, "50");

      const noteInput = screen.getByLabelText(/reason/i);
      await user.type(noteInput, "Test note");

      // Close modal
      rerender(
        <GivePointsModal
          open={false}
          profiles={mockProfiles}
          adminProfile={mockAdminProfile}
          onSuccess={mockOnSuccess}
          onClose={mockOnClose}
        />
      );

      // Reopen modal
      rerender(
        <GivePointsModal
          open={true}
          profiles={mockProfiles}
          adminProfile={mockAdminProfile}
          onSuccess={mockOnSuccess}
          onClose={mockOnClose}
        />
      );

      // Fields should be reset
      const newPointsInput = screen.getByLabelText(/points to award/i);
      const newNoteInput = screen.getByLabelText(/reason/i);

      expect(newPointsInput).toHaveValue(null);
      expect(newNoteInput).toHaveValue("");
    });
  });

  describe("accessibility", () => {
    it("has accessible dialog role", () => {
      render(
        <GivePointsModal
          open={true}
          profiles={mockProfiles}
          adminProfile={mockAdminProfile}
          onSuccess={mockOnSuccess}
          onClose={mockOnClose}
        />
      );

      expect(screen.getByRole("dialog")).toBeInTheDocument();
    });

    it("has accessible labels for form fields", () => {
      render(
        <GivePointsModal
          open={true}
          profiles={mockProfiles}
          adminProfile={mockAdminProfile}
          onSuccess={mockOnSuccess}
          onClose={mockOnClose}
        />
      );

      expect(screen.getByLabelText(/select profile/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/points to award/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/reason/i)).toBeInTheDocument();
    });
  });
});
