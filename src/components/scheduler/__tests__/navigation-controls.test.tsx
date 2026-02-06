/**
 * Tests for NavigationControls component
 *
 * Tests rendering, button interactions, position indicator,
 * accessibility, and auto-hide behavior.
 */
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NavigationControls } from "../navigation-controls";

const defaultProps = {
  currentIndex: 1,
  totalScreens: 4,
  isPaused: false,
  isVisible: true,
  onPrevious: vi.fn(),
  onNext: vi.fn(),
  onTogglePause: vi.fn(),
};

describe("NavigationControls", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders previous, pause/play, and next buttons", () => {
    render(<NavigationControls {...defaultProps} />);

    expect(
      screen.getByRole("button", { name: /previous/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /pause|play/i })
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /next/i })).toBeInTheDocument();
  });

  it("shows position indicator", () => {
    render(<NavigationControls {...defaultProps} />);

    expect(screen.getByText("2 / 4")).toBeInTheDocument();
  });

  it("shows correct position with different indices", () => {
    render(
      <NavigationControls {...defaultProps} currentIndex={0} totalScreens={3} />
    );

    expect(screen.getByText("1 / 3")).toBeInTheDocument();
  });

  it("calls onPrevious when previous button is clicked", async () => {
    const user = userEvent.setup();
    const onPrevious = vi.fn();
    render(<NavigationControls {...defaultProps} onPrevious={onPrevious} />);

    await user.click(screen.getByRole("button", { name: /previous/i }));
    expect(onPrevious).toHaveBeenCalledTimes(1);
  });

  it("calls onNext when next button is clicked", async () => {
    const user = userEvent.setup();
    const onNext = vi.fn();
    render(<NavigationControls {...defaultProps} onNext={onNext} />);

    await user.click(screen.getByRole("button", { name: /next/i }));
    expect(onNext).toHaveBeenCalledTimes(1);
  });

  it("calls onTogglePause when pause button is clicked", async () => {
    const user = userEvent.setup();
    const onTogglePause = vi.fn();
    render(
      <NavigationControls {...defaultProps} onTogglePause={onTogglePause} />
    );

    await user.click(screen.getByRole("button", { name: /pause|play/i }));
    expect(onTogglePause).toHaveBeenCalledTimes(1);
  });

  it("has correct aria-labels for accessibility", () => {
    render(<NavigationControls {...defaultProps} />);

    expect(
      screen.getByRole("button", { name: /previous screen/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /next screen/i })
    ).toBeInTheDocument();
  });

  it("shows pause label when not paused", () => {
    render(<NavigationControls {...defaultProps} isPaused={false} />);

    expect(
      screen.getByRole("button", { name: /pause rotation/i })
    ).toBeInTheDocument();
  });

  it("shows play/resume label when paused", () => {
    render(<NavigationControls {...defaultProps} isPaused={true} />);

    expect(
      screen.getByRole("button", { name: /resume rotation/i })
    ).toBeInTheDocument();
  });

  it("applies hidden styles when not visible", () => {
    const { container } = render(
      <NavigationControls {...defaultProps} isVisible={false} />
    );

    const nav = container.firstChild as HTMLElement;
    expect(nav.className).toContain("opacity-0");
  });

  it("applies visible styles when visible", () => {
    const { container } = render(
      <NavigationControls {...defaultProps} isVisible={true} />
    );

    const nav = container.firstChild as HTMLElement;
    expect(nav.className).toContain("opacity-100");
  });

  it("renders navigation landmark", () => {
    render(<NavigationControls {...defaultProps} />);

    expect(
      screen.getByRole("navigation", { name: /screen rotation controls/i })
    ).toBeInTheDocument();
  });
});
