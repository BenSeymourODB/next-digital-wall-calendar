// Server-branch companion to `logger.test.ts`. The logger's dispatch keys off
// `typeof window === "undefined"` at module load. This file leaves `window`
// undefined (no `vi.stubGlobal("window", …)`) so the dispatch goes to
// `appinsights-server`. Without this file, the server branch in `emitTrace`,
// `error`, `critical`, `event`, and `dependency` would have zero coverage
// (every API-route test wholesale-mocks `@/lib/logger`, so the real dispatch
// is never exercised on the server).
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type * as ServerSdk from "../appinsights-server";

const logTrace = vi.fn();
const logError = vi.fn();
const logEvent = vi.fn();
const logDependency = vi.fn();

// Lambda wrappers (rather than `{ logTrace }`) defer the spy lookup past the
// hoist of `vi.mock` — without them the factory reads `undefined` from the
// temporal dead zone of `const logTrace = vi.fn()`. The
// `Parameters<typeof ServerSdk.X>` typing fails `pnpm check-types` if the
// real SDK signature ever drifts from what the test assumes.
vi.mock("../appinsights-server", () => ({
  logTrace: (...args: Parameters<typeof ServerSdk.logTrace>) =>
    logTrace(...args),
  logError: (...args: Parameters<typeof ServerSdk.logError>) =>
    logError(...args),
  logEvent: (...args: Parameters<typeof ServerSdk.logEvent>) =>
    logEvent(...args),
  logDependency: (...args: Parameters<typeof ServerSdk.logDependency>) =>
    logDependency(...args),
  flush: vi.fn(),
}));

// Client SDK mock kept as a safety net — if `isServer` ever flips back to
// false here, it surfaces as a spy on the client side instead of a hard
// crash from a missing module.
vi.mock("../appinsights-client", () => ({
  trackTrace: vi.fn(),
  trackException: vi.fn(),
  trackEvent: vi.fn(),
  flush: vi.fn(),
  setAuthenticatedUserContext: vi.fn(),
  clearAuthenticatedUserContext: vi.fn(),
}));

// Defensive: vitest's jsdom env may set `window` on this worker. Wipe it so
// `typeof window === "undefined"` and the logger picks the server path.
vi.stubGlobal("window", undefined);

async function waitForSpyCall(spy: ReturnType<typeof vi.fn>): Promise<void> {
  await vi.waitFor(() => {
    if (spy.mock.calls.length === 0) {
      throw new Error("spy not called yet");
    }
  });
}

describe("logger — server dispatch (#448)", () => {
  beforeEach(() => {
    logTrace.mockClear();
    logError.mockClear();
    logEvent.mockClear();
    logDependency.mockClear();
  });

  afterEach(() => {
    vi.resetModules();
  });

  it("log() routes to appinsights-server.logTrace with severity 1 (Info)", async () => {
    const { logger } = await import("../logger");
    logger.log("server hello", { userId: "u1" });
    await waitForSpyCall(logTrace);
    expect(logTrace).toHaveBeenCalledWith("server hello", 1, { userId: "u1" });
  });

  it("warn() routes to appinsights-server.logTrace with severity 2", async () => {
    const { logger } = await import("../logger");
    logger.warn("server warn", { field: "email" });
    await waitForSpyCall(logTrace);
    expect(logTrace).toHaveBeenCalledWith("server warn", 2, { field: "email" });
  });

  it("debug() routes to appinsights-server.logTrace with severity 0", async () => {
    const { logger } = await import("../logger");
    logger.debug("server debug");
    await waitForSpyCall(logTrace);
    expect(logTrace).toHaveBeenCalledWith("server debug", 0, {});
  });

  it("error() routes to appinsights-server.logError with severity 3", async () => {
    const { logger } = await import("../logger");
    const err = new Error("boom");
    logger.error(err, { operation: "fetch" });
    await waitForSpyCall(logError);
    expect(logError).toHaveBeenCalledWith(err, { operation: "fetch" }, 3);
  });

  it("critical() routes to appinsights-server.logError with severity 4", async () => {
    const { logger } = await import("../logger");
    const err = new Error("boom");
    logger.critical(err, { operation: "payment" });
    await waitForSpyCall(logError);
    expect(logError).toHaveBeenCalledWith(err, { operation: "payment" }, 4);
  });

  it("event() routes to appinsights-server.logEvent with properties + measurements", async () => {
    const { logger } = await import("../logger");
    logger.event(
      "PurchaseCompleted",
      { userId: "u1" },
      { amount: 99.99, quantity: 2 }
    );
    await waitForSpyCall(logEvent);
    expect(logEvent).toHaveBeenCalledWith(
      "PurchaseCompleted",
      { userId: "u1" },
      { amount: 99.99, quantity: 2 }
    );
  });

  it("dependency() routes to appinsights-server.logDependency (server-only API)", async () => {
    const { logger } = await import("../logger");
    logger.dependency("GET /users", "https://api.example.com", 245, true, 200);
    await waitForSpyCall(logDependency);
    expect(logDependency).toHaveBeenCalledWith(
      "GET /users",
      "https://api.example.com",
      245,
      true,
      200,
      "HTTP"
    );
  });
});
