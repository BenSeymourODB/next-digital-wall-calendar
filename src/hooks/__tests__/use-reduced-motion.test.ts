/**
 * Tests for useReducedMotion hook.
 */
import { act, renderHook } from "@testing-library/react";
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

    const handler = mql.addEventListener.mock.calls[0][1];
    act(() => {
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
      handler({ matches: false } as MediaQueryListEvent);
    });

    expect(result.current).toBe(false);
  });
});
