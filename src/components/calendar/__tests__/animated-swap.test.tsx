/**
 * Tests for AnimatedSwap component.
 *
 * Covers transition lifecycle (idle → exiting → entering → idle),
 * fade vs slide animation modes, directional slides, reduced-motion
 * bypass, and zero-duration bypass. Mirrors the test style used by
 * src/components/scheduler/__tests__/screen-transition.test.tsx.
 */
import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AnimatedSwap } from "../animated-swap";

const mockMatchMedia = vi.fn().mockImplementation((query: string) => ({
  matches: false,
  media: query,
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
  addListener: vi.fn(),
  removeListener: vi.fn(),
  dispatchEvent: vi.fn(),
}));

beforeEach(() => {
  vi.useFakeTimers();
  window.matchMedia = mockMatchMedia;
});

afterEach(() => {
  vi.useRealTimers();
  mockMatchMedia.mockClear();
});

describe("AnimatedSwap", () => {
  describe("idle state", () => {
    it("renders the child in idle state on initial mount", () => {
      render(
        <AnimatedSwap
          swapKey="a"
          type="fade"
          direction="forward"
          durationMs={300}
        >
          <div data-testid="content-a">Content A</div>
        </AnimatedSwap>
      );

      expect(screen.getByTestId("content-a")).toBeInTheDocument();
      expect(screen.getByTestId("animated-swap-idle")).toBeInTheDocument();
    });

    it("wraps the child in a container with data-testid", () => {
      render(
        <AnimatedSwap
          swapKey="a"
          type="fade"
          direction="forward"
          durationMs={300}
        >
          <div>Content</div>
        </AnimatedSwap>
      );

      expect(screen.getByTestId("animated-swap")).toBeInTheDocument();
    });
  });

  describe("transition lifecycle", () => {
    it("enters exiting phase when swapKey changes", () => {
      const { rerender } = render(
        <AnimatedSwap
          swapKey="a"
          type="fade"
          direction="forward"
          durationMs={300}
        >
          <div>A</div>
        </AnimatedSwap>
      );

      rerender(
        <AnimatedSwap
          swapKey="b"
          type="fade"
          direction="forward"
          durationMs={300}
        >
          <div>B</div>
        </AnimatedSwap>
      );

      expect(screen.getByTestId("animated-swap-outgoing")).toBeInTheDocument();
      expect(screen.getByTestId("animated-swap-incoming")).toBeInTheDocument();
    });

    it("transitions from exiting to entering after duration", () => {
      const { rerender } = render(
        <AnimatedSwap
          swapKey="a"
          type="fade"
          direction="forward"
          durationMs={300}
        >
          <div>A</div>
        </AnimatedSwap>
      );

      rerender(
        <AnimatedSwap
          swapKey="b"
          type="fade"
          direction="forward"
          durationMs={300}
        >
          <div>B</div>
        </AnimatedSwap>
      );

      act(() => {
        vi.advanceTimersByTime(300);
      });

      expect(
        screen.queryByTestId("animated-swap-outgoing")
      ).not.toBeInTheDocument();
      expect(screen.getByTestId("animated-swap-entering")).toBeInTheDocument();
    });

    it("returns to idle state after full transition", () => {
      const { rerender } = render(
        <AnimatedSwap
          swapKey="a"
          type="fade"
          direction="forward"
          durationMs={300}
        >
          <div>A</div>
        </AnimatedSwap>
      );

      rerender(
        <AnimatedSwap
          swapKey="b"
          type="fade"
          direction="forward"
          durationMs={300}
        >
          <div>B</div>
        </AnimatedSwap>
      );

      // Exit phase
      act(() => {
        vi.advanceTimersByTime(300);
      });
      // Enter phase
      act(() => {
        vi.advanceTimersByTime(300);
      });

      expect(screen.getByTestId("animated-swap-idle")).toBeInTheDocument();
    });
  });

  describe("fade transitions", () => {
    it("animates outgoing opacity to 0 with no horizontal translation", () => {
      const { rerender } = render(
        <AnimatedSwap
          swapKey="a"
          type="fade"
          direction="forward"
          durationMs={300}
        >
          <div>A</div>
        </AnimatedSwap>
      );

      rerender(
        <AnimatedSwap
          swapKey="b"
          type="fade"
          direction="forward"
          durationMs={300}
        >
          <div>B</div>
        </AnimatedSwap>
      );

      const outgoing = screen.getByTestId("animated-swap-outgoing");
      expect(outgoing.style.opacity).toBe("0");
      expect(outgoing.style.transform).toBe("translateX(0)");
    });
  });

  describe("slide transitions", () => {
    it("translates outgoing left for forward direction", () => {
      const { rerender } = render(
        <AnimatedSwap
          swapKey="a"
          type="slide"
          direction="forward"
          durationMs={300}
        >
          <div>A</div>
        </AnimatedSwap>
      );

      rerender(
        <AnimatedSwap
          swapKey="b"
          type="slide"
          direction="forward"
          durationMs={300}
        >
          <div>B</div>
        </AnimatedSwap>
      );

      const outgoing = screen.getByTestId("animated-swap-outgoing");
      expect(outgoing.style.transform).toBe("translateX(-100%)");
      expect(outgoing.style.opacity).toBe("1");
    });

    it("translates outgoing right for backward direction", () => {
      const { rerender } = render(
        <AnimatedSwap
          swapKey="a"
          type="slide"
          direction="backward"
          durationMs={300}
        >
          <div>A</div>
        </AnimatedSwap>
      );

      rerender(
        <AnimatedSwap
          swapKey="b"
          type="slide"
          direction="backward"
          durationMs={300}
        >
          <div>B</div>
        </AnimatedSwap>
      );

      const outgoing = screen.getByTestId("animated-swap-outgoing");
      expect(outgoing.style.transform).toBe("translateX(100%)");
    });
  });

  describe("reduced motion", () => {
    it("skips animation and swaps instantly when prefers-reduced-motion is set", () => {
      window.matchMedia = vi.fn().mockImplementation((query: string) => ({
        matches: query === "(prefers-reduced-motion: reduce)",
        media: query,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        addListener: vi.fn(),
        removeListener: vi.fn(),
        dispatchEvent: vi.fn(),
      }));

      const { rerender } = render(
        <AnimatedSwap
          swapKey="a"
          type="slide"
          direction="forward"
          durationMs={300}
        >
          <div data-testid="a">A</div>
        </AnimatedSwap>
      );

      rerender(
        <AnimatedSwap
          swapKey="b"
          type="slide"
          direction="forward"
          durationMs={300}
        >
          <div data-testid="b">B</div>
        </AnimatedSwap>
      );

      expect(
        screen.queryByTestId("animated-swap-outgoing")
      ).not.toBeInTheDocument();
      expect(screen.getByTestId("b")).toBeInTheDocument();
    });
  });

  describe("zero duration bypass", () => {
    it("swaps instantly when durationMs is 0", () => {
      const { rerender } = render(
        <AnimatedSwap
          swapKey="a"
          type="slide"
          direction="forward"
          durationMs={0}
        >
          <div data-testid="a">A</div>
        </AnimatedSwap>
      );

      rerender(
        <AnimatedSwap
          swapKey="b"
          type="slide"
          direction="forward"
          durationMs={0}
        >
          <div data-testid="b">B</div>
        </AnimatedSwap>
      );

      expect(screen.getByTestId("b")).toBeInTheDocument();
      expect(
        screen.queryByTestId("animated-swap-outgoing")
      ).not.toBeInTheDocument();
    });
  });

  describe("same swapKey", () => {
    it("re-renders children in place without triggering a transition", () => {
      const { rerender } = render(
        <AnimatedSwap
          swapKey="a"
          type="fade"
          direction="forward"
          durationMs={300}
        >
          <div data-testid="v1">V1</div>
        </AnimatedSwap>
      );

      rerender(
        <AnimatedSwap
          swapKey="a"
          type="fade"
          direction="forward"
          durationMs={300}
        >
          <div data-testid="v2">V2</div>
        </AnimatedSwap>
      );

      expect(screen.getByTestId("v2")).toBeInTheDocument();
      expect(screen.getByTestId("animated-swap-idle")).toBeInTheDocument();
      expect(
        screen.queryByTestId("animated-swap-outgoing")
      ).not.toBeInTheDocument();
    });
  });
});
