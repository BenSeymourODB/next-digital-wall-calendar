/**
 * Tests for AnimatedSwap component.
 *
 * Covers transition lifecycle, fade vs slide modes, directional slides,
 * reduced-motion bypass, zero-duration bypass, layout preservation,
 * timer behavior under rapid swaps, and same-key re-render.
 */
import { act, render, screen } from "@testing-library/react";
import { hydrateRoot } from "react-dom/client";
import { renderToString } from "react-dom/server";
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

  describe("animating phase", () => {
    it("renders both outgoing snapshot and incoming child while animating", () => {
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
      expect(
        screen.queryByTestId("animated-swap-idle")
      ).not.toBeInTheDocument();
    });

    it("returns to idle after duration, dropping the outgoing snapshot", () => {
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
      expect(screen.getByTestId("animated-swap-idle")).toBeInTheDocument();
    });

    it("keeps the incoming child in normal flow so the container preserves its height", () => {
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

      const incoming = screen.getByTestId("animated-swap-incoming");
      const outgoing = screen.getByTestId("animated-swap-outgoing");
      // Outgoing is absolute (does not contribute to layout); incoming is in-flow.
      expect(outgoing.className).toContain("absolute");
      expect(incoming.className).not.toContain("absolute");
    });
  });

  describe("fade transitions", () => {
    it("targets opacity 0 on the outgoing element with no horizontal translation", () => {
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

    it("animates the incoming child via a keyframe (so it doesn't snap to position)", () => {
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

      const incoming = screen.getByTestId("animated-swap-incoming");
      expect(incoming.style.animation).toMatch(/animated-swap-enter-/);
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

  describe("rapid swaps", () => {
    it("resets the timer on every swap so a second mid-flight swap completes the full new duration", () => {
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

      // Advance halfway through the first transition.
      act(() => {
        vi.advanceTimersByTime(150);
      });
      expect(screen.getByTestId("animated-swap-outgoing")).toBeInTheDocument();

      // Trigger a second swap mid-flight.
      rerender(
        <AnimatedSwap
          swapKey="c"
          type="fade"
          direction="forward"
          durationMs={300}
        >
          <div data-testid="c">C</div>
        </AnimatedSwap>
      );

      // Advance through the remaining half of the original duration.
      act(() => {
        vi.advanceTimersByTime(150);
      });
      // First timer must have been cleared; we should still be animating.
      expect(screen.getByTestId("animated-swap-outgoing")).toBeInTheDocument();

      // Advance the rest of the new duration.
      act(() => {
        vi.advanceTimersByTime(150);
      });
      expect(
        screen.queryByTestId("animated-swap-outgoing")
      ).not.toBeInTheDocument();
      expect(screen.getByTestId("c")).toBeInTheDocument();
    });
  });

  describe("reduced motion mid-animation", () => {
    it("collapses to idle and clears pending timers when reduced-motion turns on mid-animation", () => {
      // First mount with reduced-motion off. useSyncExternalStore re-reads
      // the live snapshot when notified, so the mock must be a shared object
      // whose `matches` field flips before the listener fires.
      let mqlListeners: ((e: MediaQueryListEvent) => void)[] = [];
      const sharedMql = {
        matches: false,
        media: "(prefers-reduced-motion: reduce)",
        addEventListener: (
          _evt: string,
          handler: (e: MediaQueryListEvent) => void
        ) => {
          mqlListeners.push(handler);
        },
        removeEventListener: (
          _evt: string,
          handler: (e: MediaQueryListEvent) => void
        ) => {
          mqlListeners = mqlListeners.filter((h) => h !== handler);
        },
        addListener: vi.fn(),
        removeListener: vi.fn(),
        dispatchEvent: vi.fn(),
      };
      window.matchMedia = vi
        .fn()
        .mockImplementation(
          () => sharedMql
        ) as unknown as typeof window.matchMedia;

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
          <div data-testid="b">B</div>
        </AnimatedSwap>
      );

      expect(screen.getByTestId("animated-swap-outgoing")).toBeInTheDocument();

      // OS-level reduced motion turns on; the live snapshot must reflect the
      // new value before the listener fires so React picks it up.
      act(() => {
        sharedMql.matches = true;
        mqlListeners.forEach((h) =>
          h({ matches: true } as MediaQueryListEvent)
        );
      });

      expect(
        screen.queryByTestId("animated-swap-outgoing")
      ).not.toBeInTheDocument();
      expect(screen.getByTestId("b")).toBeInTheDocument();
    });
  });

  // Regression coverage for #306. Before the useReducedMotion fix, the SSR
  // pass and the client's first render produced structurally different trees
  // when the user had `prefers-reduced-motion: reduce` set, which surfaced as
  // a hydration warning anchored at SimpleCalendar.
  describe("hydration with prefers-reduced-motion (regression for #306)", () => {
    it("server renders the idle wrapper so the client's first render matches", () => {
      window.matchMedia = vi.fn().mockImplementation((query: string) => ({
        matches: query === "(prefers-reduced-motion: reduce)",
        media: query,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        addListener: vi.fn(),
        removeListener: vi.fn(),
        dispatchEvent: vi.fn(),
      }));

      const ssrHtml = renderToString(
        <AnimatedSwap
          swapKey="a"
          type="fade"
          direction="forward"
          durationMs={300}
        >
          <div data-testid="content">A</div>
        </AnimatedSwap>
      );

      // The SSR pass must show the idle wrapper, not the skip-animation
      // shortcut. Otherwise the client (which initializes useReducedMotion to
      // false to match SSR) would diverge on hydration.
      expect(ssrHtml).toContain("animated-swap-idle");
    });

    it("hydrates without React hydration warnings", () => {
      // Exercises the real React hydration path under prefers-reduced-motion.
      // Use real timers so hydrateRoot's internal Scheduler can flush without
      // fake-timer interference.
      vi.useRealTimers();

      window.matchMedia = vi.fn().mockImplementation((query: string) => ({
        matches: query === "(prefers-reduced-motion: reduce)",
        media: query,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        addListener: vi.fn(),
        removeListener: vi.fn(),
        dispatchEvent: vi.fn(),
      }));

      const tree = (
        <AnimatedSwap
          swapKey="a"
          type="fade"
          direction="forward"
          durationMs={300}
        >
          <div data-testid="content">A</div>
        </AnimatedSwap>
      );

      const ssrHtml = renderToString(tree);
      const container = document.createElement("div");
      container.innerHTML = ssrHtml;
      document.body.appendChild(container);

      const errorSpy = vi
        .spyOn(console, "error")
        .mockImplementation(() => undefined);

      let root: ReturnType<typeof hydrateRoot> | null = null;
      act(() => {
        root = hydrateRoot(container, tree);
      });

      // React 19 sometimes passes Error objects (not just strings) to
      // console.error, so coerce every arg before pattern-matching.
      const hydrationErrors = errorSpy.mock.calls.filter((call) =>
        call.some((arg) => /hydrat/i.test(String(arg)))
      );

      expect(hydrationErrors).toEqual([]);

      act(() => {
        root?.unmount();
      });
      errorSpy.mockRestore();
      document.body.removeChild(container);
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
