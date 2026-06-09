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
 * `vi.stubEnv(name, undefined)` deletes the key from `process.env`, so it
 * covers both the empty-string footgun (pass `""`) and the truly-absent
 * case (pass `undefined`). `vi.unstubAllEnvs()` in `afterEach` restores
 * every stubbed key to its original value — no manual snapshot/restore
 * needed.
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

  it("throws when GOOGLE_CLIENT_ID is absent (process.env.GOOGLE_CLIENT_ID === undefined)", () => {
    vi.stubEnv("GOOGLE_CLIENT_ID", undefined);
    expect(() => validateGoogleOAuthEnv()).toThrow(/GOOGLE_CLIENT_ID/);
  });

  it("throws when GOOGLE_CLIENT_SECRET is absent", () => {
    vi.stubEnv("GOOGLE_CLIENT_SECRET", undefined);
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
    vi.stubEnv("GOOGLE_CLIENT_ID", undefined);
    vi.stubEnv("GOOGLE_CLIENT_SECRET", undefined);
    expect(() => validateGoogleOAuthEnv()).toThrow(/GOOGLE_CLIENT_ID/);
    expect(() => validateGoogleOAuthEnv()).toThrow(/GOOGLE_CLIENT_SECRET/);
  });

  it("references the originating issue trail (#315 / #379) for triage", () => {
    // Future readers shouldn't have to redo the misconfig-vs-terminal-class
    // analysis — point them straight at the issues.
    vi.stubEnv("GOOGLE_CLIENT_ID", undefined);
    expect(() => validateGoogleOAuthEnv()).toThrow(/#315|#379/);
  });
});
