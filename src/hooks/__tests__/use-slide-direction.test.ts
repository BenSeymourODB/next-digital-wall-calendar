import { renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { useSlideDirection } from "../use-slide-direction";

describe("useSlideDirection", () => {
  it("returns 'forward' on the first render regardless of seed index", () => {
    const { result: a } = renderHook(({ index }) => useSlideDirection(index), {
      initialProps: { index: 0 },
    });
    expect(a.current).toBe("forward");

    const { result: b } = renderHook(({ index }) => useSlideDirection(index), {
      initialProps: { index: 1_000 },
    });
    expect(b.current).toBe("forward");

    const { result: c } = renderHook(({ index }) => useSlideDirection(index), {
      initialProps: { index: -42 },
    });
    expect(c.current).toBe("forward");
  });

  it("returns 'forward' when the index increases", () => {
    const { result, rerender } = renderHook(
      ({ index }) => useSlideDirection(index),
      { initialProps: { index: 5 } }
    );
    rerender({ index: 6 });
    expect(result.current).toBe("forward");
    rerender({ index: 50 });
    expect(result.current).toBe("forward");
  });

  it("returns 'backward' when the index decreases", () => {
    const { result, rerender } = renderHook(
      ({ index }) => useSlideDirection(index),
      { initialProps: { index: 10 } }
    );
    rerender({ index: 9 });
    expect(result.current).toBe("backward");
    rerender({ index: -3 });
    expect(result.current).toBe("backward");
  });

  it("retains the previous direction when the index is unchanged", () => {
    const { result, rerender } = renderHook(
      ({ index }) => useSlideDirection(index),
      { initialProps: { index: 0 } }
    );
    rerender({ index: 1 }); // forward
    expect(result.current).toBe("forward");
    rerender({ index: 1 }); // unchanged — still forward
    expect(result.current).toBe("forward");

    rerender({ index: 0 }); // backward
    expect(result.current).toBe("backward");
    rerender({ index: 0 }); // unchanged — still backward
    expect(result.current).toBe("backward");
  });

  it("settles on the right direction across an alternating sequence", () => {
    const sequence: Array<{
      to: number;
      expected: "forward" | "backward";
    }> = [
      { to: 1, expected: "forward" },
      { to: 1, expected: "forward" }, // unchanged
      { to: 0, expected: "backward" },
      { to: 5, expected: "forward" },
      { to: 5, expected: "forward" }, // unchanged
      { to: 4, expected: "backward" },
    ];

    const { result, rerender } = renderHook(
      ({ index }) => useSlideDirection(index),
      { initialProps: { index: 0 } }
    );

    for (const step of sequence) {
      rerender({ index: step.to });
      expect(result.current).toBe(step.expected);
    }
  });
});
