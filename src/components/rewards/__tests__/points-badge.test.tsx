/**
 * Tests for PointsBadge.
 *
 * The badge reads from `usePoints()`, so tests wrap renders in a
 * `PointsProvider`. The provider's GET fetch is mocked here so each
 * test can dictate the `enabled` flag and `totalPoints` independently.
 */
import { type ReactNode } from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PointsBadge } from "../points-badge";
import { PointsProvider } from "../points-context";

const mockFetch = vi.fn();
global.fetch = mockFetch;

vi.mock("@/lib/logger", () => ({
  logger: {
    error: vi.fn(),
    log: vi.fn(),
    event: vi.fn(),
  },
}));

function Wrapper({
  children,
  profileId,
}: {
  children: ReactNode;
  profileId: string | null;
}) {
  return <PointsProvider profileId={profileId}>{children}</PointsProvider>;
}

describe("PointsBadge", () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("renders nothing when no PointsProvider is mounted (defensive)", () => {
    const { container } = render(<PointsBadge />);
    expect(container).toBeEmptyDOMElement();
  });

  it("renders nothing when there is no active profile", () => {
    const { container } = render(
      <Wrapper profileId={null}>
        <PointsBadge />
      </Wrapper>
    );

    expect(container).toBeEmptyDOMElement();
  });

  it("renders nothing when rewards are disabled for the user", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ totalPoints: 0, enabled: false }),
    });

    const { container } = render(
      <Wrapper profileId="profile-1">
        <PointsBadge />
      </Wrapper>
    );

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalled();
    });

    expect(container).toBeEmptyDOMElement();
  });

  it("renders the locale-formatted total + 'pts' when rewards are enabled", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ totalPoints: 1250, enabled: true }),
    });

    render(
      <Wrapper profileId="profile-1">
        <PointsBadge />
      </Wrapper>
    );

    await waitFor(() => {
      expect(screen.getByText(/1,250/)).toBeInTheDocument();
    });
    expect(screen.getByText(/pts/i)).toBeInTheDocument();
  });

  it("exposes an accessible label that announces the current total", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ totalPoints: 42, enabled: true }),
    });

    render(
      <Wrapper profileId="profile-1">
        <PointsBadge />
      </Wrapper>
    );

    const badge = await screen.findByLabelText(/42 reward points/i);
    expect(badge).toBeInTheDocument();
  });

  it("includes the trophy emoji as decorative content", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ totalPoints: 7, enabled: true }),
    });

    render(
      <Wrapper profileId="profile-1">
        <PointsBadge />
      </Wrapper>
    );

    await waitFor(() => {
      expect(screen.getByText(/7/)).toBeInTheDocument();
    });

    // The emoji is rendered with aria-hidden so screen readers skip it
    // (the visible label already conveys the meaning).
    expect(screen.getByText("\u{1F3C6}")).toHaveAttribute(
      "aria-hidden",
      "true"
    );
  });
});
