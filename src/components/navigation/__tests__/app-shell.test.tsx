/**
 * Tests for AppShell wrapper
 *
 * Verifies that the shell conditionally renders SideNavigation and
 * ScreenTransition based on the current pathname.
 */
import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AppShell } from "../app-shell";

let mockPathname = "/calendar";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
  usePathname: () => mockPathname,
}));

// Mock matchMedia for jsdom — ScreenTransition consults it
beforeEach(() => {
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }));
  mockPathname = "/calendar";
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("AppShell", () => {
  it("renders SideNavigation and ScreenTransition on main app routes", () => {
    mockPathname = "/calendar";
    render(
      <AppShell>
        <div data-testid="page-content">Calendar</div>
      </AppShell>
    );

    expect(
      screen.getByRole("navigation", { name: /main navigation/i })
    ).toBeInTheDocument();
    expect(screen.getByTestId("screen-transition")).toBeInTheDocument();
    expect(screen.getByTestId("page-content")).toBeInTheDocument();
  });

  it("renders children without nav on the landing page", () => {
    mockPathname = "/";
    render(
      <AppShell>
        <div data-testid="page-content">Home</div>
      </AppShell>
    );

    expect(
      screen.queryByRole("navigation", { name: /main navigation/i })
    ).not.toBeInTheDocument();
    expect(screen.queryByTestId("screen-transition")).not.toBeInTheDocument();
    expect(screen.getByTestId("page-content")).toBeInTheDocument();
  });

  it("renders children without nav on auth routes", () => {
    mockPathname = "/auth/signin";
    render(
      <AppShell>
        <div data-testid="page-content">Sign in</div>
      </AppShell>
    );

    expect(
      screen.queryByRole("navigation", { name: /main navigation/i })
    ).not.toBeInTheDocument();
    expect(screen.getByTestId("page-content")).toBeInTheDocument();
  });

  it("renders children plainly on scheduler-demo routes to avoid double-wrap", () => {
    mockPathname = "/test/scheduler-demo/screen-b";
    render(
      <AppShell>
        <div data-testid="page-content">Scheduler demo</div>
      </AppShell>
    );

    expect(
      screen.queryByRole("navigation", { name: /main navigation/i })
    ).not.toBeInTheDocument();
    expect(screen.queryByTestId("screen-transition")).not.toBeInTheDocument();
    expect(screen.getByTestId("page-content")).toBeInTheDocument();
  });

  it("shows nav on nested main-screen routes like /profiles/new", () => {
    mockPathname = "/profiles/new";
    render(
      <AppShell>
        <div data-testid="page-content">New profile</div>
      </AppShell>
    );

    expect(
      screen.getByRole("navigation", { name: /main navigation/i })
    ).toBeInTheDocument();
    expect(screen.getByTestId("screen-transition")).toBeInTheDocument();
  });
});
