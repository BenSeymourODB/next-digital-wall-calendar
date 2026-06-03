/**
 * Tests for ScreenTransition component (#368 — AnimatedSwap-style refactor).
 *
 * Covers: idle state, single-stage animating phase (no more "entering" phase),
 * slide/fade/slide-fade/none transition types, forward/backward direction,
 * reduced-motion bypass, zero-duration bypass, layout preservation,
 * timer behaviour under rapid swaps, same-pathname re-render, mid-animation
 * reduced-motion toggle, and SSR hydration.
 */
import type { TransitionConfig } from "@/components/scheduler/types";
import { act, render, screen } from "@testing-library/react";
import { hydrateRoot } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ScreenTransition } from "../screen-transition";

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
    it("renders the child in idle state on initial mount", () => {
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

    it("does not pin the root wrapper to 100vh", () => {
      render(
        <ScreenTransition
          pathname="/page-a"
          direction="forward"
          transition={slideConfig}
        >
          <div>Content</div>
        </ScreenTransition>
      );

      const root = screen.getByTestId("screen-transition");
      // Previously this was `minHeight: 100vh`. The new layout lets the
      // incoming child dictate height (mirrors AnimatedSwap).
      expect(root.style.minHeight).toBe("");
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

  describe("animating phase", () => {
    it("renders both outgoing snapshot and incoming child during animation", () => {
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
      expect(screen.queryByTestId("transition-idle")).not.toBeInTheDocument();
    });

    it("returns to idle after a single durationMs (not 2x)", () => {
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

      // After a single durationMs the snapshot is dropped and we're back to
      // idle. The legacy implementation required 2 * durationMs.
      act(() => {
        vi.advanceTimersByTime(slideConfig.durationMs);
      });

      expect(
        screen.queryByTestId("transition-outgoing")
      ).not.toBeInTheDocument();
      expect(screen.getByTestId("transition-idle")).toBeInTheDocument();
    });

    it("keeps incoming in normal flow and outgoing absolutely positioned", () => {
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
      const incoming = screen.getByTestId("transition-incoming");
      // Outgoing is removed from flow so the container's height comes from
      // the incoming child.
      expect(outgoing.className).toContain("absolute");
      expect(incoming.className).not.toContain("absolute");
    });
  });

  describe("slide transitions", () => {
    it("translates outgoing left for forward direction", () => {
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
      expect(outgoing.style.opacity).toBe("1");
    });

    it("translates outgoing right for backward direction", () => {
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

    it("animates the incoming child via a keyframe", () => {
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

      const incoming = screen.getByTestId("transition-incoming");
      expect(incoming.style.animation).toMatch(/screen-transition-enter-/);
    });
  });

  describe("fade transitions", () => {
    it("targets opacity 0 on the outgoing element with no translation", () => {
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
      expect(outgoing.style.transform).toBe("translateX(0)");
    });
  });

  describe("slide-fade transitions", () => {
    it("applies both translateX and opacity 0 on the outgoing element", () => {
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

    it("translates outgoing right and fades for backward direction", () => {
      const { rerender } = render(
        <ScreenTransition
          pathname="/page-a"
          direction="backward"
          transition={slideFadeConfig}
        >
          <div>Page A</div>
        </ScreenTransition>
      );

      rerender(
        <ScreenTransition
          pathname="/page-b"
          direction="backward"
          transition={slideFadeConfig}
        >
          <div>Page B</div>
        </ScreenTransition>
      );

      const outgoing = screen.getByTestId("transition-outgoing");
      expect(outgoing.style.transform).toBe("translateX(100%)");
      expect(outgoing.style.opacity).toBe("0");
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

      expect(
        screen.queryByTestId("transition-outgoing")
      ).not.toBeInTheDocument();
      expect(screen.getByTestId("page-b")).toBeInTheDocument();
    });
  });

  describe("zero duration bypass", () => {
    it("swaps instantly when durationMs is 0", () => {
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

  describe("rapid swaps", () => {
    it("resets the timer on every swap so a second mid-flight swap completes the full new duration", () => {
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

      // Halfway through the first transition.
      act(() => {
        vi.advanceTimersByTime(150);
      });
      expect(screen.getByTestId("transition-outgoing")).toBeInTheDocument();

      // Second swap arrives mid-flight.
      rerender(
        <ScreenTransition
          pathname="/page-c"
          direction="forward"
          transition={fadeConfig}
        >
          <div data-testid="page-c">Page C</div>
        </ScreenTransition>
      );

      // Advance through the remaining half of the original duration. The
      // first timer was cleared so we should still be animating.
      act(() => {
        vi.advanceTimersByTime(150);
      });
      expect(screen.getByTestId("transition-outgoing")).toBeInTheDocument();

      // Advance the rest of the new duration.
      act(() => {
        vi.advanceTimersByTime(150);
      });
      expect(
        screen.queryByTestId("transition-outgoing")
      ).not.toBeInTheDocument();
      expect(screen.getByTestId("page-c")).toBeInTheDocument();
    });
  });

  describe("reduced motion mid-animation", () => {
    it("collapses to idle and clears pending timers when reduced-motion turns on mid-animation", () => {
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
          <div data-testid="page-b">Page B</div>
        </ScreenTransition>
      );

      expect(screen.getByTestId("transition-outgoing")).toBeInTheDocument();

      act(() => {
        sharedMql.matches = true;
        mqlListeners.forEach((h) =>
          h({ matches: true } as MediaQueryListEvent)
        );
      });

      expect(
        screen.queryByTestId("transition-outgoing")
      ).not.toBeInTheDocument();
      expect(screen.getByTestId("page-b")).toBeInTheDocument();
    });
  });

  describe("hydration with prefers-reduced-motion", () => {
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
        <ScreenTransition
          pathname="/page-a"
          direction="forward"
          transition={fadeConfig}
        >
          <div data-testid="content">A</div>
        </ScreenTransition>
      );

      // SSR pass shows the idle wrapper so the client's first render
      // (useReducedMotion initial value is false to match SSR) doesn't diverge.
      expect(ssrHtml).toContain("transition-idle");
    });

    it("hydrates without React hydration warnings", () => {
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
        <ScreenTransition
          pathname="/page-a"
          direction="forward"
          transition={fadeConfig}
        >
          <div data-testid="content">A</div>
        </ScreenTransition>
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

  describe("same pathname re-render", () => {
    it("updates children in place without triggering a transition", () => {
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

      // Still animating before duration elapses
      expect(screen.getByTestId("transition-outgoing")).toBeInTheDocument();

      act(() => {
        vi.advanceTimersByTime(200);
      });

      // Now idle
      expect(screen.getByTestId("transition-idle")).toBeInTheDocument();
    });
  });
});
