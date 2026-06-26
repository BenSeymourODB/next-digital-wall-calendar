import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type * as ClientSdk from "../appinsights-client";

// Mock both telemetry SDKs so `logger`'s dynamic `import("./appinsights-*")`
// resolves to a spied shim. The lambda wrappers below assert against the SDK
// signature via `Parameters<typeof ClientSdk.X>`, so a future signature
// change immediately breaks `pnpm check-types` here instead of slipping
// through as untyped drift.
const trackTrace = vi.fn();
const trackException = vi.fn();
const trackEvent = vi.fn();

// The logger uses bare relative dynamic imports (`import("./appinsights-*")`),
// so the mock specifier must match — vi.mock keys aren't normalized across
// alias vs relative forms in dynamic-import resolution.
//
// The lambda wrappers (rather than a direct `{ trackTrace }` reference) are
// load-bearing: `vi.mock` factories are hoisted to the top of the file, so a
// direct reference would read `undefined` from the temporal dead zone of
// `const trackTrace = ...`. Looking the spy up at call time defers the read
// until after module initialization.
vi.mock("../appinsights-client", () => ({
  trackTrace: (...args: Parameters<typeof ClientSdk.trackTrace>) =>
    trackTrace(...args),
  trackException: (...args: Parameters<typeof ClientSdk.trackException>) =>
    trackException(...args),
  trackEvent: (...args: Parameters<typeof ClientSdk.trackEvent>) =>
    trackEvent(...args),
  flush: vi.fn(),
  setAuthenticatedUserContext: vi.fn(),
  clearAuthenticatedUserContext: vi.fn(),
}));

vi.mock("../appinsights-server", () => ({
  logTrace: vi.fn(),
  logError: vi.fn(),
  logEvent: vi.fn(),
  logDependency: vi.fn(),
  flush: vi.fn(),
}));

// `logger` dispatches via `import("./appinsights-*").then(...)`. Even though
// vi.mock swaps the module, the dynamic import is still a Promise + a .then
// microtask, so a couple of awaits don't always drain the chain (it adds a
// task tick on top of the mock-resolution tick). vi.waitFor polls until the
// spy actually fires or times out.
async function waitForSpyCall(spy: ReturnType<typeof vi.fn>): Promise<void> {
  await vi.waitFor(() => {
    if (spy.mock.calls.length === 0) {
      throw new Error("spy not called yet");
    }
  });
}

// `Logger` chooses its SDK based on `typeof window === "undefined"` at module
// load. We stub `window` here so the client branch is reachable regardless of
// the vitest environment chosen for this file — observed on this host that
// the `jsdom` env from `vitest.config.ts` doesn't always activate, leaving
// `typeof window === "undefined"` and routing the logger at the server SDK.
vi.stubGlobal("window", globalThis);

describe("logger (#448)", () => {
  // The logger picks `appinsights-client` whenever `typeof window !== "undefined"`,
  // which is pinned by `vi.stubGlobal("window", …)` above. The mirrored server
  // branch is covered by the sibling `logger.server.test.ts` (runs under
  // `@vitest-environment node`, no stub).
  beforeEach(() => {
    trackTrace.mockClear();
    trackException.mockClear();
    trackEvent.mockClear();
  });

  afterEach(() => {
    vi.resetModules();
  });

  describe("log()", () => {
    it("emits an Info trace (severity 1) when called with only a message", async () => {
      const { logger } = await import("../logger");
      logger.log("hello world");
      await waitForSpyCall(trackTrace);
      expect(trackTrace).toHaveBeenCalledTimes(1);
      expect(trackTrace).toHaveBeenCalledWith("hello world", 1, {});
    });

    it("forwards properties when called with (message, properties)", async () => {
      const { logger } = await import("../logger");
      logger.log("user logged in", { userId: "u1", method: "oauth" });
      await waitForSpyCall(trackTrace);
      expect(trackTrace).toHaveBeenCalledWith("user logged in", 1, {
        userId: "u1",
        method: "oauth",
      });
    });

    it("treats string-shaped properties as properties, not as a level", async () => {
      // Regression guard for the dropped disambiguation: even if a future
      // caller passes `{ level: "warn" }` as properties, the severity stays
      // Info because `log()` no longer inspects the second argument's shape.
      const { logger } = await import("../logger");
      logger.log("ambiguous", { level: "warn" });
      await waitForSpyCall(trackTrace);
      expect(trackTrace).toHaveBeenCalledWith("ambiguous", 1, {
        level: "warn",
      });
    });
  });

  describe("convenience wrappers", () => {
    it("debug() emits severity 0 (Verbose)", async () => {
      const { logger } = await import("../logger");
      logger.debug("debug msg", { step: 1 });
      await waitForSpyCall(trackTrace);
      expect(trackTrace).toHaveBeenCalledWith("debug msg", 0, { step: 1 });
    });

    it("info() emits severity 1 (Information)", async () => {
      const { logger } = await import("../logger");
      logger.info("info msg");
      await waitForSpyCall(trackTrace);
      expect(trackTrace).toHaveBeenCalledWith("info msg", 1, {});
    });

    it("warn() emits severity 2 (Warning)", async () => {
      const { logger } = await import("../logger");
      logger.warn("warn msg", { field: "email" });
      await waitForSpyCall(trackTrace);
      expect(trackTrace).toHaveBeenCalledWith("warn msg", 2, {
        field: "email",
      });
    });
  });

  describe("error() / critical()", () => {
    it("error() reports severity 3 with the supplied properties", async () => {
      const { logger } = await import("../logger");
      const err = new Error("boom");
      logger.error(err, { operation: "fetch" });
      await waitForSpyCall(trackException);
      expect(trackException).toHaveBeenCalledWith(err, 3, {
        operation: "fetch",
      });
    });

    it("critical() reports severity 4 with the supplied properties", async () => {
      const { logger } = await import("../logger");
      const err = new Error("boom");
      logger.critical(err, { operation: "payment" });
      await waitForSpyCall(trackException);
      expect(trackException).toHaveBeenCalledWith(err, 4, {
        operation: "payment",
      });
    });
  });

  describe("event()", () => {
    it("forwards (name, properties, measurements) to the SDK", async () => {
      const { logger } = await import("../logger");
      logger.event(
        "PurchaseCompleted",
        { userId: "u1" },
        { amount: 99.99, quantity: 2 }
      );
      await waitForSpyCall(trackEvent);
      expect(trackEvent).toHaveBeenCalledWith(
        "PurchaseCompleted",
        { userId: "u1" },
        { amount: 99.99, quantity: 2 }
      );
    });
  });

  describe("withProperties()", () => {
    it("creates a child logger that prefixes every emit with the parent's defaults", async () => {
      const { logger } = await import("../logger");
      const child = logger.withProperties({ component: "checkout" });
      child.log("step 1", { step: 1 });
      await waitForSpyCall(trackTrace);
      expect(trackTrace).toHaveBeenCalledWith("step 1", 1, {
        component: "checkout",
        step: 1,
      });
    });

    it("call-site properties override parent defaults on conflict", async () => {
      const { logger } = await import("../logger");
      const child = logger.withProperties({
        component: "checkout",
        step: "init",
      });
      child.log("override", { step: "final" });
      await waitForSpyCall(trackTrace);
      expect(trackTrace).toHaveBeenCalledWith("override", 1, {
        component: "checkout",
        step: "final",
      });
    });
  });

  // Compile-time contract: `log()` no longer accepts a level argument. The
  // `// @ts-expect-error` here will FAIL to type-check (turning the build
  // red) if a future refactor adds an overload accepting `LogLevel` as the
  // second or third argument again.
  describe("type contract", () => {
    it("rejects a LogLevel as the second positional argument (compile-time)", async () => {
      const { logger, LogLevel } = await import("../logger");
      // @ts-expect-error - level positional argument was removed; use logger.warn()
      logger.log("cache miss", LogLevel.Warn);
      await waitForSpyCall(trackTrace);
      // Runtime fallout if someone bypasses the type check with a cast: the
      // string `"warn"` reaches `{ ...properties }`, which spreads the four
      // indexed characters into the merged payload. Pinning this behaviour
      // here so a future migration to a stricter runtime guard is an
      // intentional test-update, not a silent semantics change.
      expect(trackTrace).toHaveBeenCalledWith("cache miss", 1, {
        "0": "w",
        "1": "a",
        "2": "r",
        "3": "n",
      });
    });

    it("rejects (message, properties, level) — the 3-arg overload is gone", async () => {
      const { logger, LogLevel } = await import("../logger");
      // @ts-expect-error - third positional argument was removed
      logger.log("with props and level", { userId: "u1" }, LogLevel.Warn);
      await waitForSpyCall(trackTrace);
      // The third argument is dropped silently at runtime — properties win,
      // severity stays Info. No level escalation possible via this path.
      expect(trackTrace).toHaveBeenCalledWith("with props and level", 1, {
        userId: "u1",
      });
    });
  });
});
