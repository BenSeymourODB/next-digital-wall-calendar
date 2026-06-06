/**
 * Tests for the ReauthCta button shared by NewTaskModal and TaskList.
 *
 * Covers the contract both consumers depend on: clicking the button
 * invokes `signIn("google", …)` with a callbackUrl that preserves the
 * user's current pathname + query string so the OAuth round-trip lands
 * them back on their current view (e.g. /calendar?date=…&view=week).
 */
import { signIn } from "next-auth/react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ReauthCta } from "../reauth-cta";

vi.mock("next-auth/react", () => ({
  signIn: vi.fn(),
}));

const mockSignIn = vi.mocked(signIn);

describe("ReauthCta", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders a button labelled 'Sign in again'", () => {
    render(<ReauthCta />);
    expect(
      screen.getByRole("button", { name: /sign in again/i })
    ).toBeInTheDocument();
  });

  it("invokes signIn('google', …) with a callbackUrl on click", async () => {
    const user = userEvent.setup();
    render(<ReauthCta />);

    await user.click(screen.getByRole("button", { name: /sign in again/i }));

    expect(mockSignIn).toHaveBeenCalledWith(
      "google",
      expect.objectContaining({ callbackUrl: expect.any(String) })
    );
  });

  it("preserves pathname + search in the callbackUrl so the user returns to their current view", async () => {
    const user = userEvent.setup();
    window.history.replaceState({}, "", "/calendar?date=2026-05-04&view=week");

    render(<ReauthCta />);
    await user.click(screen.getByRole("button", { name: /sign in again/i }));

    expect(mockSignIn).toHaveBeenCalledWith(
      "google",
      expect.objectContaining({
        callbackUrl: "/calendar?date=2026-05-04&view=week",
      })
    );
  });

  it("accepts a custom label for the button text", () => {
    render(<ReauthCta label="Reconnect Google" />);
    expect(
      screen.getByRole("button", { name: /reconnect google/i })
    ).toBeInTheDocument();
  });
});
