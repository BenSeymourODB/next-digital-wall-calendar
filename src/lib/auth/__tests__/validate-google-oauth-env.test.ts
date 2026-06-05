import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { validateGoogleOAuthEnv } from "../validate-google-oauth-env";

/**
 * Boot-time assertion for Google OAuth client credentials (#379).
 *
 * Parallel to `validateEncryptionKey()` from #315 / PR #348: surface a
 * server-side misconfig as an immediate boot failure instead of as an
 * `invalid_client` mid-session that the refresh-error classifier (correctly)
 * promotes to terminal and force-logs the user out.
 *
 * `vi.stubEnv` only writes strings, so the truly-absent case (`undefined`)
 * has to be tested with a direct `delete process.env.X`. Each test restores
 * the variable in `afterEach`.
 */
describe("validateGoogleOAuthEnv", () => {
  const ORIGINAL_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
  const ORIGINAL_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;

  beforeEach(() => {
    vi.stubEnv("GOOGLE_CLIENT_ID", "client-id.apps.googleusercontent.com");
    vi.stubEnv("GOOGLE_CLIENT_SECRET", "client-secret-value");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    if (ORIGINAL_CLIENT_ID === undefined) {
      delete process.env.GOOGLE_CLIENT_ID;
    } else {
      process.env.GOOGLE_CLIENT_ID = ORIGINAL_CLIENT_ID;
    }
    if (ORIGINAL_CLIENT_SECRET === undefined) {
      delete process.env.GOOGLE_CLIENT_SECRET;
    } else {
      process.env.GOOGLE_CLIENT_SECRET = ORIGINAL_CLIENT_SECRET;
    }
  });

  it("returns silently when both env vars are populated", () => {
    expect(() => validateGoogleOAuthEnv()).not.toThrow();
  });

  it("throws when GOOGLE_CLIENT_ID is absent (process.env.GOOGLE_CLIENT_ID === undefined)", () => {
    delete process.env.GOOGLE_CLIENT_ID;
    expect(() => validateGoogleOAuthEnv()).toThrow(/GOOGLE_CLIENT_ID/);
  });

  it("throws when GOOGLE_CLIENT_SECRET is absent", () => {
    delete process.env.GOOGLE_CLIENT_SECRET;
    expect(() => validateGoogleOAuthEnv()).toThrow(/GOOGLE_CLIENT_SECRET/);
  });

  it("throws when GOOGLE_CLIENT_ID is the empty string (shell footgun: `export X=`)", () => {
    vi.stubEnv("GOOGLE_CLIENT_ID", "");
    expect(() => validateGoogleOAuthEnv()).toThrow(/GOOGLE_CLIENT_ID/);
  });

  it("throws when GOOGLE_CLIENT_SECRET is the empty string", () => {
    vi.stubEnv("GOOGLE_CLIENT_SECRET", "");
    expect(() => validateGoogleOAuthEnv()).toThrow(/GOOGLE_CLIENT_SECRET/);
  });

  it("throws when GOOGLE_CLIENT_ID is whitespace-only (truthy but Google-invalid)", () => {
    vi.stubEnv("GOOGLE_CLIENT_ID", "   ");
    expect(() => validateGoogleOAuthEnv()).toThrow(/GOOGLE_CLIENT_ID/);
  });

  it("throws when GOOGLE_CLIENT_SECRET is whitespace-only", () => {
    vi.stubEnv("GOOGLE_CLIENT_SECRET", "\t\n  ");
    expect(() => validateGoogleOAuthEnv()).toThrow(/GOOGLE_CLIENT_SECRET/);
  });

  it("mentions both var names in a single error when both are missing", () => {
    // One restart should be enough for an operator to learn about every
    // missing variable — don't make them fix-and-restart twice.
    delete process.env.GOOGLE_CLIENT_ID;
    delete process.env.GOOGLE_CLIENT_SECRET;
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
    delete process.env.GOOGLE_CLIENT_ID;
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
