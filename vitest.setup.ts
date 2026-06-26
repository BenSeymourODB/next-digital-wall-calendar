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

// jsdom does not implement Pointer Events API (hasPointerCapture /
// releasePointerCapture / setPointerCapture) or scrollIntoView. Radix Select
// drives its open/close state from pointerdown handlers and uses
// scrollIntoView when the listbox mounts — without these stubs userEvent
// clicks throw before the listbox ever opens. Stub them at the prototype
// level so every Element instance picks them up.
//
// Guarded so that tests opting into `@vitest-environment node` (where
// `Element` is undefined) can still share this setup file without crashing.
type ElementWithPointerCapture = Element & {
  hasPointerCapture(pointerId: number): boolean;
  releasePointerCapture(pointerId: number): void;
  setPointerCapture(pointerId: number): void;
  scrollIntoView(arg?: boolean | ScrollIntoViewOptions): void;
};
if (typeof Element !== "undefined") {
  const elProto = Element.prototype as ElementWithPointerCapture;
  if (typeof elProto.hasPointerCapture !== "function") {
    elProto.hasPointerCapture = () => false;
  }
  if (typeof elProto.releasePointerCapture !== "function") {
    elProto.releasePointerCapture = () => {};
  }
  if (typeof elProto.setPointerCapture !== "function") {
    elProto.setPointerCapture = () => {};
  }
  if (typeof elProto.scrollIntoView !== "function") {
    elProto.scrollIntoView = () => {};
  }
}

// Cleanup after each test to prevent memory leaks
afterEach(() => {
  cleanup();
});
