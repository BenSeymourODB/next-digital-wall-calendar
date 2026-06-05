import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { validateGoogleOAuthEnv } from "../validate-google-oauth-env";

/**
 * Boot-time assertion for Google OAuth client credentials (#379).
 *
 * Parallel to `validateEncryptionKey()` from #315 / PR #348: surface a
 * server-side misconfig as an immediate boot failure instead of as an
 * `invalid_client` mid-session that the refresh-error classifier (correctly)
 * promotes to terminal and force-logs the user out.
 */
describe("validateGoogleOAuthEnv", () => {
  beforeEach(() => {
    vi.stubEnv("GOOGLE_CLIENT_ID", "client-id.apps.googleusercontent.com");
    vi.stubEnv("GOOGLE_CLIENT_SECRET", "client-secret-value");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("returns silently when both env vars are populated", () => {
    expect(() => validateGoogleOAuthEnv()).not.toThrow();
  });

  it("throws when GOOGLE_CLIENT_ID is unset", () => {
    vi.stubEnv("GOOGLE_CLIENT_ID", "");
    expect(() => validateGoogleOAuthEnv()).toThrow(/GOOGLE_CLIENT_ID/);
  });

  it("throws when GOOGLE_CLIENT_SECRET is unset", () => {
    vi.stubEnv("GOOGLE_CLIENT_SECRET", "");
    expect(() => validateGoogleOAuthEnv()).toThrow(/GOOGLE_CLIENT_SECRET/);
  });

  it("throws when GOOGLE_CLIENT_ID is the empty string (shell footgun)", () => {
    // `export GOOGLE_CLIENT_ID=` with no value produces an empty string, not
    // `undefined`. Both must be treated as missing.
    vi.stubEnv("GOOGLE_CLIENT_ID", "");
    expect(() => validateGoogleOAuthEnv()).toThrow(/GOOGLE_CLIENT_ID/);
  });

  it("throws when GOOGLE_CLIENT_SECRET is the empty string", () => {
    vi.stubEnv("GOOGLE_CLIENT_SECRET", "");
    expect(() => validateGoogleOAuthEnv()).toThrow(/GOOGLE_CLIENT_SECRET/);
  });

  it("mentions both var names in a single error when both are missing", () => {
    // One restart should be enough for an operator to learn about every
    // missing variable — don't make them fix-and-restart twice.
    vi.stubEnv("GOOGLE_CLIENT_ID", "");
    vi.stubEnv("GOOGLE_CLIENT_SECRET", "");
    let caught: unknown;
    try {
      validateGoogleOAuthEnv();
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeInstanceOf(Error);
    const message = (caught as Error).message;
    expect(message).toMatch(/GOOGLE_CLIENT_ID/);
    expect(message).toMatch(/GOOGLE_CLIENT_SECRET/);
  });

  it("references the originating issue trail (#315 / #379) for triage", () => {
    // Future readers shouldn't have to redo the misconfig-vs-terminal-class
    // analysis — point them straight at the issues.
    vi.stubEnv("GOOGLE_CLIENT_ID", "");
    let caught: unknown;
    try {
      validateGoogleOAuthEnv();
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeInstanceOf(Error);
    expect((caught as Error).message).toMatch(/#315|#379/);
  });
});
