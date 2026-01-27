/**
 * Tests for ProfileForm component
 */
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ProfileForm } from "../profile-form";

// Mock fetch for API calls
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe("ProfileForm", () => {
  const defaultProps = {
    onSuccess: vi.fn(),
    onCancel: vi.fn(),
    isFirstProfile: false,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          id: "new-profile-id",
          name: "Test Profile",
          type: "standard",
        }),
    });
  });

  describe("rendering", () => {
    it("renders form fields", () => {
      render(<ProfileForm {...defaultProps} />);

      expect(screen.getByLabelText(/name/i)).toBeInTheDocument();
      expect(
        screen.getByRole("group", { name: /profile color/i })
      ).toBeInTheDocument();
      expect(screen.getByLabelText(/profile type/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/age group/i)).toBeInTheDocument();
    });

    it("renders create profile button", () => {
      render(<ProfileForm {...defaultProps} />);

      expect(
        screen.getByRole("button", { name: /create profile/i })
      ).toBeInTheDocument();
    });

    it("renders cancel button", () => {
      render(<ProfileForm {...defaultProps} />);

      expect(
        screen.getByRole("button", { name: /cancel/i })
      ).toBeInTheDocument();
    });
  });

  describe("first profile validation", () => {
    it("forces admin type for first profile", () => {
      render(<ProfileForm {...defaultProps} isFirstProfile={true} />);

      const typeSelect = screen.getByLabelText(/profile type/i);
      expect(typeSelect).toBeDisabled();
      // Verify the select trigger shows the correct value
      expect(typeSelect).toHaveTextContent(/admin/i);
    });

    it("shows info message for first profile", () => {
      render(<ProfileForm {...defaultProps} isFirstProfile={true} />);

      expect(
        screen.getByText(/first profile must be an admin/i)
      ).toBeInTheDocument();
    });

    it("allows type selection for non-first profile", () => {
      render(<ProfileForm {...defaultProps} isFirstProfile={false} />);

      const typeSelect = screen.getByLabelText(/profile type/i);
      expect(typeSelect).not.toBeDisabled();
    });
  });

  describe("form validation", () => {
    it("requires name field", async () => {
      const user = userEvent.setup();
      render(<ProfileForm {...defaultProps} />);

      const submitButton = screen.getByRole("button", {
        name: /create profile/i,
      });
      await user.click(submitButton);

      expect(screen.getByText(/name is required/i)).toBeInTheDocument();
      expect(defaultProps.onSuccess).not.toHaveBeenCalled();
    });

    it("trims whitespace from name", async () => {
      const user = userEvent.setup();
      render(<ProfileForm {...defaultProps} />);

      const nameInput = screen.getByLabelText(/name/i);
      await user.type(nameInput, "   ");

      const submitButton = screen.getByRole("button", {
        name: /create profile/i,
      });
      await user.click(submitButton);

      expect(screen.getByText(/name is required/i)).toBeInTheDocument();
    });
  });

  describe("color selection", () => {
    it("has default color selected", () => {
      render(<ProfileForm {...defaultProps} />);

      const blueButton = screen.getByRole("button", { name: /blue/i });
      expect(blueButton).toHaveAttribute("aria-pressed", "true");
    });

    it("allows changing color", () => {
      render(<ProfileForm {...defaultProps} />);

      const greenButton = screen.getByRole("button", { name: /green/i });
      fireEvent.click(greenButton);

      expect(greenButton).toHaveAttribute("aria-pressed", "true");
    });
  });

  describe("form submission", () => {
    it("submits form with all fields", async () => {
      const user = userEvent.setup();
      render(<ProfileForm {...defaultProps} />);

      const nameInput = screen.getByLabelText(/name/i);
      await user.type(nameInput, "New Member");

      // Select green color
      const greenButton = screen.getByRole("button", { name: /green/i });
      fireEvent.click(greenButton);

      const submitButton = screen.getByRole("button", {
        name: /create profile/i,
      });
      await user.click(submitButton);

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          "/api/profiles",
          expect.objectContaining({
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: expect.stringContaining("New Member"),
          })
        );
      });
    });

    it("calls onSuccess after successful submission", async () => {
      const user = userEvent.setup();
      render(<ProfileForm {...defaultProps} />);

      const nameInput = screen.getByLabelText(/name/i);
      await user.type(nameInput, "Test Profile");

      const submitButton = screen.getByRole("button", {
        name: /create profile/i,
      });
      await user.click(submitButton);

      await waitFor(() => {
        expect(defaultProps.onSuccess).toHaveBeenCalledWith(
          expect.objectContaining({
            id: "new-profile-id",
            name: "Test Profile",
          })
        );
      });
    });

    it("shows error message on API failure", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: () => Promise.resolve({ error: "Profile limit reached" }),
      });

      const user = userEvent.setup();
      render(<ProfileForm {...defaultProps} />);

      const nameInput = screen.getByLabelText(/name/i);
      await user.type(nameInput, "Test Profile");

      const submitButton = screen.getByRole("button", {
        name: /create profile/i,
      });
      await user.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText(/profile limit reached/i)).toBeInTheDocument();
      });
    });

    it("disables form during submission", async () => {
      const user = userEvent.setup();
      mockFetch.mockImplementation(
        () =>
          new Promise((resolve) =>
            setTimeout(
              () =>
                resolve({
                  ok: true,
                  json: () => Promise.resolve({ id: "new-id" }),
                }),
              100
            )
          )
      );

      render(<ProfileForm {...defaultProps} />);

      const nameInput = screen.getByLabelText(/name/i);
      await user.type(nameInput, "Test Profile");

      const submitButton = screen.getByRole("button", {
        name: /create profile/i,
      });
      await user.click(submitButton);

      // Should show loading state
      expect(submitButton).toBeDisabled();
    });
  });

  describe("cancel action", () => {
    it("calls onCancel when cancel button clicked", async () => {
      const user = userEvent.setup();
      render(<ProfileForm {...defaultProps} />);

      const cancelButton = screen.getByRole("button", { name: /cancel/i });
      await user.click(cancelButton);

      expect(defaultProps.onCancel).toHaveBeenCalled();
    });
  });

  describe("avatar preview", () => {
    it("shows avatar preview with initials", async () => {
      const user = userEvent.setup();
      render(<ProfileForm {...defaultProps} />);

      const nameInput = screen.getByLabelText(/name/i);
      await user.type(nameInput, "John Doe");

      // Avatar should show initials "JD"
      expect(screen.getByText("JD")).toBeInTheDocument();
    });

    it("updates avatar color when color changes", async () => {
      const user = userEvent.setup();
      render(<ProfileForm {...defaultProps} />);

      const nameInput = screen.getByLabelText(/name/i);
      await user.type(nameInput, "John");

      // Click green color
      const greenButton = screen.getByRole("button", { name: /green/i });
      fireEvent.click(greenButton);

      // Avatar should update (check for avatar element with green background)
      const avatar = screen.getByTestId("avatar-preview");
      expect(avatar).toHaveStyle({ backgroundColor: "#22c55e" });
    });
  });
});
