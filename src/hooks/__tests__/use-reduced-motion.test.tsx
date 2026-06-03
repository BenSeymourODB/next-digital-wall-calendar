/**
 * Tests for useReducedMotion hook.
 */
import { act, renderHook } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import {
  type MockInstance,
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { useReducedMotion } from "../use-reduced-motion";

interface MockMediaQueryList {
  matches: boolean;
  media: string;
  addEventListener: ReturnType<typeof vi.fn>;
  removeEventListener: ReturnType<typeof vi.fn>;
  addListener: ReturnType<typeof vi.fn>;
  removeListener: ReturnType<typeof vi.fn>;
  dispatchEvent: ReturnType<typeof vi.fn>;
}

function createMockMediaQueryList(matches: boolean): MockMediaQueryList {
  return {
    matches,
    media: "(prefers-reduced-motion: reduce)",
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  };
}

let originalMatchMedia: typeof window.matchMedia | undefined;

beforeEach(() => {
  originalMatchMedia = window.matchMedia;
});

afterEach(() => {
  if (originalMatchMedia) {
    window.matchMedia = originalMatchMedia;
  }
});

describe("useReducedMotion", () => {
  it("returns false when the user does not prefer reduced motion", () => {
    const mql = createMockMediaQueryList(false);
    window.matchMedia = vi.fn().mockReturnValue(mql);

    const { result } = renderHook(() => useReducedMotion());

    expect(result.current).toBe(false);
  });

  it("returns true when the user prefers reduced motion", () => {
    const mql = createMockMediaQueryList(true);
    window.matchMedia = vi.fn().mockReturnValue(mql);

    const { result } = renderHook(() => useReducedMotion());

    expect(result.current).toBe(true);
  });

  it("queries the prefers-reduced-motion media feature", () => {
    const mql = createMockMediaQueryList(false);
    const matchMediaSpy: MockInstance = vi.fn().mockReturnValue(mql);
    window.matchMedia = matchMediaSpy as unknown as typeof window.matchMedia;

    renderHook(() => useReducedMotion());

    expect(matchMediaSpy).toHaveBeenCalledWith(
      "(prefers-reduced-motion: reduce)"
    );
  });

  it("subscribes to change events on mount", () => {
    const mql = createMockMediaQueryList(false);
    window.matchMedia = vi.fn().mockReturnValue(mql);

    renderHook(() => useReducedMotion());

    expect(mql.addEventListener).toHaveBeenCalledWith(
      "change",
      expect.any(Function)
    );
  });

  it("unsubscribes on unmount", () => {
    const mql = createMockMediaQueryList(false);
    window.matchMedia = vi.fn().mockReturnValue(mql);

    const { unmount } = renderHook(() => useReducedMotion());
    const handler = mql.addEventListener.mock.calls[0][1];

    unmount();

    expect(mql.removeEventListener).toHaveBeenCalledWith("change", handler);
  });

  it("updates when the media query changes from false to true", () => {
    const mql = createMockMediaQueryList(false);
    window.matchMedia = vi.fn().mockReturnValue(mql);

    const { result } = renderHook(() => useReducedMotion());
    expect(result.current).toBe(false);

    // useSyncExternalStore re-reads getSnapshot on subscription notifications,
    // so flip the mock's matches value before firing the listener.
    const handler = mql.addEventListener.mock.calls[0][1];
    act(() => {
      mql.matches = true;
      handler({ matches: true } as MediaQueryListEvent);
    });

    expect(result.current).toBe(true);
  });

  it("updates when the media query changes from true to false", () => {
    const mql = createMockMediaQueryList(true);
    window.matchMedia = vi.fn().mockReturnValue(mql);

    const { result } = renderHook(() => useReducedMotion());
    expect(result.current).toBe(true);

    const handler = mql.addEventListener.mock.calls[0][1];
    act(() => {
      mql.matches = false;
      handler({ matches: false } as MediaQueryListEvent);
    });

    expect(result.current).toBe(false);
  });

  // Regression coverage for #306: the SSR pass and the client's first render
  // must produce the same value (`false`), regardless of what matchMedia
  // would report. Previously the function-initializer read window.matchMedia
  // synchronously on the client's first render, producing a hydration mismatch
  // whenever the user had `prefers-reduced-motion: reduce` enabled.
  it("returns false during server-render even when matchMedia reports a match", () => {
    const mql = createMockMediaQueryList(true);
    window.matchMedia = vi.fn().mockReturnValue(mql);

    function Probe() {
      return <div data-testid="value">{String(useReducedMotion())}</div>;
    }

    // renderToString triggers the useSyncExternalStore SSR path
    // (getServerSnapshot) regardless of whether `window` exists in the test
    // environment — React detects the SSR rendering context internally — so
    // running this in jsdom with a stubbed matchMedia is still a valid proof
    // that the SSR pass returns `false`.
    const html = renderToString(<Probe />);

    expect(html).toContain(">false<");
    expect(html).not.toContain(">true<");
  });

  it("transitions to the live matchMedia value after mount", () => {
    const mql = createMockMediaQueryList(true);
    window.matchMedia = vi.fn().mockReturnValue(mql);

    const { result } = renderHook(() => useReducedMotion());

    // After mount, useSyncExternalStore reads the live snapshot.
    expect(result.current).toBe(true);
  });

  // Older Android WebViews and a few JSDOM configs ship without
  // `window.matchMedia`. Both `getSnapshot` and `subscribe` guard against this
  // and degrade to `false` / no-op; this test exercises that path.
  it("returns false when window.matchMedia is unavailable on the client", () => {
    const original = window.matchMedia;
    // Simulate an environment that does not expose matchMedia.
    (
      window as unknown as { matchMedia?: typeof window.matchMedia }
    ).matchMedia = undefined;

    try {
      const { result, unmount } = renderHook(() => useReducedMotion());
      expect(result.current).toBe(false);
      // Unmounting must not throw even though subscribe never registered a
      // listener.
      expect(() => unmount()).not.toThrow();
    } finally {
      window.matchMedia = original;
    }
  });
});
