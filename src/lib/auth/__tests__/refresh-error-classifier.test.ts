import { describe, expect, it } from "vitest";
import {
  MissingRefreshTokenError,
  RefreshTokenDecryptError,
  classifyTokenRefreshError,
} from "../refresh-error-classifier";
import { GoogleTokenRefreshError } from "../refresh-google-token";

describe("classifyTokenRefreshError", () => {
  describe("terminal Google errors (forces re-auth — intentional revocation)", () => {
    it("classifies invalid_grant as terminal", () => {
      const err = new GoogleTokenRefreshError(400, {
        error: "invalid_grant",
        error_description: "Token has been expired or revoked.",
      });
      expect(classifyTokenRefreshError(err)).toBe("terminal");
    });

    it("classifies invalid_client as terminal", () => {
      const err = new GoogleTokenRefreshError(401, { error: "invalid_client" });
      expect(classifyTokenRefreshError(err)).toBe("terminal");
    });

    it("classifies unauthorized_client as terminal", () => {
      const err = new GoogleTokenRefreshError(400, {
        error: "unauthorized_client",
      });
      expect(classifyTokenRefreshError(err)).toBe("terminal");
    });
  });

  describe("internal sentinel errors (locally-permanent state)", () => {
    it("classifies MissingRefreshTokenError as terminal", () => {
      // No refresh token in the DB row — no number of retries can conjure
      // one. The session must invalidate so the user re-authenticates and a
      // fresh refresh_token gets stored.
      expect(classifyTokenRefreshError(new MissingRefreshTokenError())).toBe(
        "terminal"
      );
    });

    it("classifies RefreshTokenDecryptError as terminal", () => {
      // GCM auth-tag mismatch / unknown envelope version / key rotation —
      // the stored ciphertext can never be decrypted with the current key,
      // so the user must re-authenticate.
      expect(classifyTokenRefreshError(new RefreshTokenDecryptError())).toBe(
        "terminal"
      );
    });
  });

  describe("transient Google errors (retry on next callback — do NOT force re-auth)", () => {
    it("classifies rate_limit_exceeded as transient", () => {
      const err = new GoogleTokenRefreshError(429, {
        error: "rate_limit_exceeded",
      });
      expect(classifyTokenRefreshError(err)).toBe("transient");
    });

    it("classifies unsupported_grant_type as transient (#378)", () => {
      // Server-side code/config bug — we control the grant_type we send, so
      // re-auth can never fix it (the next refresh sends the same wrong
      // grant_type). Treating it as transient keeps the cached UI working
      // while the failure is loud in server logs for the operator to fix.
      const err = new GoogleTokenRefreshError(400, {
        error: "unsupported_grant_type",
      });
      expect(classifyTokenRefreshError(err)).toBe("transient");
    });

    it("classifies a 5xx response with unknown body as transient", () => {
      const err = new GoogleTokenRefreshError(503, {
        error: "service_unavailable",
      });
      expect(classifyTokenRefreshError(err)).toBe("transient");
    });

    it("classifies a 5xx response with no body.error field as transient", () => {
      const err = new GoogleTokenRefreshError(500, { message: "boom" });
      expect(classifyTokenRefreshError(err)).toBe("transient");
    });

    it("classifies a 5xx response with a non-object body as transient", () => {
      const err = new GoogleTokenRefreshError(502, "Bad Gateway");
      expect(classifyTokenRefreshError(err)).toBe("transient");
    });

    it("classifies a 5xx response with null body as transient", () => {
      const err = new GoogleTokenRefreshError(500, null);
      expect(classifyTokenRefreshError(err)).toBe("transient");
    });
  });

  describe("non-Google errors", () => {
    it("classifies a generic TypeError (network failure) as transient", () => {
      const err = new TypeError("fetch failed");
      expect(classifyTokenRefreshError(err)).toBe("transient");
    });

    it("classifies a decrypt failure as transient", () => {
      const err = new Error(
        "Failed to decrypt stored refresh token (possible key rotation or tampering)"
      );
      expect(classifyTokenRefreshError(err)).toBe("transient");
    });

    it("classifies an arbitrary unknown error as transient (safe default)", () => {
      const err = new Error("something completely unexpected");
      expect(classifyTokenRefreshError(err)).toBe("transient");
    });

    it("classifies a non-Error thrown value as transient", () => {
      expect(classifyTokenRefreshError("string thrown directly")).toBe(
        "transient"
      );
      expect(classifyTokenRefreshError(null)).toBe("transient");
      expect(classifyTokenRefreshError(undefined)).toBe("transient");
      expect(classifyTokenRefreshError(42)).toBe("transient");
    });
  });

  describe("safe-default invariant", () => {
    it("never returns terminal for a GoogleTokenRefreshError whose body.error is unknown", () => {
      // The set of terminal Google error codes is intentionally a closed
      // allow-list. Any code we don't recognise must default to transient so
      // that an unfamiliar Google response never silently forces re-auth.
      const codes = [
        "internal_error",
        "temporarily_unavailable",
        "rate_limit_exceeded",
        "slow_down",
        // Recognised but intentionally transient — guards against a
        // regression that re-promotes it to the terminal allow-list (#378).
        "unsupported_grant_type",
        "",
      ];
      for (const code of codes) {
        const err = new GoogleTokenRefreshError(400, { error: code });
        expect(classifyTokenRefreshError(err)).toBe("transient");
      }
    });
  });
});
