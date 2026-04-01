/**
 * Tests for AccountSection component
 * Following TDD - tests are written before implementation
 */
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AccountSection } from "../account-section";

// Mock next-auth/react
const mockSignOut = vi.hoisted(() => vi.fn());
vi.mock("next-auth/react", () => ({
  signOut: mockSignOut,
}));

// Mock sonner toast
vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

const mockUser = {
  name: "Test User",
  email: "test@example.com",
  image: "https://example.com/avatar.jpg",
};

const mockOnDeleteAccount = vi.fn();

describe("AccountSection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockOnDeleteAccount.mockResolvedValue(undefined);
  });

  it("renders user name", () => {
    render(
      <AccountSection
        user={mockUser}
        createdAt="2024-01-01T00:00:00Z"
        providers={["google"]}
        onDeleteAccount={mockOnDeleteAccount}
      />
    );

    expect(screen.getByText("Test User")).toBeInTheDocument();
  });

  it("renders user email", () => {
    render(
      <AccountSection
        user={mockUser}
        createdAt="2024-01-01T00:00:00Z"
        providers={["google"]}
        onDeleteAccount={mockOnDeleteAccount}
      />
    );

    expect(screen.getByText("test@example.com")).toBeInTheDocument();
  });

  it("renders user image", () => {
    render(
      <AccountSection
        user={mockUser}
        createdAt="2024-01-01T00:00:00Z"
        providers={["google"]}
        onDeleteAccount={mockOnDeleteAccount}
      />
    );

    const img = screen.getByAltText("Test User");
    expect(img).toBeInTheDocument();
    expect(img).toHaveAttribute("src", "https://example.com/avatar.jpg");
  });

  it("shows connected providers", () => {
    render(
      <AccountSection
        user={mockUser}
        createdAt="2024-01-01T00:00:00Z"
        providers={["google"]}
        onDeleteAccount={mockOnDeleteAccount}
      />
    );

    expect(screen.getByText(/google/i)).toBeInTheDocument();
  });

  it("sign out button calls signOut", async () => {
    const user = userEvent.setup();

    render(
      <AccountSection
        user={mockUser}
        createdAt="2024-01-01T00:00:00Z"
        providers={["google"]}
        onDeleteAccount={mockOnDeleteAccount}
      />
    );

    const signOutButton = screen.getByRole("button", { name: /sign out/i });
    await user.click(signOutButton);

    expect(mockSignOut).toHaveBeenCalled();
  });

  it("delete account shows confirmation dialog", async () => {
    const user = userEvent.setup();

    render(
      <AccountSection
        user={mockUser}
        createdAt="2024-01-01T00:00:00Z"
        providers={["google"]}
        onDeleteAccount={mockOnDeleteAccount}
      />
    );

    const deleteButton = screen.getByRole("button", {
      name: /delete account/i,
    });
    await user.click(deleteButton);

    await waitFor(() => {
      expect(screen.getByText(/are you sure/i)).toBeInTheDocument();
    });
  });

  it("confirming delete calls onDeleteAccount", async () => {
    const user = userEvent.setup();

    render(
      <AccountSection
        user={mockUser}
        createdAt="2024-01-01T00:00:00Z"
        providers={["google"]}
        onDeleteAccount={mockOnDeleteAccount}
      />
    );

    // Open delete dialog
    const deleteButton = screen.getByRole("button", {
      name: /delete account/i,
    });
    await user.click(deleteButton);

    // Confirm deletion
    await waitFor(async () => {
      const confirmButton = screen.getByRole("button", {
        name: /yes, delete/i,
      });
      await user.click(confirmButton);
    });

    expect(mockOnDeleteAccount).toHaveBeenCalled();
  });

  it("shows member since date", () => {
    render(
      <AccountSection
        user={mockUser}
        createdAt="2024-01-01T00:00:00Z"
        providers={["google"]}
        onDeleteAccount={mockOnDeleteAccount}
      />
    );

    expect(screen.getByText(/member since/i)).toBeInTheDocument();
  });
});
