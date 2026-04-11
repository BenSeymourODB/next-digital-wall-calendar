/**
 * Tests for ScreenTransition component
 *
 * Tests transition phases, animation types, direction handling,
 * reduced motion, and disabled transitions.
 */
import type { TransitionConfig } from "@/components/scheduler/types";
import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ScreenTransition } from "../screen-transition";

// Mock matchMedia for jsdom environment
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

const slideConfig: TransitionConfig = { type: "slide", durationMs: 400 };
const fadeConfig: TransitionConfig = { type: "fade", durationMs: 300 };
const slideFadeConfig: TransitionConfig = {
  type: "slide-fade",
  durationMs: 500,
};
const noneConfig: TransitionConfig = { type: "none", durationMs: 0 };

describe("ScreenTransition", () => {
  describe("idle state", () => {
    it("renders children in idle state on initial render", () => {
      render(
        <ScreenTransition
          pathname="/page-a"
          direction="forward"
          transition={slideConfig}
        >
          <div data-testid="content">Page A</div>
        </ScreenTransition>
      );

      expect(screen.getByTestId("content")).toBeInTheDocument();
      expect(screen.getByTestId("transition-idle")).toBeInTheDocument();
    });

    it("wraps children in a container with data-testid", () => {
      render(
        <ScreenTransition
          pathname="/page-a"
          direction="forward"
          transition={slideConfig}
        >
          <div>Content</div>
        </ScreenTransition>
      );

      expect(screen.getByTestId("screen-transition")).toBeInTheDocument();
    });
  });

  describe("transition type: none", () => {
    it("renders children directly without animation wrapper", () => {
      render(
        <ScreenTransition
          pathname="/page-a"
          direction="forward"
          transition={noneConfig}
        >
          <div data-testid="content">Page A</div>
        </ScreenTransition>
      );

      expect(screen.getByTestId("content")).toBeInTheDocument();
      expect(
        screen.queryByTestId("transition-outgoing")
      ).not.toBeInTheDocument();
    });

    it("swaps children instantly on pathname change", () => {
      const { rerender } = render(
        <ScreenTransition
          pathname="/page-a"
          direction="forward"
          transition={noneConfig}
        >
          <div data-testid="page-a">Page A</div>
        </ScreenTransition>
      );

      rerender(
        <ScreenTransition
          pathname="/page-b"
          direction="forward"
          transition={noneConfig}
        >
          <div data-testid="page-b">Page B</div>
        </ScreenTransition>
      );

      expect(screen.getByTestId("page-b")).toBeInTheDocument();
      expect(screen.queryByTestId("page-a")).not.toBeInTheDocument();
    });
  });

  describe("transition lifecycle", () => {
    it("enters exiting phase on pathname change", () => {
      const { rerender } = render(
        <ScreenTransition
          pathname="/page-a"
          direction="forward"
          transition={slideConfig}
        >
          <div>Page A</div>
        </ScreenTransition>
      );

      rerender(
        <ScreenTransition
          pathname="/page-b"
          direction="forward"
          transition={slideConfig}
        >
          <div>Page B</div>
        </ScreenTransition>
      );

      expect(screen.getByTestId("transition-outgoing")).toBeInTheDocument();
      expect(screen.getByTestId("transition-incoming")).toBeInTheDocument();
    });

    it("transitions to entering phase after exit duration", () => {
      const { rerender } = render(
        <ScreenTransition
          pathname="/page-a"
          direction="forward"
          transition={slideConfig}
        >
          <div>Page A</div>
        </ScreenTransition>
      );

      rerender(
        <ScreenTransition
          pathname="/page-b"
          direction="forward"
          transition={slideConfig}
        >
          <div>Page B</div>
        </ScreenTransition>
      );

      act(() => {
        vi.advanceTimersByTime(slideConfig.durationMs);
      });

      expect(
        screen.queryByTestId("transition-outgoing")
      ).not.toBeInTheDocument();
      expect(screen.getByTestId("transition-entering")).toBeInTheDocument();
    });

    it("returns to idle state after full transition", () => {
      const { rerender } = render(
        <ScreenTransition
          pathname="/page-a"
          direction="forward"
          transition={slideConfig}
        >
          <div>Page A</div>
        </ScreenTransition>
      );

      rerender(
        <ScreenTransition
          pathname="/page-b"
          direction="forward"
          transition={slideConfig}
        >
          <div>Page B</div>
        </ScreenTransition>
      );

      // Advance through exit phase
      act(() => {
        vi.advanceTimersByTime(slideConfig.durationMs);
      });

      // Advance through enter phase
      act(() => {
        vi.advanceTimersByTime(slideConfig.durationMs);
      });

      expect(screen.getByTestId("transition-idle")).toBeInTheDocument();
    });
  });

  describe("slide transitions", () => {
    it("applies translateX(-100%) for forward exit", () => {
      const { rerender } = render(
        <ScreenTransition
          pathname="/page-a"
          direction="forward"
          transition={slideConfig}
        >
          <div>Page A</div>
        </ScreenTransition>
      );

      rerender(
        <ScreenTransition
          pathname="/page-b"
          direction="forward"
          transition={slideConfig}
        >
          <div>Page B</div>
        </ScreenTransition>
      );

      const outgoing = screen.getByTestId("transition-outgoing");
      expect(outgoing.style.transform).toBe("translateX(-100%)");
    });

    it("applies translateX(100%) for backward exit", () => {
      const { rerender } = render(
        <ScreenTransition
          pathname="/page-a"
          direction="backward"
          transition={slideConfig}
        >
          <div>Page A</div>
        </ScreenTransition>
      );

      rerender(
        <ScreenTransition
          pathname="/page-b"
          direction="backward"
          transition={slideConfig}
        >
          <div>Page B</div>
        </ScreenTransition>
      );

      const outgoing = screen.getByTestId("transition-outgoing");
      expect(outgoing.style.transform).toBe("translateX(100%)");
    });

    it("keeps opacity at 1 for slide-only transitions", () => {
      const { rerender } = render(
        <ScreenTransition
          pathname="/page-a"
          direction="forward"
          transition={slideConfig}
        >
          <div>Page A</div>
        </ScreenTransition>
      );

      rerender(
        <ScreenTransition
          pathname="/page-b"
          direction="forward"
          transition={slideConfig}
        >
          <div>Page B</div>
        </ScreenTransition>
      );

      const outgoing = screen.getByTestId("transition-outgoing");
      expect(outgoing.style.opacity).toBe("1");
    });
  });

  describe("fade transitions", () => {
    it("applies opacity 0 for fade exit", () => {
      const { rerender } = render(
        <ScreenTransition
          pathname="/page-a"
          direction="forward"
          transition={fadeConfig}
        >
          <div>Page A</div>
        </ScreenTransition>
      );

      rerender(
        <ScreenTransition
          pathname="/page-b"
          direction="forward"
          transition={fadeConfig}
        >
          <div>Page B</div>
        </ScreenTransition>
      );

      const outgoing = screen.getByTestId("transition-outgoing");
      expect(outgoing.style.opacity).toBe("0");
    });

    it("does not apply translateX for fade exit", () => {
      const { rerender } = render(
        <ScreenTransition
          pathname="/page-a"
          direction="forward"
          transition={fadeConfig}
        >
          <div>Page A</div>
        </ScreenTransition>
      );

      rerender(
        <ScreenTransition
          pathname="/page-b"
          direction="forward"
          transition={fadeConfig}
        >
          <div>Page B</div>
        </ScreenTransition>
      );

      const outgoing = screen.getByTestId("transition-outgoing");
      expect(outgoing.style.transform).toBe("translateX(0)");
    });
  });

  describe("slide-fade transitions", () => {
    it("applies both translateX and opacity 0 for exit", () => {
      const { rerender } = render(
        <ScreenTransition
          pathname="/page-a"
          direction="forward"
          transition={slideFadeConfig}
        >
          <div>Page A</div>
        </ScreenTransition>
      );

      rerender(
        <ScreenTransition
          pathname="/page-b"
          direction="forward"
          transition={slideFadeConfig}
        >
          <div>Page B</div>
        </ScreenTransition>
      );

      const outgoing = screen.getByTestId("transition-outgoing");
      expect(outgoing.style.transform).toBe("translateX(-100%)");
      expect(outgoing.style.opacity).toBe("0");
    });
  });

  describe("prefers-reduced-motion", () => {
    it("skips animation when prefers-reduced-motion is set", () => {
      // Override matchMedia to report reduced motion
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
        <ScreenTransition
          pathname="/page-a"
          direction="forward"
          transition={slideConfig}
        >
          <div data-testid="page-a">Page A</div>
        </ScreenTransition>
      );

      rerender(
        <ScreenTransition
          pathname="/page-b"
          direction="forward"
          transition={slideConfig}
        >
          <div data-testid="page-b">Page B</div>
        </ScreenTransition>
      );

      // Should skip directly to new content without animation phases
      expect(
        screen.queryByTestId("transition-outgoing")
      ).not.toBeInTheDocument();
      expect(screen.getByTestId("page-b")).toBeInTheDocument();
    });
  });

  describe("same pathname re-render", () => {
    it("updates children in place without triggering transition", () => {
      const { rerender } = render(
        <ScreenTransition
          pathname="/page-a"
          direction="forward"
          transition={slideConfig}
        >
          <div data-testid="version-1">Version 1</div>
        </ScreenTransition>
      );

      rerender(
        <ScreenTransition
          pathname="/page-a"
          direction="forward"
          transition={slideConfig}
        >
          <div data-testid="version-2">Version 2</div>
        </ScreenTransition>
      );

      expect(screen.getByTestId("version-2")).toBeInTheDocument();
      expect(screen.getByTestId("transition-idle")).toBeInTheDocument();
      expect(
        screen.queryByTestId("transition-outgoing")
      ).not.toBeInTheDocument();
    });
  });

  describe("duration", () => {
    it("uses configured duration for transition timing", () => {
      const customConfig: TransitionConfig = {
        type: "slide",
        durationMs: 200,
      };

      const { rerender } = render(
        <ScreenTransition
          pathname="/page-a"
          direction="forward"
          transition={customConfig}
        >
          <div>Page A</div>
        </ScreenTransition>
      );

      rerender(
        <ScreenTransition
          pathname="/page-b"
          direction="forward"
          transition={customConfig}
        >
          <div>Page B</div>
        </ScreenTransition>
      );

      // Still in exiting phase before duration
      expect(screen.getByTestId("transition-outgoing")).toBeInTheDocument();

      act(() => {
        vi.advanceTimersByTime(200);
      });

      // Now in entering phase
      expect(screen.getByTestId("transition-entering")).toBeInTheDocument();
    });

    it("treats zero duration as no animation", () => {
      const zeroDuration: TransitionConfig = {
        type: "slide",
        durationMs: 0,
      };

      const { rerender } = render(
        <ScreenTransition
          pathname="/page-a"
          direction="forward"
          transition={zeroDuration}
        >
          <div data-testid="page-a">Page A</div>
        </ScreenTransition>
      );

      rerender(
        <ScreenTransition
          pathname="/page-b"
          direction="forward"
          transition={zeroDuration}
        >
          <div data-testid="page-b">Page B</div>
        </ScreenTransition>
      );

      expect(screen.getByTestId("page-b")).toBeInTheDocument();
      expect(
        screen.queryByTestId("transition-outgoing")
      ).not.toBeInTheDocument();
    });
  });
});
