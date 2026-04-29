import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

// jsdom does not implement ResizeObserver, which some Radix primitives rely on
// (e.g. measuring content sized with `field-sizing-content`). Stub it with a
// no-op so component tests that render those primitives can mount cleanly.
if (typeof globalThis.ResizeObserver === "undefined") {
  class ResizeObserverStub {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  globalThis.ResizeObserver =
    ResizeObserverStub as unknown as typeof ResizeObserver;
}

// Cleanup after each test to prevent memory leaks
afterEach(() => {
  cleanup();
});
